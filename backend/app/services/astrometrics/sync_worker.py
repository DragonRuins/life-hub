"""
Astrometrics Sync Worker

Background sync loop called by APScheduler every 15 minutes.
Pre-fetches and caches data from external APIs so the frontend
gets fast responses from cache instead of waiting for live API calls.

Also checks for notification-worthy events:
  - New APOD available (once daily)
  - Launch reminders scheduled as precise one-shot APScheduler jobs
  - NEO approaching closer than threshold
  - Potentially hazardous asteroid detected

Launch reminder dedup is backed by the astro_launch_notifications DB table
(AstroLaunchNotification model) so it survives container restarts. Each
(launch_id, gate) pair gets a precise one-shot job at exactly fire_at time,
eliminating timing drift from the 15-minute polling interval.

Notification events are emitted via the event bus, which checks
if any enabled rules match and dispatches accordingly.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Track the last APOD date we saw, so we only emit once per new APOD
_last_apod_date = None

# Track which NEOs we've already notified about this process lifetime.
# NEO dedup stays in-memory because NEO events are idempotent and low-frequency.
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
    DB-backed launch reminder system with precise one-shot APScheduler jobs.

    For each launch and each active gate, calculates the exact fire_at time
    (launch_time - gate_delta) and either:
      - Creates a new DB record + schedules an APScheduler date-trigger job
      - Skips if already handled or fire_at is in the past
      - Reschedules if the launch has been moved (different NET)

    In-flight detection fires immediately when status changes to 'In Flight' (status id 6).

    Dedup is persistent in the astro_launch_notifications table, so it
    survives container restarts (unlike the old in-memory sets).
    """
    from app import db
    from app.models.astrometrics import AstroLaunchNotification

    now = datetime.now(timezone.utc)

    # Build list of active gates: (gate_name, gate_timedelta)
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

        launch_name = launch.get('name', 'Unknown Launch')
        provider = launch.get('launch_service_provider', {}).get('name', 'Unknown')
        pad_name = launch.get('pad', {}).get('name', 'Unknown')

        # Check for in-flight status (status id 6)
        status_id = launch.get('status', {}).get('id')
        if status_id == 6:
            _handle_inflight(db, launch_id, launch_name, provider, net, pad_name)

        try:
            launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            continue

        if launch_time <= now:
            continue  # Already launched

        # Schedule each gate independently
        for gate_name, gate_delta in gates:
            fire_at = launch_time - gate_delta
            _schedule_gate(db, launch_id, gate_name, launch_time, fire_at, now,
                           launch_name, provider, pad_name)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to commit launch reminder records: {e}")


def _schedule_gate(db, launch_id, gate_name, launch_time, fire_at, now,
                   launch_name, provider, pad_name):
    """
    Handle scheduling logic for a single (launch_id, gate) pair.

    Cases:
      - No existing record + fire_at is future: create record, schedule job
      - No existing record + fire_at is past: skip (missed window, don't send late)
      - Record exists with status='sent': skip (already handled)
      - Record exists with same launch_time: skip (already scheduled)
      - Record exists with different launch_time: cancel old job, update, reschedule
    """
    from app.models.astrometrics import AstroLaunchNotification

    existing = AstroLaunchNotification.query.filter_by(
        launch_id=launch_id, gate=gate_name
    ).first()

    if existing:
        if existing.status == 'sent':
            return  # Already delivered

        if existing.status == 'cancelled':
            # Was cancelled (e.g. by settings change), treat as if no record
            # Fall through to create new schedule
            _cancel_scheduler_job(existing.scheduler_job_id)
            db.session.delete(existing)
            db.session.flush()
        elif existing.launch_time == launch_time:
            return  # Same launch time, job already scheduled
        else:
            # Launch was rescheduled — cancel old job and update the record
            _cancel_scheduler_job(existing.scheduler_job_id)

            if fire_at <= now:
                # New fire_at is in the past — mark cancelled, don't send late
                existing.status = 'cancelled'
                existing.launch_time = launch_time
                existing.fire_at = fire_at
                logger.info(f"Launch rescheduled but gate {gate_name} for {launch_name} "
                            f"is now in the past, marking cancelled")
                return

            # Update and reschedule
            job_id = f"launch_reminder_{launch_id}_{gate_name}"
            existing.launch_time = launch_time
            existing.fire_at = fire_at
            existing.scheduler_job_id = job_id
            existing.launch_name = launch_name
            existing.provider = provider
            existing.pad_name = pad_name
            existing.status = 'scheduled'

            _add_reminder_job(job_id, existing.id, fire_at)
            logger.info(f"Rescheduled {gate_name} for {launch_name} to {fire_at.isoformat()}")
            return

    # No existing record (or it was just deleted after cancellation)
    if fire_at <= now:
        # Gate crossing already passed — skip silently
        return

    # Create new record and schedule the job
    job_id = f"launch_reminder_{launch_id}_{gate_name}"
    record = AstroLaunchNotification(
        launch_id=launch_id,
        gate=gate_name,
        launch_time=launch_time,
        fire_at=fire_at,
        scheduler_job_id=job_id,
        status='scheduled',
        launch_name=launch_name,
        provider=provider,
        pad_name=pad_name,
    )
    db.session.add(record)
    db.session.flush()  # Get the record.id for the APScheduler job

    _add_reminder_job(job_id, record.id, fire_at)
    logger.info(f"Scheduled {gate_name} for {launch_name} at {fire_at.isoformat()}")


def _handle_inflight(db, launch_id, launch_name, provider, net, pad_name):
    """
    Handle in-flight detection. Fires immediately (no scheduled job needed).

    Inserts a record with status='sent' to prevent duplicates on subsequent syncs.
    """
    from app.models.astrometrics import AstroLaunchNotification

    existing = AstroLaunchNotification.query.filter_by(
        launch_id=launch_id, gate='inflight'
    ).first()

    if existing:
        return  # Already notified (regardless of status)

    try:
        launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        launch_time = datetime.now(timezone.utc)

    record = AstroLaunchNotification(
        launch_id=launch_id,
        gate='inflight',
        launch_time=launch_time,
        fire_at=None,
        scheduler_job_id=None,
        status='sent',
        launch_name=launch_name,
        provider=provider,
        pad_name=pad_name,
    )
    db.session.add(record)

    _emit_event('astro.launch_inflight',
                launch_name=launch_name,
                provider=provider,
                net=net,
                pad_name=pad_name)


def _add_reminder_job(job_id, notification_id, fire_at):
    """Schedule an APScheduler one-shot job for a launch reminder."""
    try:
        from app.services.scheduler import schedule_launch_reminder
        schedule_launch_reminder(job_id, notification_id, fire_at)
    except Exception as e:
        logger.error(f"Failed to schedule APScheduler job '{job_id}': {e}")


def _cancel_scheduler_job(job_id):
    """Cancel an APScheduler job. Safe if the job doesn't exist."""
    if not job_id:
        return
    try:
        from app.services.scheduler import cancel_launch_reminder
        cancel_launch_reminder(job_id)
    except Exception as e:
        logger.warning(f"Failed to cancel APScheduler job '{job_id}': {e}")


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
