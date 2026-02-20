"""
Astrometrics Cache Manager

Implements a cache-first data access pattern using the AstroCache database table.
External API calls are expensive and rate-limited (especially NASA's DEMO_KEY at
30 req/hour), so we cache responses and serve stale data as a fallback when
the API is unavailable.

Flow:
  1. Check DB for a cached entry matching (source, cache_key)
  2. If entry exists and hasn't expired -> return cached data
  3. If entry is expired or missing -> call fetch_fn to get fresh data
  4. Store the fresh data in cache with a new expiration
  5. If fetch_fn fails and stale cache exists -> return stale data with stale=True flag
  6. If fetch_fn fails and no cache exists -> raise the error

TTL defaults (in seconds):
  - APOD: 86400 (24 hours)
  - NEO feed: 21600 (6 hours)
  - ISS position: 15 seconds
  - People in space: 3600 (1 hour)
  - Launches upcoming: 3600 (1 hour)
  - Launches past: 86400 (24 hours)
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


def _utcnow():
    """Return current UTC time as a naive datetime.

    PostgreSQL 'timestamp without time zone' columns store and return naive
    datetimes.  Python won't compare naive and aware datetimes, so we strip
    tzinfo to stay consistent with what the DB gives us.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

# Default TTLs by source name
DEFAULT_TTLS = {
    'nasa_apod': 86400,         # 24 hours
    'neo_feed': 21600,          # 6 hours
    'iss_position': 15,         # 15 seconds
    'people_in_space': 3600,    # 1 hour
    'launches_upcoming': 3600,  # 1 hour
    'launches_past': 86400,     # 24 hours
    'launches_next': 3600,      # 1 hour
    # STAPI (Star Trek API) cache TTLs
    'stapi_detail': 604800,      # 7 days (detail pages rarely change)
    'stapi_search': 86400,       # 24 hours (search results)
    'stapi_browse': 86400,       # 24 hours (browse pages)
    'stapi_episodes_all': 604800, # 7 days (full episode list for On This Day)
    'stapi_series': 604800,      # 7 days
    'stapi_ships': 86400,        # 24 hours
    'stapi_ship_classes': 86400, # 24 hours
}


class AstroCacheManager:
    """
    Cache-first data access for Astrometrics external API calls.

    Usage:
        manager = AstroCacheManager()
        data = manager.get_or_fetch(
            source='nasa_apod',
            cache_key='2026-02-19',
            fetch_fn=lambda: api_client.get_apod('2026-02-19'),
        )
    """

    def get_or_fetch(self, source, cache_key, fetch_fn, ttl_seconds=None):
        """
        Get cached data or fetch fresh data from the API.

        Args:
            source: Cache source identifier (e.g., 'nasa_apod')
            cache_key: Cache key within source (e.g., '2026-02-19')
            fetch_fn: Callable that returns fresh data from the API
            ttl_seconds: Cache TTL override. Uses DEFAULT_TTLS if not provided.

        Returns:
            dict with keys:
              - data: The cached or freshly fetched data
              - stale: bool, True if returning expired cache due to fetch failure
              - fetched_at: ISO timestamp of when data was last fetched
              - source: The source identifier
        """
        from app import db
        from app.models.astrometrics import AstroCache

        if ttl_seconds is None:
            ttl_seconds = DEFAULT_TTLS.get(source, 3600)

        now = _utcnow()

        # Step 1: Check for existing cache entry
        cached = AstroCache.query.filter_by(
            source=source,
            cache_key=cache_key,
        ).first()

        # Step 2: If cached and not expired, return it
        if cached and cached.expires_at > now:
            return {
                'data': cached.data,
                'stale': False,
                'fetched_at': cached.fetched_at.isoformat(),
                'source': source,
            }

        # Step 3: Try to fetch fresh data
        try:
            fresh_data = fetch_fn()

            expires_at = now + timedelta(seconds=ttl_seconds)

            if cached:
                # Update existing cache entry
                cached.data = fresh_data
                cached.fetched_at = now
                cached.expires_at = expires_at
            else:
                # Create new cache entry
                cached = AstroCache(
                    source=source,
                    cache_key=cache_key,
                    data=fresh_data,
                    fetched_at=now,
                    expires_at=expires_at,
                )
                db.session.add(cached)

            db.session.commit()

            return {
                'data': fresh_data,
                'stale': False,
                'fetched_at': now.isoformat(),
                'source': source,
            }

        except Exception as e:
            db.session.rollback()
            logger.warning(f"Fetch failed for {source}/{cache_key}: {e}")

            # Step 5: If stale cache exists, return it as fallback
            if cached:
                logger.info(f"Returning stale cache for {source}/{cache_key} "
                            f"(expired {cached.expires_at.isoformat()})")
                return {
                    'data': cached.data,
                    'stale': True,
                    'fetched_at': cached.fetched_at.isoformat(),
                    'source': source,
                }

            # Step 6: No cache at all, re-raise the error
            raise

    def cleanup_expired(self, max_age_hours=72):
        """
        Delete cache entries that expired more than max_age_hours ago.

        We keep recently-expired entries around as stale fallbacks.
        Only entries that have been expired for a long time get cleaned up.

        Args:
            max_age_hours: Delete entries expired longer than this (default 72h)
        """
        from app import db
        from app.models.astrometrics import AstroCache

        cutoff = _utcnow() - timedelta(hours=max_age_hours)

        deleted = AstroCache.query.filter(
            AstroCache.expires_at < cutoff
        ).delete()

        if deleted:
            db.session.commit()
            logger.info(f"Cleaned up {deleted} expired astrometrics cache entries")

    def get_cache_status(self):
        """
        Get freshness status for all cache sources.

        Returns:
            dict: source -> {cache_key, fetched_at, expires_at, stale, age_seconds}
        """
        from app.models.astrometrics import AstroCache
        from sqlalchemy import func

        now = _utcnow()
        status = {}

        # Get the most recent entry per source
        # Use a subquery to find max fetched_at per source
        entries = AstroCache.query.order_by(
            AstroCache.source, AstroCache.fetched_at.desc()
        ).all()

        seen_sources = set()
        for entry in entries:
            if entry.source in seen_sources:
                continue
            seen_sources.add(entry.source)

            age_seconds = (now - entry.fetched_at).total_seconds() if entry.fetched_at else None
            status[entry.source] = {
                'cache_key': entry.cache_key,
                'fetched_at': entry.fetched_at.isoformat() if entry.fetched_at else None,
                'expires_at': entry.expires_at.isoformat() if entry.expires_at else None,
                'stale': entry.expires_at < now if entry.expires_at else True,
                'age_seconds': round(age_seconds) if age_seconds is not None else None,
            }

        return status
