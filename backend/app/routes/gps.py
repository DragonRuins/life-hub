"""
GPS Tracking Module - API Routes

Proxies the Trak-4 GPS Tracking REST API and serves cached data from PostgreSQL.
All Trak-4 API calls are made server-side (API key never exposed to clients).

Read endpoints (6):
  GET /devices                     → List all tracked devices
  GET /devices/<id>                → Single device detail
  GET /devices/<id>/reports        → GPS report history (paginated, date-filtered)
  GET /devices/<id>/route          → Optimized route polyline (lightweight)
  GET /devices/<id>/frequencies    → Available reporting frequencies
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
import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from app import db
from app.models.gps_tracking import Trak4Device, Trak4GPSReport
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
    """Parse an ISO datetime string, handling None and timezone."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    if isinstance(value, str):
        try:
            value = value.replace('Z', '+00:00')
            return datetime.fromisoformat(value)
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

    end = _parse_dt(request.args.get('end')) or datetime.now(timezone.utc)

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
        logger.error(f"Failed to ping device {device_id}: {e}")
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


# -- Webhook Endpoint ---------------------------------------------------------

@gps_bp.route('/webhook/gps_report', methods=['POST'])
def webhook_gps_report():
    """Receive GPS report pushes from Trak-4.

    Trak-4 sends an array of GPS reports in a container object.
    Each report is deduplicated on report_id.

    Returns: 200 with count of new reports ingested.
    """
    payload = request.get_json(silent=True) or {}

    # Trak-4 webhook format: {"GPS_Reports": [...]}
    reports = payload.get('GPS_Reports', [])

    # Also handle single-report format
    if not reports and payload.get('ReportID'):
        reports = [payload]

    new_count = 0
    for report_data in reports:
        try:
            if ingest_webhook_report(report_data):
                new_count += 1
        except Exception as e:
            logger.error(f"Webhook report ingestion error: {e}")

    return jsonify({
        'received': len(reports),
        'new': new_count,
    })
