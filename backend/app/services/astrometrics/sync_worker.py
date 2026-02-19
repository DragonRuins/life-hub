"""
Astrometrics Sync Worker

Background sync loop called by APScheduler every 15 minutes.
Pre-fetches and caches data from external APIs so the frontend
gets fast responses from cache instead of waiting for live API calls.

Also checks for notification-worthy events:
  - New APOD available (once daily)
  - Launch within reminder window
  - NEO approaching closer than threshold
  - Potentially hazardous asteroid detected

Notification events are emitted via the event bus, which checks
if any enabled rules match and dispatches accordingly.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Track the last APOD date we saw, so we only emit once per new APOD
_last_apod_date = None


def run_astro_sync(app):
    """
    Main sync entry point, called by APScheduler.

    Runs inside the Flask app context. Fetches and caches:
      - Today's APOD
      - This week's NEO feed
      - Upcoming launches
      - People currently in space

    Also checks notification thresholds and cleans up expired cache.

    Args:
        app: The Flask application instance
    """
    with app.app_context():
        try:
            from app.models.astrometrics import AstroSettings
            from app.services.astrometrics.api_client import AstroApiClient
            from app.services.astrometrics.cache_manager import AstroCacheManager

            settings = AstroSettings.get_settings()
            client = AstroApiClient(nasa_api_key=settings.nasa_api_key)
            cache = AstroCacheManager()

            # Pre-fetch all data sources
            _sync_apod(client, cache, settings)
            _sync_neo(client, cache, settings)
            _sync_launches(client, cache, settings)
            _sync_people_in_space(client, cache)

            # Clean up old cache entries (older than 72 hours past expiry)
            cache.cleanup_expired(max_age_hours=72)

            logger.debug("Astrometrics sync completed")

        except Exception as e:
            logger.error(f"Astrometrics sync failed: {e}")


def _sync_apod(client, cache, settings):
    """Fetch and cache today's APOD. Emit notification if new."""
    global _last_apod_date

    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        result = cache.get_or_fetch(
            source='nasa_apod',
            cache_key=today,
            fetch_fn=lambda: client.get_apod(today),
            ttl_seconds=settings.refresh_apod,
        )

        # Check if this is a new APOD we haven't notified about
        apod_data = result.get('data', {})
        apod_date = apod_data.get('date')

        if apod_date and apod_date != _last_apod_date:
            if _last_apod_date is not None:
                # Only emit after the first sync (don't emit on app startup)
                _emit_event('astro.apod_new',
                            title=apod_data.get('title', ''),
                            date=apod_date,
                            media_type=apod_data.get('media_type', 'image'))
            _last_apod_date = apod_date

    except Exception as e:
        logger.warning(f"APOD sync failed: {e}")


def _sync_neo(client, cache, settings):
    """Fetch and cache this week's NEO data. Check for close approaches."""
    try:
        today = datetime.now(timezone.utc)
        start_date = today.strftime('%Y-%m-%d')
        # NEO API allows max 7 days
        end_date = (today + timedelta(days=6)).strftime('%Y-%m-%d')
        cache_key = f"{start_date}_{end_date}"

        result = cache.get_or_fetch(
            source='neo_feed',
            cache_key=cache_key,
            fetch_fn=lambda: client.get_neo_feed(start_date, end_date),
            ttl_seconds=settings.refresh_neo,
        )

        # Check for notification-worthy NEOs
        neo_data = result.get('data', {})
        _check_neo_alerts(neo_data, settings)

    except Exception as e:
        logger.warning(f"NEO sync failed: {e}")


def _sync_launches(client, cache, settings):
    """Fetch and cache upcoming and past launches. Check for reminders."""
    try:
        # Upcoming launches
        result = cache.get_or_fetch(
            source='launches_upcoming',
            cache_key='upcoming',
            fetch_fn=lambda: client.get_upcoming_launches(limit=15),
            ttl_seconds=settings.refresh_launches,
        )

        # Check for launch reminders
        launches_data = result.get('data', {})
        _check_launch_reminders(launches_data, settings)

        # Past launches (less frequent refresh)
        cache.get_or_fetch(
            source='launches_past',
            cache_key='past',
            fetch_fn=lambda: client.get_past_launches(limit=10),
            ttl_seconds=86400,  # 24 hours
        )

        # Next launch (quick-access cache)
        cache.get_or_fetch(
            source='launches_next',
            cache_key='next',
            fetch_fn=lambda: client.get_next_launch(),
            ttl_seconds=settings.refresh_launches,
        )

    except Exception as e:
        logger.warning(f"Launches sync failed: {e}")


def _sync_people_in_space(client, cache):
    """Fetch and cache the list of people currently in space."""
    try:
        cache.get_or_fetch(
            source='people_in_space',
            cache_key='current',
            fetch_fn=lambda: client.get_people_in_space(),
        )
    except Exception as e:
        logger.warning(f"People in space sync failed: {e}")


def _check_neo_alerts(neo_data, settings):
    """
    Check NEO data for close approaches and hazardous asteroids.

    Emits notification events if:
      - Any NEO is closer than neo_close_approach_threshold_ld lunar distances
      - Any NEO is classified as potentially hazardous
    """
    threshold_ld = settings.neo_close_approach_threshold_ld
    near_earth_objects = neo_data.get('near_earth_objects', {})

    for date_str, neos in near_earth_objects.items():
        for neo in neos:
            name = neo.get('name', 'Unknown')
            is_hazardous = neo.get('is_potentially_hazardous_asteroid', False)

            # Check close approach data
            for approach in neo.get('close_approach_data', []):
                miss_distance = approach.get('miss_distance', {})
                ld_str = miss_distance.get('lunar', '999')
                try:
                    ld = float(ld_str)
                except (ValueError, TypeError):
                    continue

                if ld < threshold_ld:
                    _emit_event('astro.neo_close_approach',
                                name=name,
                                date=approach.get('close_approach_date', date_str),
                                miss_distance_ld=round(ld, 2),
                                miss_distance_km=miss_distance.get('kilometers', 'unknown'),
                                is_hazardous=is_hazardous)

                if is_hazardous:
                    _emit_event('astro.neo_hazardous',
                                name=name,
                                date=approach.get('close_approach_date', date_str),
                                miss_distance_ld=round(ld, 2),
                                velocity_kps=approach.get('relative_velocity', {}).get('kilometers_per_second', 'unknown'))


def _check_launch_reminders(launches_data, settings):
    """
    Check if any upcoming launch is within the reminder window.

    Emits astro.launch_reminder for launches happening within
    launch_reminder_hours from now.
    """
    reminder_hours = settings.launch_reminder_hours
    now = datetime.now(timezone.utc)
    reminder_cutoff = now + timedelta(hours=reminder_hours)

    for launch in launches_data.get('results', []):
        net = launch.get('net')  # NET = No Earlier Than
        if not net:
            continue

        try:
            # Launch Library 2 returns ISO format timestamps
            launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            continue

        if now < launch_time <= reminder_cutoff:
            hours_until = round((launch_time - now).total_seconds() / 3600, 1)
            _emit_event('astro.launch_reminder',
                        name=launch.get('name', 'Unknown Launch'),
                        provider=launch.get('launch_service_provider', {}).get('name', 'Unknown'),
                        net=net,
                        hours_until=hours_until,
                        pad=launch.get('pad', {}).get('name', 'Unknown'))


def _emit_event(event_name, **payload):
    """
    Emit a notification event via the event bus.

    Wrapped in try/except so notification failures never break the sync.
    """
    try:
        from app.services.event_bus import emit
        emit(event_name, **payload)
    except Exception as e:
        logger.error(f"Failed to emit {event_name}: {e}")
