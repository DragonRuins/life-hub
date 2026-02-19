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

# Track which launches/NEOs we've already notified about this process lifetime.
# Resets on restart, which is acceptable (at most one duplicate).
_notified_launches = set()
_notified_neos = set()


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

    Each NEO is only notified once per process lifetime.
    """
    threshold_ld = settings.neo_close_approach_threshold_ld
    near_earth_objects = neo_data.get('near_earth_objects', {})

    for date_str, neos in near_earth_objects.items():
        for neo in neos:
            neo_id = neo.get('id', neo.get('name', ''))
            neo_name = neo.get('name', 'Unknown')
            is_hazardous = neo.get('is_potentially_hazardous_asteroid', False)

            # Extract estimated diameter for templates
            diameter_data = neo.get('estimated_diameter', {}).get('meters', {})
            diameter_m = round((diameter_data.get('estimated_diameter_min', 0) +
                                diameter_data.get('estimated_diameter_max', 0)) / 2)

            for approach in neo.get('close_approach_data', []):
                miss_distance = approach.get('miss_distance', {})
                ld_str = miss_distance.get('lunar', '999')
                try:
                    ld = float(ld_str)
                except (ValueError, TypeError):
                    continue

                approach_date = approach.get('close_approach_date', date_str)
                dedup_key = f"{neo_id}_{approach_date}"

                if ld < threshold_ld and dedup_key not in _notified_neos:
                    _notified_neos.add(dedup_key)
                    _emit_event('astro.neo_close_approach',
                                neo_name=neo_name,
                                close_approach_date=approach_date,
                                miss_distance_ld=round(ld, 2),
                                miss_distance_km=miss_distance.get('kilometers', 'unknown'),
                                diameter_m=diameter_m,
                                is_hazardous=is_hazardous)

                if is_hazardous and f"haz_{dedup_key}" not in _notified_neos:
                    _notified_neos.add(f"haz_{dedup_key}")
                    _emit_event('astro.neo_hazardous',
                                neo_name=neo_name,
                                close_approach_date=approach_date,
                                miss_distance_ld=round(ld, 2),
                                diameter_m=diameter_m,
                                velocity_kps=approach.get('relative_velocity', {}).get('kilometers_per_second', 'unknown'))


def _check_launch_reminders(launches_data, settings):
    """
    Two-gate launch reminder system.

    Gate 1 (required): fires when a launch is within launch_reminder_hours.
    Gate 2 (optional): fires when a launch is within launch_reminder_minutes_2
                       (disabled when null/0).

    Each (launch, gate) pair is only notified once per process lifetime.
    To prevent duplicate notifications when both gates qualify on the same
    sync cycle (e.g., after a restart), only ONE notification is emitted per
    launch per sync. All qualifying gates are still marked as notified so
    they won't fire again in future cycles.
    """
    now = datetime.now(timezone.utc)

    # Build list of active gates: (gate_name, cutoff_timedelta)
    gates = []
    if settings.launch_reminder_hours:
        gates.append(('gate1', timedelta(hours=settings.launch_reminder_hours)))
    if settings.launch_reminder_minutes_2:
        gates.append(('gate2', timedelta(minutes=settings.launch_reminder_minutes_2)))

    for launch in launches_data.get('results', []):
        launch_id = launch.get('id', launch.get('name', ''))
        net = launch.get('net')  # NET = No Earlier Than
        if not net:
            continue

        try:
            launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            continue

        if launch_time <= now:
            continue  # Already launched

        # Track whether we've already emitted for this launch in this sync cycle.
        # This prevents duplicate notifications when multiple gates qualify at once
        # (e.g., after app restart or when gate windows overlap).
        emitted_this_launch = False

        for gate_name, gate_delta in gates:
            dedup_key = f"{launch_id}_{gate_name}"
            if dedup_key in _notified_launches:
                continue

            if launch_time <= now + gate_delta:
                # Mark this gate as handled regardless of whether we emit,
                # so it won't fire again on the next sync cycle.
                _notified_launches.add(dedup_key)

                if not emitted_this_launch:
                    emitted_this_launch = True

                    hours_until = (launch_time - now).total_seconds() / 3600
                    if hours_until < 1:
                        time_label = f"{round(hours_until * 60)} minutes"
                    else:
                        time_label = f"{round(hours_until, 1)} hours"

                    _emit_event('astro.launch_reminder',
                                launch_name=launch.get('name', 'Unknown Launch'),
                                provider=launch.get('launch_service_provider', {}).get('name', 'Unknown'),
                                net=net,
                                hours_until=time_label,
                                pad_name=launch.get('pad', {}).get('name', 'Unknown'))


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
