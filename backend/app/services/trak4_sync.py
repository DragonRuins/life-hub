"""
Trak-4 GPS Sync Engine

Handles three ingestion paths:
  1. Adaptive polling — fetches device_list + gps_report_list on an interval
     that adapts to the device's configured reporting frequency.
  2. Webhook ingestion — processes real-time GPS report pushes from Trak-4.
  3. Manual backfill — walks backward through time in 24h chunks to build
     a complete historical record.

All reports are deduplicated on report_id (Trak-4's unique ReportID).
"""
import logging
import math
from datetime import datetime, timedelta, timezone

from app import db


def _utcnow():
    """Return current UTC time as a naive datetime (matches PostgreSQL storage)."""
    return datetime.utcnow()


def _ensure_naive(dt):
    """Strip timezone info from a datetime so comparisons work with naive DB values."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt
from app.models.gps_tracking import Trak4Device, Trak4GPSReport, Trak4WebhookLog
from app.services import trak4_client

logger = logging.getLogger(__name__)

# Default poll interval (seconds) — used until we know the device's frequency
_DEFAULT_POLL_INTERVAL = 660  # 11 minutes

# Current adaptive poll interval (seconds), updated when frequency changes
_poll_interval = _DEFAULT_POLL_INTERVAL


def get_poll_interval():
    """Return the current adaptive poll interval in seconds."""
    return _poll_interval


# -- Device Sync --------------------------------------------------------------

def sync_devices():
    """
    Poll Trak-4's /device_list and upsert all devices into trak4_devices.
    Updates last known position and frequency info from the API response.
    """
    try:
        page = 1
        total_pages = 1
        synced = 0

        while page <= total_pages:
            devices, total_pages = trak4_client.get_device_list(page=page)

            for dev_data in devices:
                device_id = dev_data.get('DeviceID')
                if not device_id:
                    continue

                device = Trak4Device.query.filter_by(device_id=device_id).first()
                if not device:
                    device = Trak4Device(device_id=device_id)
                    db.session.add(device)

                # Update fields from API response
                device.key_code = dev_data.get('KeyCode')
                device.label = dev_data.get('Label')
                device.note = dev_data.get('Note')
                device.imei = dev_data.get('IMEI')
                device.firmware = dev_data.get('Firmware')
                device.generation = dev_data.get('Generation')
                device.product_id = dev_data.get('ProductID')
                device.product_name = dev_data.get('ProductName')
                device.image_url = dev_data.get('ImageURL')

                # Reporting frequency (flat fields on device object)
                device.reporting_frequency_id = dev_data.get('ReportingFrequencyID_Current')
                device.reporting_frequency_name = dev_data.get('ReportingFrequency_Current')
                device.pending_frequency_id = dev_data.get('ReportingFrequencyID_Pending')
                device.pending_frequency_name = dev_data.get('ReportingFrequency_Pending')

                # Last known position (flat LastReport_* fields on device object)
                lat = _sanitize_coord(dev_data.get('LastReport_Latitude'))
                lng = _sanitize_coord(dev_data.get('LastReport_Longitude'))
                if lat is not None and lng is not None:
                    device.last_latitude = lat
                    device.last_longitude = lng
                    device.last_position_source = _map_position_source(dev_data.get('LastReport_PositionSource'))
                    device.last_voltage = dev_data.get('LastReport_Voltage')
                    device.last_voltage_percent = dev_data.get('LastReport_VoltagePercent')
                    device.last_report_time = _parse_dt(dev_data.get('LastReport_CreateTime'))
                    device.last_received_time = _parse_dt(dev_data.get('LastReport_ReceivedTime'))

                # Only set last_synced_at for NEW devices (24h ago so first report sync has a window)
                # sync_reports() updates last_synced_at after fetching reports
                if device.last_synced_at is None:
                    device.last_synced_at = _utcnow() - timedelta(hours=24)
                synced += 1

            page += 1

        db.session.commit()
        logger.info(f"Trak-4 device sync: {synced} device(s) synced")

        # Check geofences and battery alerts for all synced devices
        for device in Trak4Device.query.all():
            check_geofences(device, device.last_latitude, device.last_longitude)
            check_battery_alerts(device, device.last_voltage_percent)

        # Update adaptive poll interval based on device frequencies
        _update_poll_interval()

    except Exception as e:
        db.session.rollback()
        logger.error(f"Trak-4 device sync failed: {e}")


# -- Report Sync --------------------------------------------------------------

def sync_reports():
    """
    For each device, fetch new GPS reports since the last sync and store them.
    Deduplicates on report_id.
    """
    devices = Trak4Device.query.all()
    total_new = 0

    for device in devices:
        try:
            # Fetch reports since last sync (or last 24h if never synced)
            since = _ensure_naive(device.last_synced_at) or (_utcnow() - timedelta(hours=24))

            # If device has no reports yet, always look back 24h to bootstrap
            report_count = Trak4GPSReport.query.filter_by(device_id=device.device_id).count()
            if report_count == 0:
                since = _utcnow() - timedelta(hours=24)
            now = _utcnow()

            new_count = _fetch_and_store_reports(device.device_id, since, now)
            total_new += new_count

            device.last_synced_at = now

            # Check geofences and battery after ingesting new reports
            check_geofences(device, device.last_latitude, device.last_longitude)
            check_battery_alerts(device, device.last_voltage_percent)

        except Exception as e:
            logger.error(f"Report sync failed for device {device.device_id}: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Report sync commit failed: {e}")

    if total_new:
        logger.info(f"Trak-4 report sync: {total_new} new report(s) stored")


def _fetch_and_store_reports(trak4_device_id, start_dt, end_dt):
    """
    Fetch GPS reports from Trak-4 for a time range and store new ones.
    Handles the 24h window limitation by chunking if needed.
    Returns count of new reports stored.
    """
    new_count = 0
    current_start = start_dt

    while current_start < end_dt:
        # Trak-4 clamps to 24h windows
        chunk_end = min(current_start + timedelta(hours=24), end_dt)

        try:
            reports = trak4_client.get_gps_reports(trak4_device_id, current_start, chunk_end)
        except Exception as e:
            logger.error(f"Failed to fetch reports for device {trak4_device_id} "
                         f"({current_start} to {chunk_end}): {e}")
            break

        logger.info(f"Trak-4 API returned {len(reports)} report(s) for device {trak4_device_id} "
                     f"({current_start} to {chunk_end})")

        for report_data in reports:
            report_id = str(report_data.get('ReportID', ''))
            if not report_id:
                continue

            # Deduplicate on report_id
            existing = Trak4GPSReport.query.filter_by(report_id=report_id).first()
            if existing:
                continue

            report = _parse_report(trak4_device_id, report_data)
            db.session.add(report)
            new_count += 1

        current_start = chunk_end

    return new_count


# -- Backfill ------------------------------------------------------------------

def backfill_reports(trak4_device_id):
    """
    Walk backward through time in 24h chunks until the API returns no reports.
    Builds a complete historical record for a device.
    Returns total count of new reports stored.
    """
    total_new = 0
    end_dt = _utcnow()

    # Find the earliest report we already have — start backfill from there
    earliest = Trak4GPSReport.query.filter_by(device_id=trak4_device_id)\
        .order_by(Trak4GPSReport.received_time.asc()).first()

    if earliest and earliest.received_time:
        end_dt = earliest.received_time

    logger.info(f"Trak-4 backfill starting for device {trak4_device_id}, walking back from {end_dt}")

    # Walk backward in 24h chunks
    max_iterations = 365  # Safety limit (1 year max)
    empty_chunks = 0
    for i in range(max_iterations):
        start_dt = end_dt - timedelta(hours=24)

        try:
            reports = trak4_client.get_gps_reports(trak4_device_id, start_dt, end_dt)
        except Exception as e:
            logger.info(f"Trak-4 backfill chunk {i} error (stopping): {e}")
            break

        logger.info(f"Trak-4 backfill chunk {i}: {start_dt} to {end_dt} -> {len(reports)} report(s)")

        if not reports:
            empty_chunks += 1
            # Stop after 3 consecutive empty chunks (allows gaps in data)
            if empty_chunks >= 3:
                break
            end_dt = start_dt
            continue

        empty_chunks = 0

        chunk_new = 0
        for report_data in reports:
            report_id = str(report_data.get('ReportID', ''))
            if not report_id:
                continue

            existing = Trak4GPSReport.query.filter_by(report_id=report_id).first()
            if existing:
                continue

            report = _parse_report(trak4_device_id, report_data)
            db.session.add(report)
            chunk_new += 1

        total_new += chunk_new

        # Commit each chunk to avoid huge transactions
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Backfill commit failed: {e}")
            break

        end_dt = start_dt

    logger.info(f"Trak-4 backfill for device {trak4_device_id}: {total_new} new report(s)")
    return total_new


# -- Webhook Ingestion ---------------------------------------------------------

def ingest_webhook_report(payload):
    """
    Process a single GPS report pushed via the Trak-4 webhook.
    Deduplicates on report_id. Also updates the device's last known position.
    Returns True if the report was new, False if duplicate.
    """
    report_id = str(payload.get('ReportID', ''))
    if not report_id:
        return False

    # Deduplicate
    existing = Trak4GPSReport.query.filter_by(report_id=report_id).first()
    if existing:
        return False

    device_id = payload.get('DeviceID')
    if not device_id:
        return False

    # Store the report
    report = _parse_report(device_id, payload)
    db.session.add(report)

    # Update the device's last known position
    device = Trak4Device.query.filter_by(device_id=device_id).first()
    if device:
        if report.latitude is not None:
            device.last_latitude = report.latitude
            device.last_longitude = report.longitude
            device.last_position_source = report.position_source
        device.last_voltage = report.voltage
        device.last_voltage_percent = report.voltage_percent
        device.last_report_time = report.create_time
        device.last_received_time = report.received_time

        # Check geofences and battery on webhook report
        check_geofences(device, device.last_latitude, device.last_longitude)
        check_battery_alerts(device, device.last_voltage_percent)

    try:
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        logger.error(f"Webhook report ingestion failed: {e}")
        return False


# -- Sync Status ---------------------------------------------------------------

def get_sync_status():
    """Return current sync status for the API."""
    device_count = Trak4Device.query.count()
    total_reports = Trak4GPSReport.query.count()

    # Reports received today (UTC midnight boundary)
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    reports_today = Trak4GPSReport.query.filter(
        Trak4GPSReport.received_time >= today_start
    ).count()

    # Most recent sync time across all devices
    latest_device = Trak4Device.query.order_by(
        Trak4Device.last_synced_at.desc()
    ).first()
    last_synced = latest_device.last_synced_at if latest_device else None

    return {
        'last_synced_at': last_synced.isoformat() if last_synced else None,
        'total_reports': total_reports,
        'reports_today': reports_today,
        'device_count': device_count,
        'polling_interval_seconds': _poll_interval,
    }


# -- Scheduler Integration ----------------------------------------------------

def start_sync_scheduler(app):
    """
    Register the Trak-4 sync job with APScheduler.
    Called from create_app() when TRAK4_API_KEY is configured.
    """
    from app.services.scheduler import scheduler

    if not scheduler:
        logger.warning("Scheduler not available, Trak-4 sync will not run")
        return

    # Run an initial sync on startup (delayed 10s to avoid blocking init)
    scheduler.add_job(
        _run_sync,
        trigger='date',
        id='trak4_sync_startup',
        run_date=_utcnow() + timedelta(seconds=10),
        replace_existing=True,
    )

    # Schedule recurring sync with the default interval
    scheduler.add_job(
        _run_sync,
        trigger='interval',
        id='trak4_sync',
        seconds=_DEFAULT_POLL_INTERVAL,
        replace_existing=True,
    )
    logger.info(f"Trak-4 sync scheduled (every {_DEFAULT_POLL_INTERVAL}s)")


def _run_sync():
    """Execute device + report sync inside app context."""
    from app.services.scheduler import _app
    if not _app:
        return

    with _app.app_context():
        try:
            sync_devices()
            sync_reports()
            purge_old_webhook_logs()
        except Exception as e:
            logger.error(f"Trak-4 sync cycle failed: {e}")


def purge_old_webhook_logs(days=30):
    """Delete webhook log entries older than `days` days."""
    cutoff = _utcnow() - timedelta(days=days)
    deleted = Trak4WebhookLog.query.filter(Trak4WebhookLog.received_at < cutoff).delete()
    if deleted:
        db.session.commit()
        logger.info(f"Purged {deleted} webhook log(s) older than {days} days")


def _update_poll_interval():
    """
    Adjust the poll interval based on the fastest device reporting frequency.
    Adds a 60-second buffer. Floor: 60s, ceiling: 3600s.
    """
    global _poll_interval

    devices = Trak4Device.query.filter(
        Trak4Device.reporting_frequency_name.isnot(None)
    ).all()

    if not devices:
        return

    # Find the shortest reporting interval across all devices
    intervals = []
    for d in devices:
        secs = trak4_client.parse_reporting_interval_seconds(d.reporting_frequency_name)
        intervals.append(secs)

    if not intervals:
        return

    shortest = min(intervals)
    new_interval = max(60, min(3600, shortest + 60))  # floor 60s, ceiling 3600s

    if new_interval != _poll_interval:
        logger.info(f"Trak-4 poll interval adjusted: {_poll_interval}s -> {new_interval}s")
        _poll_interval = new_interval

        # Reschedule the APScheduler job with the new interval
        try:
            from app.services.scheduler import scheduler
            if scheduler:
                scheduler.reschedule_job(
                    'trak4_sync',
                    trigger='interval',
                    seconds=new_interval,
                )
        except Exception as e:
            logger.error(f"Failed to reschedule Trak-4 sync job: {e}")


# -- Helpers -------------------------------------------------------------------

def _sanitize_coord(value):
    """Return None for Trak-4's -360 sentinel (no GPS fix), else the value."""
    if value is None or value == -360 or value == -360.0:
        return None
    return value


def _parse_report(trak4_device_id, data):
    """Parse a Trak-4 API GPS report dict into a Trak4GPSReport model."""
    return Trak4GPSReport(
        device_id=trak4_device_id,
        report_id=str(data.get('ReportID', '')),
        latitude=_sanitize_coord(data.get('Latitude')),
        longitude=_sanitize_coord(data.get('Longitude')),
        heading=data.get('Heading'),
        speed=data.get('Speed'),
        temperature=data.get('Temperature'),
        voltage=data.get('Voltage'),
        voltage_percent=data.get('VoltagePercent'),
        hdop=data.get('HDOP'),
        rssi=data.get('RSSI'),
        accuracy=data.get('Accuracy'),
        position_source=_map_position_source(data.get('PositionSource')),
        device_state=data.get('DeviceState'),
        report_reason=data.get('ReportReason'),
        reporting_frequency=data.get('ReportingFrequency'),
        create_time=_parse_dt(data.get('CreateTime')),
        received_time=_parse_dt(data.get('ReceivedTime')),
    )


def _parse_dt(dt_str):
    """Parse a Trak-4 datetime string into a naive UTC datetime."""
    if not dt_str:
        return None
    try:
        # Trak-4 uses ISO format, sometimes with 'Z' suffix
        dt_str = dt_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)
        # Strip timezone — store as naive UTC to match PostgreSQL columns
        return dt.replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def _map_position_source(source_id):
    """Map Trak-4 PositionSource integer to a human-readable string."""
    mapping = {
        0: 'none',
        1: 'gps',
        2: 'wifi',
        3: 'cell',
        4: 'bluetooth',
    }
    if isinstance(source_id, int):
        return mapping.get(source_id, 'unknown')
    if isinstance(source_id, str):
        return source_id.lower()
    return 'unknown'


# ── Geofence + Battery Alert Checks ──────────────────────────────

def _haversine_meters(lat1, lng1, lat2, lng2):
    """Calculate distance in meters between two lat/lng points using haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_in_rect(lat, lng, center_lat, center_lng, width_m, height_m):
    """Check if a point is inside a rectangle defined by center + width/height in meters."""
    lat_deg_per_m = 1.0 / 111320.0
    lng_deg_per_m = 1.0 / (111320.0 * math.cos(math.radians(center_lat)))
    half_h = (height_m / 2.0) * lat_deg_per_m
    half_w = (width_m / 2.0) * lng_deg_per_m
    return (center_lat - half_h <= lat <= center_lat + half_h and
            center_lng - half_w <= lng <= center_lng + half_w)


def _is_inside_geofence(lat, lng, fence):
    """Check if a point is inside a geofence zone."""
    if fence.shape == 'circle':
        dist = _haversine_meters(lat, lng, fence.center_lat, fence.center_lng)
        return dist <= (fence.radius_meters or 0)
    elif fence.shape == 'rectangle':
        return _point_in_rect(lat, lng, fence.center_lat, fence.center_lng,
                              fence.width_meters or 0, fence.height_meters or 0)
    return False


def check_geofences(device, lat, lng):
    """Check all enabled geofences for a device and emit events on state transitions."""
    if lat is None or lng is None:
        return

    from app.models.gps_tracking import Trak4Geofence
    from app.services.event_bus import emit

    fences = Trak4Geofence.query.filter(
        Trak4Geofence.enabled == True,
        db.or_(
            Trak4Geofence.device_id == device.id,
            Trak4Geofence.vehicle_id == device.vehicle_id,
        )
    ).all() if device.vehicle_id else Trak4Geofence.query.filter_by(device_id=device.id, enabled=True).all()
    for fence in fences:
        inside = _is_inside_geofence(lat, lng, fence)
        new_state = 'inside' if inside else 'outside'

        # First check — set state without alerting
        if fence.last_state is None:
            fence.last_state = new_state
            continue

        # No transition — skip
        if fence.last_state == new_state:
            continue

        old_state = fence.last_state
        fence.last_state = new_state

        device_name = device.label or device.key_code or f'Device {device.device_id}'
        payload = dict(
            device_name=device_name,
            device_id=device.id,
            vehicle_name=device_name,
            zone_name=fence.name,
            zone_id=fence.id,
            latitude=lat,
            longitude=lng,
            position_source=device.last_position_source,
        )

        if old_state == 'outside' and new_state == 'inside' and fence.alert_on_entry:
            payload['direction'] = 'entered'
            emit('gps.geofence_enter', **payload)
            logger.info(f'Geofence ENTER: {device_name} entered "{fence.name}"')

        elif old_state == 'inside' and new_state == 'outside' and fence.alert_on_exit:
            payload['direction'] = 'exited'
            emit('gps.geofence_exit', **payload)
            logger.info(f'Geofence EXIT: {device_name} exited "{fence.name}"')

    db.session.commit()


# Module-level dict to track last alert times per device per tier
_battery_alert_cache = {}  # key: (device_id, tier) -> value: datetime

BATTERY_TIERS = [
    (5,  'dead',     'gps.battery_dead'),
    (10, 'critical', 'gps.battery_critical'),
    (20, 'low',      'gps.battery_low'),
]
BATTERY_COOLDOWN_HOURS = 6


def check_battery_alerts(device, battery_percent):
    """Check battery level against predefined tiers and emit events with cooldown."""
    if battery_percent is None:
        return

    from app.services.event_bus import emit

    device_name = device.label or device.key_code or f'Device {device.device_id}'
    now = datetime.utcnow()

    for threshold, tier, event_name in BATTERY_TIERS:
        if battery_percent <= threshold:
            cache_key = (device.id, tier)
            last_alert = _battery_alert_cache.get(cache_key)

            if last_alert and (now - last_alert).total_seconds() < BATTERY_COOLDOWN_HOURS * 3600:
                break  # Already alerted this tier recently

            _battery_alert_cache[cache_key] = now
            emit(event_name,
                 device_name=device_name,
                 device_id=device.id,
                 vehicle_name=device_name,
                 battery_percent=battery_percent,
                 voltage=device.last_voltage,
                 tier=tier)
            logger.info(f'Battery {tier}: {device_name} at {battery_percent}%')
            break  # Only fire the lowest matching tier
