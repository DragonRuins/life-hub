"""
AutoPi Telemetry Module - API Routes

Serves AutoPi device info, OBD-II snapshot history, and sync controls.

Read endpoints (4):
  GET /device                → AutoPi device info
  GET /snapshots             → OBD snapshot history (filterable by PID, date range)
  GET /snapshots/latest      → Latest reading for each PID
  GET /snapshots/pids        → Unique PID names with count and last_seen

Sync endpoints (3):
  GET  /sync/status          → Current sync status
  POST /sync                 → Trigger manual sync
  POST /sync/backfill        → Trigger historical backfill

Write endpoints (1):
  POST /device/assign        → Assign AutoPi to a vehicle

Webhook (1):
  POST /webhook              → Receive AutoPi data pushes

Blueprint is registered with url_prefix='/api/autopi' in __init__.py.
"""
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport
from app.models.autopi import AutoPiOBDSnapshot
from app.models.vehicle import Vehicle
from app.services.autopi_sync import (
    sync_device, sync_positions, sync_obd_snapshots,
    backfill_positions, get_sync_status, ingest_webhook,
)

logger = logging.getLogger(__name__)
autopi_bp = Blueprint('autopi', __name__)


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

@autopi_bp.route('/device', methods=['GET'])
def get_device():
    """Return the AutoPi device info.

    Returns: {"device": {...}} or {"device": null, "message": "..."} if none configured.
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'device': None, 'message': 'No AutoPi device configured'})
    return jsonify({'device': device.to_dict()})


@autopi_bp.route('/snapshots', methods=['GET'])
def list_snapshots():
    """OBD snapshot history, filterable by PID and date range.

    Query params:
      - pid (str) — filter by pid_name
      - start (ISO datetime) — filter snapshots on or after this time
      - end (ISO datetime) — filter snapshots on or before this time
      - limit (int, default 500, max 5000)
      - offset (int, default 0)

    Returns: {"snapshots": [...], "total": N}
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'snapshots': [], 'total': 0})

    query = AutoPiOBDSnapshot.query.filter_by(device_id=device.id)

    # Filter by PID name
    pid = request.args.get('pid')
    if pid:
        query = query.filter(AutoPiOBDSnapshot.pid_name == pid)

    # Filter by date range
    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(AutoPiOBDSnapshot.recorded_at >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(AutoPiOBDSnapshot.recorded_at <= end)

    total = query.count()

    limit = _parse_limit(request.args.get('limit', 500))
    try:
        offset = max(0, int(request.args.get('offset', 0)))
    except (ValueError, TypeError):
        offset = 0

    snapshots = query.order_by(AutoPiOBDSnapshot.recorded_at.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'snapshots': [s.to_dict() for s in snapshots],
        'total': total,
    })


@autopi_bp.route('/snapshots/latest', methods=['GET'])
def latest_snapshots():
    """Latest reading for each PID.

    Uses a subquery to get max(recorded_at) per pid_name, then joins back
    to get the full row.

    Returns: {"snapshots": [...]}
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'snapshots': []})

    # Subquery: max recorded_at per pid_name for this device
    subq = db.session.query(
        AutoPiOBDSnapshot.pid_name,
        func.max(AutoPiOBDSnapshot.recorded_at).label('max_time'),
    ).filter_by(device_id=device.id).group_by(AutoPiOBDSnapshot.pid_name).subquery()

    latest = db.session.query(AutoPiOBDSnapshot).join(
        subq,
        db.and_(
            AutoPiOBDSnapshot.pid_name == subq.c.pid_name,
            AutoPiOBDSnapshot.recorded_at == subq.c.max_time,
        ),
    ).filter(AutoPiOBDSnapshot.device_id == device.id).all()

    return jsonify({'snapshots': [s.to_dict() for s in latest]})


@autopi_bp.route('/snapshots/pids', methods=['GET'])
def list_pids():
    """List unique PID names with count and last_seen.

    Groups by pid_name + unit.

    Returns: {"pids": [{"pid_name": "...", "unit": "...", "count": N, "last_seen": "..."}]}
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'pids': []})

    rows = db.session.query(
        AutoPiOBDSnapshot.pid_name,
        AutoPiOBDSnapshot.unit,
        func.count(AutoPiOBDSnapshot.id).label('count'),
        func.max(AutoPiOBDSnapshot.recorded_at).label('last_seen'),
    ).filter_by(device_id=device.id) \
     .group_by(AutoPiOBDSnapshot.pid_name, AutoPiOBDSnapshot.unit) \
     .order_by(AutoPiOBDSnapshot.pid_name) \
     .all()

    pids = [
        {
            'pid_name': row.pid_name,
            'unit': row.unit,
            'count': row.count,
            'last_seen': row.last_seen.isoformat() + 'Z' if row.last_seen else None,
        }
        for row in rows
    ]

    return jsonify({'pids': pids})


# -- Sync Endpoints -----------------------------------------------------------

@autopi_bp.route('/sync/status', methods=['GET'])
def sync_status():
    """Get current AutoPi sync status.

    Returns: sync status dict from autopi_sync.get_sync_status().
    """
    return jsonify(get_sync_status())


@autopi_bp.route('/sync', methods=['POST'])
def trigger_sync():
    """Trigger manual sync of device, positions, and OBD snapshots.

    Returns: {"success": true, "message": "..."}
    """
    try:
        device = sync_device()
        if not device:
            return jsonify({'error': 'No AutoPi device found in cloud account'}), 404

        pos_count = sync_positions(device)
        obd_count = sync_obd_snapshots(device)

        return jsonify({
            'success': True,
            'message': f'Sync complete. {pos_count} new position(s), {obd_count} new OBD snapshot(s).',
        })
    except Exception as e:
        logger.error(f"Manual AutoPi sync failed: {e}")
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


@autopi_bp.route('/sync/backfill', methods=['POST'])
def trigger_backfill():
    """Trigger historical backfill of position data.

    Expects: {"days": 7}  (default 7 if not provided)

    Returns: {"success": true, "message": "..."}
    """
    data = request.get_json(silent=True) or {}
    days = data.get('days', 7)

    try:
        days = max(1, min(int(days), 365))  # Clamp to 1-365
    except (ValueError, TypeError):
        days = 7

    try:
        count = backfill_positions(days=days)
        return jsonify({
            'success': True,
            'message': f'Backfill complete. {count} new position(s) for the last {days} day(s).',
        })
    except Exception as e:
        logger.error(f"AutoPi backfill failed: {e}")
        return jsonify({'error': f'Backfill failed: {str(e)}'}), 500


# -- Write Endpoints ----------------------------------------------------------

@autopi_bp.route('/device/assign', methods=['POST'])
def assign_vehicle():
    """Assign AutoPi to a vehicle.

    Expects: {"vehicle_id": 1}  (or null to unassign)

    Returns: Updated device dict.
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'error': 'No AutoPi device configured'}), 404

    data = request.get_json(silent=True) or {}
    vehicle_id = data.get('vehicle_id')

    if vehicle_id is not None:
        # Verify the vehicle exists
        vehicle = Vehicle.query.get(vehicle_id)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

    device.vehicle_id = vehicle_id

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to assign vehicle to AutoPi device: {e}")
        return jsonify({'error': 'Database error assigning vehicle'}), 500

    return jsonify({'device': device.to_dict()})


# -- Webhook Endpoint ---------------------------------------------------------

@autopi_bp.route('/webhook', methods=['POST'])
def webhook():
    """Receive data pushes directly from the AutoPi device.

    The device sends a JSON array of records with @t (type) and @ts (timestamp).
    Validates the Bearer token, ingests data, then forwards to AutoPi Cloud.

    Returns: 200 on success (tells device to delete its local copy).
    """
    from app.services.autopi_sync import validate_webhook_token, forward_to_autopi_cloud

    # Validate auth token
    auth_header = request.headers.get('Authorization', '')
    if not validate_webhook_token(auth_header):
        return jsonify({'error': 'Unauthorized'}), 401

    payload = request.get_json(silent=True) or []

    # Ingest into our database
    try:
        count = ingest_webhook(payload)
    except Exception as e:
        logger.error(f"AutoPi webhook ingestion error: {e}")
        count = 0

    # Forward to AutoPi Cloud (non-blocking, errors logged but don't fail)
    forward_to_autopi_cloud(payload, auth_header)

    return jsonify({
        'received': True,
        'new': count,
    })
