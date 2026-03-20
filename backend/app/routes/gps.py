"""
GPS Tracking Module - API Routes

Proxies the Trak-4 GPS Tracking REST API and serves cached data from PostgreSQL.
All Trak-4 API calls are made server-side (API key never exposed to clients).

Read endpoints (10):
  GET /devices                     → List all tracked devices
  GET /devices/<id>                → Single device detail
  GET /devices/<id>/reports        → GPS report history (paginated, date-filtered)
  GET /devices/<id>/route          → Optimized route polyline (lightweight)
  GET /devices/<id>/frequencies    → Available reporting frequencies
  GET /tracked-vehicles            → All vehicles with any GPS device (unified)
  GET /autopi/<id>/reports         → AutoPi position report history
  GET /autopi/<id>/route           → AutoPi optimized route polyline
  GET /sync/status                 → Current sync status

Write endpoints (6):
  POST /devices/<id>/assign        → Assign device to a vehicle
  POST /devices/<id>/ping          → Force immediate GPS update
  PUT  /devices/<id>/frequency     → Set reporting frequency
  PUT  /devices/<id>/label         → Set device label
  PUT  /devices/<id>/note          → Set device note
  POST /sync                       → Trigger manual sync/backfill

Webhook endpoint (1):
  POST /webhook/gps_report         → Receives Trak-4 GPS report pushes

Blueprint is registered with url_prefix='/api/gps' in __init__.py.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from app import db
from app.models.gps_tracking import Trak4Device, Trak4Geofence, Trak4GPSReport, Trak4WebhookLog
from app.models.vehicle import Vehicle
from app.services import trak4_client
from app.services.trak4_sync import (
    ingest_webhook_report, sync_devices, sync_reports,
    backfill_reports, get_sync_status,
)

logger = logging.getLogger(__name__)
gps_bp = Blueprint('gps', __name__)


# -- Helpers ------------------------------------------------------------------

def _parse_dt(value):
    """Parse an ISO datetime string into a naive UTC datetime."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    if isinstance(value, str):
        try:
            value = value.replace('Z', '+00:00')
            dt = datetime.fromisoformat(value)
            # Strip timezone — DB columns are naive UTC
            return dt.replace(tzinfo=None)
        except (ValueError, TypeError):
            return None
    return value


def _parse_limit(value, default=500, max_limit=5000):
    """Parse and clamp a limit parameter."""
    try:
        return max(1, min(int(value), max_limit))
    except (ValueError, TypeError):
        return default


# -- Read Endpoints -----------------------------------------------------------

@gps_bp.route('/devices', methods=['GET'])
def list_devices():
    """List all Trak-4 devices with vehicle assignment info.

    Returns: {"devices": [...]}
    """
    devices = Trak4Device.query.order_by(Trak4Device.id).all()
    return jsonify({'devices': [d.to_dict() for d in devices]})


@gps_bp.route('/devices/<int:device_id>', methods=['GET'])
def get_device(device_id):
    """Get a single Trak-4 device by its local DB id.

    Returns: {"device": {...}}
    """
    device = Trak4Device.query.get_or_404(device_id)
    return jsonify({'device': device.to_dict()})


@gps_bp.route('/devices/<int:device_id>/reports', methods=['GET'])
def get_reports(device_id):
    """Get GPS report history for a device.

    Query params:
      - start (ISO datetime) — filter reports on or after this time
      - end (ISO datetime) — filter reports on or before this time
      - limit (int, default 500, max 5000)
      - offset (int, default 0)

    Returns: {"reports": [...], "total": N}
    """
    device = Trak4Device.query.get_or_404(device_id)

    query = Trak4GPSReport.query.filter_by(device_id=device.device_id)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(Trak4GPSReport.received_time >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(Trak4GPSReport.received_time <= end)

    total = query.count()

    limit = _parse_limit(request.args.get('limit', 500))
    try:
        offset = max(0, int(request.args.get('offset', 0)))
    except (ValueError, TypeError):
        offset = 0

    reports = query.order_by(Trak4GPSReport.received_time.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'reports': [r.to_dict() for r in reports],
        'total': total,
    })


@gps_bp.route('/devices/<int:device_id>/route', methods=['GET'])
def get_route(device_id):
    """Get optimized route polyline data for map rendering.

    Uses to_route_point() for lightweight lat/lng/time/speed dicts.

    Query params:
      - start (ISO datetime, required)
      - end (ISO datetime, optional — defaults to now)

    Returns: {"points": [...]}
    """
    device = Trak4Device.query.get_or_404(device_id)

    start = _parse_dt(request.args.get('start'))
    if not start:
        return jsonify({'error': 'start parameter is required'}), 400

    end = _parse_dt(request.args.get('end')) or datetime.utcnow()

    reports = Trak4GPSReport.query.filter_by(device_id=device.device_id) \
        .filter(Trak4GPSReport.received_time >= start) \
        .filter(Trak4GPSReport.received_time <= end) \
        .filter(Trak4GPSReport.latitude.isnot(None)) \
        .order_by(Trak4GPSReport.create_time.asc()) \
        .all()

    return jsonify({
        'points': [r.to_route_point() for r in reports],
    })


@gps_bp.route('/devices/<int:device_id>/frequencies', methods=['GET'])
def get_frequencies(device_id):
    """Get available reporting frequencies for a device.

    Proxies to the Trak-4 API.

    Returns: {"frequencies": [...]}
    """
    device = Trak4Device.query.get_or_404(device_id)

    try:
        frequencies = trak4_client.get_reporting_frequencies(device.device_id)
    except Exception as e:
        logger.error(f"Failed to fetch frequencies for device {device_id}: {e}")
        return jsonify({'error': 'Failed to fetch frequencies from Trak-4'}), 502

    return jsonify({'frequencies': frequencies})


@gps_bp.route('/sync/status', methods=['GET'])
def sync_status():
    """Get current sync status.

    Returns: {"last_synced_at": "ISO", "total_reports": N, "device_count": N, "polling_interval_seconds": N}
    """
    return jsonify(get_sync_status())


# -- Write Endpoints ----------------------------------------------------------

@gps_bp.route('/devices/<int:device_id>/assign', methods=['POST'])
def assign_vehicle(device_id):
    """Assign a Trak-4 device to a vehicle (1:1 mapping).

    Expects: {"vehicle_id": 1}  (or null to unassign)

    Returns: Updated device dict.
    """
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}
    vehicle_id = data.get('vehicle_id')

    if vehicle_id is not None:
        # Verify the vehicle exists
        vehicle = Vehicle.query.get(vehicle_id)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

        # Check no other device is already assigned to this vehicle
        existing = Trak4Device.query.filter(
            Trak4Device.vehicle_id == vehicle_id,
            Trak4Device.id != device_id,
        ).first()
        if existing:
            return jsonify({'error': f'Vehicle is already assigned to device "{existing.label or existing.key_code}"'}), 409

    device.vehicle_id = vehicle_id

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to assign vehicle to device {device_id}: {e}")
        return jsonify({'error': 'Database error assigning vehicle'}), 500

    return jsonify({'device': device.to_dict()})


@gps_bp.route('/devices/<int:device_id>/ping', methods=['POST'])
def ping_device(device_id):
    """Force an immediate GPS update from the device.

    Proxies to Trak-4's /request_update endpoint. This costs device battery,
    so the iOS app should confirm with the user before calling.

    Returns: {"success": true, "message": "..."}
    """
    device = Trak4Device.query.get_or_404(device_id)

    try:
        result = trak4_client.request_update(device.device_id)
        return jsonify({
            'success': True,
            'message': result.get('Message', 'Update requested'),
        })
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to ping device {device_id}: {error_msg}")
        if '400' in error_msg:
            return jsonify({'error': 'This device does not support on-demand location requests'}), 400
        return jsonify({'error': 'Failed to request update from Trak-4'}), 502


@gps_bp.route('/devices/<int:device_id>/frequency', methods=['PUT'])
def set_frequency(device_id):
    """Set a device's reporting frequency.

    Expects: {"frequency_id": 123}

    Proxies to Trak-4 and updates local DB with pending frequency info.

    Returns: Updated device dict.
    """
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}
    frequency_id = data.get('frequency_id')

    if frequency_id is None:
        return jsonify({'error': 'frequency_id is required'}), 400

    try:
        trak4_client.set_reporting_frequency(device.device_id, frequency_id)
    except Exception as e:
        logger.error(f"Failed to set frequency for device {device_id}: {e}")
        return jsonify({'error': 'Failed to set frequency on Trak-4'}), 502

    # Update pending frequency locally (actual change happens on next device check-in)
    device.pending_frequency_id = frequency_id

    # Look up the frequency name from the available list
    try:
        frequencies = trak4_client.get_reporting_frequencies(device.device_id)
        for freq in frequencies:
            if freq.get('ReportingFrequencyID') == frequency_id:
                device.pending_frequency_name = freq.get('Name')
                break
    except Exception:
        pass

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update pending frequency for device {device_id}: {e}")

    return jsonify({'device': device.to_dict()})


@gps_bp.route('/devices/<int:device_id>/label', methods=['PUT'])
def set_label(device_id):
    """Set a device's user-customizable label.

    Expects: {"label": "My Truck Tracker"}

    Updates both Trak-4 API and local DB.

    Returns: Updated device dict.
    """
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}
    label = data.get('label', '')

    try:
        trak4_client.set_device_label(device.device_id, label)
    except Exception as e:
        logger.error(f"Failed to set label for device {device_id}: {e}")
        return jsonify({'error': 'Failed to set label on Trak-4'}), 502

    device.label = label[:64]

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update label for device {device_id}: {e}")

    return jsonify({'device': device.to_dict()})


@gps_bp.route('/devices/<int:device_id>/note', methods=['PUT'])
def set_note(device_id):
    """Set a device's user-customizable note.

    Expects: {"note": "Installed under driver seat"}

    Updates both Trak-4 API and local DB.

    Returns: Updated device dict.
    """
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}
    note = data.get('note', '')

    try:
        trak4_client.set_device_note(device.device_id, note)
    except Exception as e:
        logger.error(f"Failed to set note for device {device_id}: {e}")
        return jsonify({'error': 'Failed to set note on Trak-4'}), 502

    device.note = note[:500]

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update note for device {device_id}: {e}")

    return jsonify({'device': device.to_dict()})


# ── Geofences ──────────────────────────────────────────────

@gps_bp.route('/devices/<int:device_id>/geofences', methods=['GET'])
def list_geofences(device_id):
    """List all geofence zones for a device."""
    device = Trak4Device.query.get_or_404(device_id)
    fences = Trak4Geofence.query.filter_by(device_id=device.id).order_by(Trak4Geofence.created_at.desc()).all()
    return jsonify({'geofences': [f.to_dict() for f in fences]})


@gps_bp.route('/devices/<int:device_id>/geofences', methods=['POST'])
def create_geofence(device_id):
    """Create a new geofence zone."""
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    shape = data.get('shape', 'circle')
    if shape not in ('circle', 'rectangle'):
        return jsonify({'error': 'shape must be circle or rectangle'}), 400

    center_lat = data.get('center_lat')
    center_lng = data.get('center_lng')
    if center_lat is None or center_lng is None:
        return jsonify({'error': 'center_lat and center_lng are required'}), 400

    fence = Trak4Geofence(
        device_id=device.id,
        name=name,
        shape=shape,
        center_lat=float(center_lat),
        center_lng=float(center_lng),
        radius_meters=data.get('radius_meters'),
        width_meters=data.get('width_meters'),
        height_meters=data.get('height_meters'),
        alert_on_entry=data.get('alert_on_entry', True),
        alert_on_exit=data.get('alert_on_exit', True),
        enabled=data.get('enabled', True),
    )
    db.session.add(fence)
    db.session.commit()
    return jsonify({'geofence': fence.to_dict()}), 201


@gps_bp.route('/devices/<int:device_id>/geofences/<int:fence_id>', methods=['PUT'])
def update_geofence(device_id, fence_id):
    """Update a geofence zone."""
    Trak4Device.query.get_or_404(device_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.device_id != device_id:
        return jsonify({'error': 'Geofence does not belong to this device'}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        fence.name = data['name'].strip()
    if 'shape' in data and data['shape'] in ('circle', 'rectangle'):
        fence.shape = data['shape']
    if 'center_lat' in data:
        fence.center_lat = float(data['center_lat'])
    if 'center_lng' in data:
        fence.center_lng = float(data['center_lng'])
    if 'radius_meters' in data:
        fence.radius_meters = data['radius_meters']
    if 'width_meters' in data:
        fence.width_meters = data['width_meters']
    if 'height_meters' in data:
        fence.height_meters = data['height_meters']
    if 'alert_on_entry' in data:
        fence.alert_on_entry = bool(data['alert_on_entry'])
    if 'alert_on_exit' in data:
        fence.alert_on_exit = bool(data['alert_on_exit'])
    if 'enabled' in data:
        fence.enabled = bool(data['enabled'])

    db.session.commit()
    return jsonify({'geofence': fence.to_dict()})


@gps_bp.route('/devices/<int:device_id>/geofences/<int:fence_id>', methods=['DELETE'])
def delete_geofence(device_id, fence_id):
    """Delete a geofence zone."""
    Trak4Device.query.get_or_404(device_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.device_id != device_id:
        return jsonify({'error': 'Geofence does not belong to this device'}), 404

    db.session.delete(fence)
    db.session.commit()
    return jsonify({'success': True})


# ── Vehicle-Scoped Geofences (device-agnostic) ──────────────────

@gps_bp.route('/vehicles/<int:vehicle_id>/geofences', methods=['GET'])
def list_vehicle_geofences(vehicle_id):
    """List all geofence zones for a vehicle (works with any device type)."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    fences = Trak4Geofence.query.filter_by(vehicle_id=vehicle.id).order_by(Trak4Geofence.created_at.desc()).all()
    return jsonify({'geofences': [f.to_dict() for f in fences]})


@gps_bp.route('/vehicles/<int:vehicle_id>/geofences', methods=['POST'])
def create_vehicle_geofence(vehicle_id):
    """Create a new geofence zone for a vehicle (device-agnostic)."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json(silent=True) or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    shape = data.get('shape', 'circle')
    if shape not in ('circle', 'rectangle'):
        return jsonify({'error': 'shape must be circle or rectangle'}), 400

    center_lat = data.get('center_lat')
    center_lng = data.get('center_lng')
    if center_lat is None or center_lng is None:
        return jsonify({'error': 'center_lat and center_lng are required'}), 400

    fence = Trak4Geofence(
        vehicle_id=vehicle.id,
        name=name,
        shape=shape,
        center_lat=float(center_lat),
        center_lng=float(center_lng),
        radius_meters=data.get('radius_meters'),
        width_meters=data.get('width_meters'),
        height_meters=data.get('height_meters'),
        alert_on_entry=data.get('alert_on_entry', True),
        alert_on_exit=data.get('alert_on_exit', True),
        enabled=data.get('enabled', True),
    )
    db.session.add(fence)
    db.session.commit()
    return jsonify({'geofence': fence.to_dict()}), 201


@gps_bp.route('/vehicles/<int:vehicle_id>/geofences/<int:fence_id>', methods=['PUT'])
def update_vehicle_geofence(vehicle_id, fence_id):
    """Update a vehicle-scoped geofence zone."""
    Vehicle.query.get_or_404(vehicle_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.vehicle_id != vehicle_id:
        return jsonify({'error': 'Geofence does not belong to this vehicle'}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        fence.name = data['name'].strip()
    if 'shape' in data and data['shape'] in ('circle', 'rectangle'):
        fence.shape = data['shape']
    if 'center_lat' in data:
        fence.center_lat = float(data['center_lat'])
    if 'center_lng' in data:
        fence.center_lng = float(data['center_lng'])
    if 'radius_meters' in data:
        fence.radius_meters = data['radius_meters']
    if 'width_meters' in data:
        fence.width_meters = data['width_meters']
    if 'height_meters' in data:
        fence.height_meters = data['height_meters']
    if 'alert_on_entry' in data:
        fence.alert_on_entry = bool(data['alert_on_entry'])
    if 'alert_on_exit' in data:
        fence.alert_on_exit = bool(data['alert_on_exit'])
    if 'enabled' in data:
        fence.enabled = bool(data['enabled'])

    db.session.commit()
    return jsonify({'geofence': fence.to_dict()})


@gps_bp.route('/vehicles/<int:vehicle_id>/geofences/<int:fence_id>', methods=['DELETE'])
def delete_vehicle_geofence(vehicle_id, fence_id):
    """Delete a vehicle-scoped geofence zone."""
    Vehicle.query.get_or_404(vehicle_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.vehicle_id != vehicle_id:
        return jsonify({'error': 'Geofence does not belong to this vehicle'}), 404

    db.session.delete(fence)
    db.session.commit()
    return jsonify({'success': True})


# ── Tracked Vehicles (unified, device-agnostic) ─────────────────

@gps_bp.route('/tracked-vehicles', methods=['GET'])
def tracked_vehicles():
    """List all vehicles with a GPS tracking device assigned.

    Returns unified list regardless of device type (Trak-4 or AutoPi).
    The Apple app's vehicle selector uses this.

    Returns: {"vehicles": [...]}
    """
    from app.models.gps_tracking import AutoPiDevice

    vehicles = []

    # Trak-4 devices with vehicle assigned
    for device in Trak4Device.query.filter(Trak4Device.vehicle_id.isnot(None)).all():
        vehicles.append({
            'vehicle_id': device.vehicle_id,
            'vehicle_name': f"{device.vehicle.year} {device.vehicle.make} {device.vehicle.model}".strip() if device.vehicle else None,
            'vehicle_type': device.vehicle.vehicle_type if device.vehicle else None,
            'device_type': 'trak4',
            'device_id': device.id,
            'latitude': device.last_latitude,
            'longitude': device.last_longitude,
            'last_report_time': device.last_report_time.isoformat() + 'Z' if device.last_report_time else None,
        })

    # AutoPi devices with vehicle assigned
    for device in AutoPiDevice.query.filter(AutoPiDevice.vehicle_id.isnot(None)).all():
        vehicles.append({
            'vehicle_id': device.vehicle_id,
            'vehicle_name': f"{device.vehicle.year} {device.vehicle.make} {device.vehicle.model}".strip() if device.vehicle else None,
            'vehicle_type': device.vehicle.vehicle_type if device.vehicle else None,
            'device_type': 'autopi',
            'device_id': device.id,
            'latitude': device.last_latitude,
            'longitude': device.last_longitude,
            'last_report_time': device.last_report_time.isoformat() + 'Z' if device.last_report_time else None,
        })

    return jsonify({'vehicles': vehicles})


# ── AutoPi Position Endpoints ───────────────────────────────────

@gps_bp.route('/autopi/<int:device_id>/reports', methods=['GET'])
def get_autopi_reports(device_id):
    """Get position report history for an AutoPi device.

    Query params:
      - start (ISO datetime) — filter reports on or after this time
      - end (ISO datetime) — filter reports on or before this time
      - limit (int, default 500, max 5000)
      - offset (int, default 0)

    Returns: {"reports": [...], "total": N}
    """
    from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport

    device = AutoPiDevice.query.get_or_404(device_id)
    query = AutoPiPositionReport.query.filter_by(device_id=device.id)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(AutoPiPositionReport.recorded_at >= start)
    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(AutoPiPositionReport.recorded_at <= end)

    total = query.count()
    limit = _parse_limit(request.args.get('limit', 500))
    offset = max(0, request.args.get('offset', 0, type=int))

    reports = query.order_by(AutoPiPositionReport.recorded_at.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({'reports': [r.to_dict() for r in reports], 'total': total})


@gps_bp.route('/autopi/<int:device_id>/route', methods=['GET'])
def get_autopi_route(device_id):
    """Get optimized route polyline data for an AutoPi device.

    Uses to_route_point() for lightweight lat/lng/time/speed dicts.

    Query params:
      - start (ISO datetime, required)
      - end (ISO datetime, optional — defaults to now)

    Returns: {"points": [...]}
    """
    from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport

    device = AutoPiDevice.query.get_or_404(device_id)

    start = _parse_dt(request.args.get('start'))
    if not start:
        return jsonify({'error': 'start parameter is required'}), 400
    end = _parse_dt(request.args.get('end')) or datetime.utcnow()

    reports = AutoPiPositionReport.query.filter_by(device_id=device.id) \
        .filter(AutoPiPositionReport.recorded_at >= start) \
        .filter(AutoPiPositionReport.recorded_at <= end) \
        .filter(AutoPiPositionReport.latitude.isnot(None)) \
        .order_by(AutoPiPositionReport.recorded_at.asc()) \
        .all()

    return jsonify({'points': [r.to_route_point() for r in reports]})


@gps_bp.route('/sync', methods=['POST'])
def trigger_sync():
    """Trigger a manual sync of devices and reports.

    Optional body: {"backfill": true} to also run historical backfill.

    Returns: {"success": true, "message": "..."}
    """
    data = request.get_json(silent=True) or {}
    do_backfill = data.get('backfill', False)

    try:
        sync_devices()
        sync_reports()

        if do_backfill:
            devices = Trak4Device.query.all()
            total_new = 0
            for device in devices:
                total_new += backfill_reports(device.device_id)
            return jsonify({
                'success': True,
                'message': f'Sync complete. Backfill added {total_new} historical report(s).',
            })

        return jsonify({
            'success': True,
            'message': 'Sync complete.',
        })
    except Exception as e:
        logger.error(f"Manual sync failed: {e}")
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


# -- Debug Endpoint (temporary) ------------------------------------------------

@gps_bp.route('/debug/raw-device', methods=['GET'])
def debug_raw_device():
    """Fetch raw Trak-4 device_list API response for debugging. Temporary."""
    try:
        import requests as req
        from app.services.trak4_client import _api_key, _base_url

        body = {'APIKey': _api_key()}
        resp = req.post(f"{_base_url()}/device_list", json=body, timeout=15)
        return jsonify({'raw_response': resp.json()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@gps_bp.route('/debug/raw-reports', methods=['GET'])
def debug_raw_reports():
    """Fetch raw Trak-4 gps_report_list API response for debugging. Temporary.

    Query params:
      - device_id (int, required) — Trak-4 DeviceID
      - hours (int, default 24) — how many hours back to query
    """
    try:
        import requests as req
        from app.services.trak4_client import _api_key, _base_url

        device_id = request.args.get('device_id', type=int)
        if not device_id:
            return jsonify({'error': 'device_id query param is required'}), 400

        hours = request.args.get('hours', 24, type=int)
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(hours=hours)

        body = {
            'APIKey': _api_key(),
            'DeviceID': device_id,
            'DateTime_Start': start_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'DateTime_End': end_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'FilterByReceivedTime': True,
        }
        resp = req.post(f"{_base_url()}/gps_report_list", json=body, timeout=15)
        return jsonify({'raw_response': resp.json()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# -- Webhook Endpoint ---------------------------------------------------------

@gps_bp.route('/webhook/gps_report', methods=['POST'])
def webhook_gps_report():
    """Receive GPS report pushes from Trak-4.

    Trak-4 webhook format (per their docs):
      {"EventType": "gps_report", "GPS_Report": {...}, "Mode": "live"}

    Also handles legacy batch format: {"GPSReports": [...]}
    and bare single-report format: {"ReportID": ..., ...}

    Protected by Cloudflare Access bypass (only this path is open).
    Every delivery is logged to trak4_webhook_logs for debugging.
    Returns: 200 with count of new reports ingested.
    """
    payload = request.get_json(silent=True) or {}

    # -- Extract report(s) from the payload -----------------------------------
    reports = []

    # Trak-4 documented format: single report under "GPS_Report" key
    if payload.get('GPS_Report') and isinstance(payload['GPS_Report'], dict):
        reports = [payload['GPS_Report']]
    # Legacy batch format: array under "GPSReports" or "GPS_Reports"
    elif payload.get('GPSReports'):
        reports = payload['GPSReports']
    elif payload.get('GPS_Reports') and isinstance(payload['GPS_Reports'], list):
        reports = payload['GPS_Reports']
    # Bare single-report format (report fields at top level)
    elif payload.get('ReportID'):
        reports = [payload]

    new_count = 0
    error_messages = []
    for report_data in reports:
        try:
            if ingest_webhook_report(report_data):
                new_count += 1
        except Exception as e:
            error_messages.append(str(e))
            logger.error(f"Webhook report ingestion error: {e}")

    # -- Log the delivery -----------------------------------------------------
    log_entry = Trak4WebhookLog(
        source_ip=request.remote_addr,
        success=len(error_messages) == 0,
        report_count=len(reports),
        new_count=new_count,
        error_message='; '.join(error_messages) if error_messages else None,
        event_type=payload.get('EventType'),
        mode=payload.get('Mode'),
        raw_payload=json.dumps(payload)[:10000],  # cap at 10KB
    )
    db.session.add(log_entry)
    db.session.commit()

    logger.info(f"Webhook received {len(reports)} report(s), {new_count} new")

    return jsonify({
        'received': len(reports),
        'new': new_count,
    })


# -- Webhook Log Endpoint -----------------------------------------------------

@gps_bp.route('/webhook/logs', methods=['GET'])
def webhook_logs():
    """List webhook delivery logs, newest-first.

    Query params:
      - limit (int, default 50, max 200)
      - offset (int, default 0)

    Returns: {logs: [...], total: int, stats: {total_deliveries, success_count,
              fail_count, success_rate, last_received_at}}
    """
    limit = min(request.args.get('limit', 50, type=int), 200)
    offset = request.args.get('offset', 0, type=int)

    query = Trak4WebhookLog.query.order_by(Trak4WebhookLog.received_at.desc())
    total = query.count()
    logs = query.offset(offset).limit(limit).all()

    # Summary stats
    success_count = Trak4WebhookLog.query.filter_by(success=True).count()
    fail_count = total - success_count
    latest = Trak4WebhookLog.query.order_by(Trak4WebhookLog.received_at.desc()).first()

    return jsonify({
        'logs': [log.to_dict() for log in logs],
        'total': total,
        'stats': {
            'total_deliveries': total,
            'success_count': success_count,
            'fail_count': fail_count,
            'success_rate': round(success_count / total * 100, 1) if total > 0 else 0,
            'last_received_at': latest.received_at.isoformat() + 'Z' if latest else None,
        },
    })
