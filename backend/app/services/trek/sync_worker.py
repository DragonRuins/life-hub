"""
Star Trek Database Sync Worker

Background jobs called by APScheduler:
  1. pick_daily_entry — Runs at 6 AM daily, picks a random entity for "Entry of the Day"
  2. prefetch_episodes — Runs on startup then weekly, caches all ~860 episodes
  3. prefetch_series — Runs on startup then weekly, caches all series

Also provides pick_daily_entry_now() for on-demand picks when the
scheduler hasn't run yet (e.g., first page load of the day).
"""
import logging
import random
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)


def pick_daily_entry(app):
    """
    Pick today's Star Trek entry of the day.

    Called by APScheduler at 6 AM daily. Rotates through configured
    entity categories so the user sees a different type each day.

    Args:
        app: Flask application instance
    """
    with app.app_context():
        try:
            entry = pick_daily_entry_now()
            if entry:
                logger.info(f"Trek daily entry picked: {entry.entity_name} ({entry.entity_type})")
            else:
                logger.warning("Failed to pick trek daily entry")
        except Exception as e:
            logger.error(f"Trek daily entry picker failed: {e}")


def pick_daily_entry_now():
    """
    Pick a daily entry for today. Can be called on-demand.

    Returns:
        TrekDailyEntry: The created entry, or existing one if already picked today.
        None if all attempts fail.
    """
    from app import db
    from app.models.trek import TrekDailyEntry, TrekSettings
    from app.services.trek.stapi_client import STAPIClient
    from app.services.trek.entity_registry import get_entity_config

    today = date.today()

    # Check if already picked today
    existing = TrekDailyEntry.query.filter_by(entry_date=today).first()
    if existing:
        return existing

    settings = TrekSettings.get_settings()
    categories = settings.daily_entry_categories or ['character']

    # Determine which category to use today by rotating through the list
    # Use day-of-year modulo to rotate deterministically
    day_index = today.timetuple().tm_yday % len(categories)
    entity_type = categories[day_index]

    client = STAPIClient()

    # Try up to 3 times (might fail if STAPI returns empty results)
    for attempt in range(3):
        try:
            entity = client.random_entity(entity_type)
            if not entity:
                # Try a different category
                entity_type = random.choice(categories)
                continue

            config = get_entity_config(entity_type)
            summary_data = {}
            for field in config.get('summary_fields', []):
                if field in entity:
                    summary_data[field] = entity[field]

            entry = TrekDailyEntry(
                entry_date=today,
                entity_type=entity_type,
                entity_uid=entity.get('uid', ''),
                entity_name=entity.get('name') or entity.get('title', 'Unknown'),
                summary_data=summary_data,
            )
            db.session.add(entry)
            db.session.commit()
            return entry

        except Exception as e:
            db.session.rollback()
            logger.warning(f"Daily entry attempt {attempt + 1} failed: {e}")
            # Try a different category on retry
            entity_type = random.choice(categories)

    return None


def prefetch_episodes(app):
    """
    Pre-fetch all Star Trek episodes (~860 total) for "On This Day" lookups.

    Fetches all pages from STAPI (50 per page at ~1 req/sec) and stores
    the full episode list in the astro_cache table under 'stapi_episodes_all'.

    Args:
        app: Flask application instance
    """
    with app.app_context():
        try:
            from app.services.trek.stapi_client import STAPIClient
            from app.services.astrometrics.cache_manager import AstroCacheManager

            client = STAPIClient()
            cache = AstroCacheManager()

            # Fetch page 0 to get total pages
            first_page = client.search('episode', page=0, page_size=50)
            page_info = first_page.get('page', {})
            total_pages = page_info.get('totalPages', 1)
            all_episodes = first_page.get('episodes', [])

            logger.info(f"Pre-fetching {total_pages} pages of episodes...")

            # Fetch remaining pages
            for page_num in range(1, total_pages):
                try:
                    result = client.search('episode', page=page_num, page_size=50)
                    episodes = result.get('episodes', [])
                    all_episodes.extend(episodes)
                except Exception as e:
                    logger.warning(f"Episode page {page_num} fetch failed: {e}")
                    continue

            # Store all episodes in a single cache entry
            cache.get_or_fetch(
                source='stapi_episodes_all',
                cache_key='all',
                fetch_fn=lambda: {'episodes': all_episodes, 'count': len(all_episodes)},
                ttl_seconds=604800,  # 7 days
            )

            logger.info(f"Pre-fetched {len(all_episodes)} episodes successfully")

        except Exception as e:
            logger.error(f"Episode pre-fetch failed: {e}")


def prefetch_series(app):
    """
    Pre-fetch all Star Trek series (small dataset, ~15 entries).

    Args:
        app: Flask application instance
    """
    with app.app_context():
        try:
            from app.services.trek.stapi_client import STAPIClient
            from app.services.astrometrics.cache_manager import AstroCacheManager

            client = STAPIClient()
            cache = AstroCacheManager()

            cache.get_or_fetch(
                source='stapi_series',
                cache_key='all',
                fetch_fn=lambda: client.search('series', page=0, page_size=100),
                ttl_seconds=604800,  # 7 days
            )

            logger.info("Pre-fetched series list successfully")

        except Exception as e:
            logger.error(f"Series pre-fetch failed: {e}")
