"""
AutoPi Sync Engine

Handles three ingestion paths (mirrors Trak-4 pattern):
  1. Polling — fetches position + OBD data on an interval via /logbook/storage/read/
  2. Webhook — processes real-time pushes from AutoPi output handlers (placeholder)
  3. Backfill — fetches historical data with wider time windows

Data is read from AutoPi's time-series storage using field-based queries.
Position data (track.pos.loc) returns raw records.
OBD data returns aggregated values (10-min intervals by default).
"""
import logging
from datetime import datetime, timedelta

from app import db
from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport, Trak4Geofence
from app.models.autopi import AutoPiOBDSnapshot
from app.models.vehicle import Vehicle
from app.services import autopi_client

logger = logging.getLogger(__name__)

# Default sync interval (seconds) — overridden by AUTOPI_SYNC_INTERVAL config
_DEFAULT_SYNC_INTERVAL = 300


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


def _parse_dt(dt_str):
    """Parse an ISO datetime string into a naive UTC datetime."""
    if not dt_str:
        return None
    try:
        dt_str = dt_str.replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)
        # Strip timezone — store as naive UTC to match PostgreSQL columns
        return dt.replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


# -- Known OBD field metadata --------------------------------------------------
# Maps field names to (field_type, unit) for the storage/read API.
# Fields starting with "obd." are auto-discovered; these cover the non-prefixed ones.
_KNOWN_OBD_FIELDS = {
    'obd.bat.voltage': ('float', 'V'),
    'speed': ('float', 'mph'),
    'rpm': ('float', 'RPM'),
    'odometer': ('float', 'mi'),
    'coolant_temp': ('float', '°F'),
    'engine_load': ('float', '%'),
    'fuel_level': ('float', '%'),
    'intake_temp': ('float', '°F'),
    'ambiant_air_temp': ('float', '°F'),
}


# -- Device Sync ---------------------------------------------------------------

def sync_device():
    """
    Fetch the configured AutoPi device info and upsert into autopi_devices.
    Maps API fields: id→device_id, unit_id, token, display→label,
    hw_revision, release.version→firmware, imei, sim_state.
    """
    try:
        device_uuid = autopi_client._device_id()
        if not device_uuid:
            logger.warning("AutoPi sync skipped: AUTOPI_DEVICE_ID not configured")
            return None

        data = autopi_client._get(f'/dongle/devices/{device_uuid}/')

        device = AutoPiDevice.query.filter_by(device_id=device_uuid).first()
        if not device:
            device = AutoPiDevice(device_id=device_uuid)
            db.session.add(device)

        # Map API response fields to model columns
        device.unit_id = data.get('unit_id')
        device.token = data.get('token')
        device.label = data.get('display')
        device.hw_revision = data.get('hw_revision')
        device.imei = data.get('imei')
        device.sim_state = data.get('sim_state')

        # Firmware version is nested under release.version
        release = data.get('release') or {}
        device.firmware = release.get('version')

        db.session.commit()
        logger.info(f"AutoPi device sync: {device.label or device_uuid} updated")
        return device

    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi device sync failed: {e}")
        return None


# -- Position Sync -------------------------------------------------------------

def sync_positions(device, since=None):
    """
    Fetch GPS position data from AutoPi's time-series storage and store new records.
    Fetches track.pos.loc (geo_point) for lat/lon/heading, then separately fetches
    track.pos.sog (speed), track.pos.alt (altitude), and track.pos.nsat (satellites).
    Deduplicates on (device_id, recorded_at).
    Returns count of new records stored.
    """
    if since is None:
        # If no existing records, look back 24h to bootstrap (same as Trak-4 pattern)
        report_count = AutoPiPositionReport.query.filter_by(device_id=device.id).count()
        if report_count == 0:
            since = _utcnow() - timedelta(hours=24)
        else:
            since = _ensure_naive(device.last_synced_at) or (_utcnow() - timedelta(hours=1))

    device_uuid = autopi_client._device_id()
    from_utc = since.strftime('%Y-%m-%dT%H:%M:%SZ')

    try:
        # 1. Fetch position data (raw geo_point records)
        positions = autopi_client._get('/logbook/storage/read/', params={
            'device_id': device_uuid,
            'from_utc': from_utc,
            'field': 'track.pos.loc',
            'field_type': 'geo_point',
            'size': 500,
        })
    except Exception as e:
        logger.error(f"AutoPi position fetch failed: {e}")
        return 0

    if not positions:
        return 0

    # 2. Fetch supplemental fields (speed, altitude, satellites) in separate calls
    speed_map = _fetch_supplemental_field(device_uuid, from_utc, 'track.pos.sog', 'float')
    alt_map = _fetch_supplemental_field(device_uuid, from_utc, 'track.pos.alt', 'float')
    nsat_map = _fetch_supplemental_field(device_uuid, from_utc, 'track.pos.nsat', 'int')

    # 3. Store position records, deduplicating on (device.id, recorded_at)
    new_count = 0
    latest_lat = None
    latest_lng = None
    latest_time = None

    for pos in positions:
        ts_str = pos.get('ts')
        recorded_at = _parse_dt(ts_str)
        if not recorded_at:
            continue

        loc = pos.get('location') or {}
        lat = loc.get('lat')
        lon = loc.get('lon')
        if lat is None or lon is None:
            continue

        # Deduplicate: check if we already have a report at this exact timestamp
        existing = AutoPiPositionReport.query.filter_by(
            device_id=device.id,
            recorded_at=recorded_at,
        ).first()
        if existing:
            continue

        # Match supplemental data by closest timestamp (within 30s tolerance)
        speed_val = _match_by_timestamp(speed_map, recorded_at, tolerance_s=30)
        alt_val = _match_by_timestamp(alt_map, recorded_at, tolerance_s=30)
        nsat_val = _match_by_timestamp(nsat_map, recorded_at, tolerance_s=30)

        report = AutoPiPositionReport(
            device_id=device.id,
            latitude=lat,
            longitude=lon,
            heading=loc.get('cog'),
            speed=speed_val,
            altitude=alt_val,
            satellites=int(nsat_val) if nsat_val is not None else None,
            recorded_at=recorded_at,
        )
        db.session.add(report)
        new_count += 1

        # Track the latest position for device update
        if latest_time is None or recorded_at > latest_time:
            latest_lat = lat
            latest_lng = lon
            latest_time = recorded_at

    # Update device's last known position
    if latest_lat is not None:
        device.last_latitude = latest_lat
        device.last_longitude = latest_lng
        device.last_report_time = latest_time

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi position commit failed: {e}")
        return 0

    if new_count:
        logger.info(f"AutoPi position sync: {new_count} new report(s) stored")

    # Check geofences after ingesting new positions
    if latest_lat is not None and device.vehicle_id:
        check_geofences_for_vehicle(
            device.vehicle_id,
            latest_lat,
            latest_lng,
            device.label or f'AutoPi {device.device_id[:8]}',
        )

    return new_count


def _fetch_supplemental_field(device_uuid, from_utc, field, field_type):
    """
    Fetch a supplemental time-series field and return a list of (datetime, value) tuples.
    Returns empty list on failure (non-critical — positions still work without these).
    """
    try:
        data = autopi_client._get('/logbook/storage/read/', params={
            'device_id': device_uuid,
            'from_utc': from_utc,
            'field': field,
            'field_type': field_type,
            'size': 500,
        })
        result = []
        for record in (data or []):
            ts = _parse_dt(record.get('ts'))
            val = record.get('value')
            if ts is not None and val is not None:
                result.append((ts, val))
        return result
    except Exception as e:
        logger.warning(f"AutoPi supplemental fetch failed for {field}: {e}")
        return []


def _match_by_timestamp(ts_value_pairs, target_dt, tolerance_s=30):
    """
    Find the value from ts_value_pairs whose timestamp is closest to target_dt,
    within the given tolerance in seconds. Returns None if no match.
    """
    if not ts_value_pairs:
        return None

    best_val = None
    best_delta = None

    for ts, val in ts_value_pairs:
        delta = abs((ts - target_dt).total_seconds())
        if delta <= tolerance_s and (best_delta is None or delta < best_delta):
            best_val = val
            best_delta = delta

    return best_val


# -- OBD Snapshot Sync ---------------------------------------------------------

def sync_obd_snapshots(device, since=None):
    """
    Discover available OBD fields from AutoPi's storage, then fetch and store
    each field's readings as AutoPiOBDSnapshot rows.
    Deduplicates on (device_id, pid_name, recorded_at).
    When odometer data arrives, updates the linked vehicle's current_mileage.
    Returns count of new records stored.
    """
    if since is None:
        # If no existing snapshots, look back 24h to bootstrap
        snapshot_count = AutoPiOBDSnapshot.query.filter_by(device_id=device.id).count()
        if snapshot_count == 0:
            since = _utcnow() - timedelta(hours=24)
        else:
            since = _ensure_naive(device.last_synced_at) or (_utcnow() - timedelta(hours=1))

    device_uuid = autopi_client._device_id()
    from_utc = since.strftime('%Y-%m-%dT%H:%M:%SZ')

    # 1. Discover available fields from the API
    try:
        available_fields = autopi_client._get('/logbook/storage/fields/', params={
            'device_id': device_uuid,
        })
    except Exception as e:
        logger.error(f"AutoPi field discovery failed: {e}")
        return 0

    # 2. Build list of OBD fields to sync (starts with "obd." or is a known field)
    fields_to_sync = []
    for field_info in (available_fields or []):
        name = field_info.get('field', '')
        ftype = field_info.get('type', 'float')

        # Skip position fields — handled by sync_positions
        if name.startswith('track.'):
            continue

        if name.startswith('obd.') or name in _KNOWN_OBD_FIELDS:
            # Use discovered type, fall back to known metadata
            known = _KNOWN_OBD_FIELDS.get(name)
            if known:
                ftype = known[0]
            # Only sync numeric types
            if ftype in ('float', 'int'):
                fields_to_sync.append((name, ftype))

    if not fields_to_sync:
        logger.info("AutoPi OBD sync: no OBD fields available")
        return 0

    # 3. Fetch and store each field's readings
    total_new = 0
    latest_odometer = None

    for field_name, field_type in fields_to_sync:
        try:
            readings = autopi_client._get('/logbook/storage/read/', params={
                'device_id': device_uuid,
                'from_utc': from_utc,
                'field': field_name,
                'field_type': field_type,
                'size': 500,
            })
        except Exception as e:
            logger.warning(f"AutoPi OBD fetch failed for {field_name}: {e}")
            continue

        # Look up unit from known fields metadata
        known = _KNOWN_OBD_FIELDS.get(field_name)
        unit = known[1] if known else None

        for reading in (readings or []):
            ts = _parse_dt(reading.get('ts'))
            value = reading.get('value')
            if ts is None or value is None:
                continue

            # Try to convert to float
            try:
                value_float = float(value)
            except (ValueError, TypeError):
                continue

            # Deduplicate on (device_id, pid_name, recorded_at)
            existing = AutoPiOBDSnapshot.query.filter_by(
                device_id=device.id,
                pid_name=field_name,
                recorded_at=ts,
            ).first()
            if existing:
                continue

            snapshot = AutoPiOBDSnapshot(
                device_id=device.id,
                recorded_at=ts,
                pid_name=field_name,
                value=value_float,
                unit=unit,
                raw_value=str(value),
            )
            db.session.add(snapshot)
            total_new += 1

            # Track latest odometer reading for mileage update
            if field_name == 'odometer':
                if latest_odometer is None or value_float > latest_odometer:
                    latest_odometer = value_float

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi OBD snapshot commit failed: {e}")
        return 0

    if total_new:
        logger.info(f"AutoPi OBD sync: {total_new} new snapshot(s) across {len(fields_to_sync)} field(s)")

    # Update vehicle mileage if odometer data was received
    if latest_odometer is not None:
        _update_vehicle_mileage(device, latest_odometer)

    return total_new


def _update_vehicle_mileage(device, odometer_value):
    """
    If device.vehicle_id is set and odometer_value exceeds the vehicle's
    current_mileage, update it. Commits immediately.
    """
    if not device.vehicle_id:
        return

    try:
        vehicle = Vehicle.query.get(device.vehicle_id)
        if not vehicle:
            return

        current = vehicle.current_mileage or 0
        if odometer_value > current:
            vehicle.current_mileage = odometer_value
            db.session.commit()
            logger.info(f"AutoPi updated mileage for {vehicle.year} {vehicle.make} {vehicle.model}: "
                        f"{current} → {odometer_value}")
    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi mileage update failed: {e}")


# -- Webhook Ingestion (placeholder) ------------------------------------------

def ingest_webhook(payload):
    """
    Process a real-time push from an AutoPi output handler.
    Placeholder — logs the receipt and returns 0.
    """
    logger.info(f"AutoPi webhook received: {type(payload).__name__} payload")
    return 0


# -- Backfill ------------------------------------------------------------------

def backfill_positions(days=7):
    """
    Fetch historical position data going back `days` days.
    Same as sync_positions but with a wider from_utc window.
    Returns count of new records stored.
    """
    device_uuid = autopi_client._device_id()
    if not device_uuid:
        logger.warning("AutoPi backfill skipped: AUTOPI_DEVICE_ID not configured")
        return 0

    device = AutoPiDevice.query.filter_by(device_id=device_uuid).first()
    if not device:
        logger.warning("AutoPi backfill skipped: device not yet synced")
        return 0

    since = _utcnow() - timedelta(days=days)
    logger.info(f"AutoPi backfill: fetching positions from {since} ({days} day(s))")

    count = sync_positions(device, since=since)
    logger.info(f"AutoPi backfill complete: {count} new position(s)")
    return count


# -- Sync Status ---------------------------------------------------------------

def get_sync_status():
    """Return a dict with device info, counts, and last sync time."""
    device_uuid = autopi_client._device_id()
    device = AutoPiDevice.query.filter_by(device_id=device_uuid).first() if device_uuid else None

    position_count = AutoPiPositionReport.query.count()
    obd_count = AutoPiOBDSnapshot.query.count()

    # Positions received today (UTC midnight boundary)
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    positions_today = AutoPiPositionReport.query.filter(
        AutoPiPositionReport.recorded_at >= today_start
    ).count()

    return {
        'device_id': device.device_id if device else None,
        'device_label': device.label if device else None,
        'vehicle_id': device.vehicle_id if device else None,
        'firmware': device.firmware if device else None,
        'last_latitude': device.last_latitude if device else None,
        'last_longitude': device.last_longitude if device else None,
        'last_report_time': device.last_report_time.isoformat() + 'Z' if device and device.last_report_time else None,
        'last_synced_at': device.last_synced_at.isoformat() + 'Z' if device and device.last_synced_at else None,
        'total_positions': position_count,
        'positions_today': positions_today,
        'total_obd_snapshots': obd_count,
    }


# -- Geofence Check ------------------------------------------------------------

def check_geofences_for_vehicle(vehicle_id, lat, lng, device_name):
    """
    Check all enabled geofences where vehicle_id matches.
    Reuses _is_inside_geofence from trak4_sync.py for geometry checks.
    Emits events via event_bus on state transitions.
    """
    if lat is None or lng is None:
        return

    from app.services.event_bus import emit
    from app.services.trak4_sync import _is_inside_geofence

    fences = Trak4Geofence.query.filter(
        Trak4Geofence.enabled == True,
        Trak4Geofence.vehicle_id == vehicle_id,
    ).all()

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

        payload = dict(
            device_name=device_name,
            vehicle_name=device_name,
            zone_name=fence.name,
            zone_id=fence.id,
            latitude=lat,
            longitude=lng,
            position_source='gps',
        )

        if old_state == 'outside' and new_state == 'inside' and fence.alert_on_entry:
            payload['direction'] = 'entered'
            emit('gps.geofence_enter', **payload)
            logger.info(f'Geofence ENTER: {device_name} entered "{fence.name}"')

        elif old_state == 'inside' and new_state == 'outside' and fence.alert_on_exit:
            payload['direction'] = 'exited'
            emit('gps.geofence_exit', **payload)
            logger.info(f'Geofence EXIT: {device_name} exited "{fence.name}"')

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi geofence commit failed: {e}")


# -- Scheduler Integration ----------------------------------------------------

def start_sync_scheduler(app):
    """
    Register the AutoPi sync job with APScheduler.
    Called from create_app() when AUTOPI_API_TOKEN is configured.
    """
    from app.services.scheduler import scheduler

    if not scheduler:
        logger.warning("Scheduler not available, AutoPi sync will not run")
        return

    sync_interval = app.config.get('AUTOPI_SYNC_INTERVAL', _DEFAULT_SYNC_INTERVAL)

    # Run an initial sync on startup (delayed 15s to avoid blocking init)
    scheduler.add_job(
        _run_sync,
        trigger='date',
        id='autopi_sync_startup',
        run_date=_utcnow() + timedelta(seconds=15),
        replace_existing=True,
    )

    # Schedule recurring sync at the configured interval
    scheduler.add_job(
        _run_sync,
        trigger='interval',
        id='autopi_sync',
        seconds=sync_interval,
        replace_existing=True,
    )
    logger.info(f"AutoPi sync scheduled (every {sync_interval}s)")


def _run_sync():
    """Execute device + position + OBD sync inside app context."""
    from app.services.scheduler import _app
    if not _app:
        return

    with _app.app_context():
        try:
            # Capture the sync window BEFORE updating device (which sets last_synced_at to now)
            device = AutoPiDevice.query.first()
            since = _ensure_naive(device.last_synced_at) if device else None

            device = sync_device()
            if device:
                sync_positions(device, since=since)
                sync_obd_snapshots(device, since=since)
                # Update last_synced_at AFTER data is fetched (not before)
                device.last_synced_at = _utcnow()
                db.session.commit()
        except Exception as e:
            logger.error(f"AutoPi sync cycle failed: {e}")
