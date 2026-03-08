"""
OBD2 Module - API Routes

Receives OBD-II diagnostics data from the Apple app (via OBD2 Bluetooth adapter).
Stores real-time sensor snapshots, diagnostic trouble codes, and trip summaries.

Ingestion endpoints (2):
  POST /snapshots/batch  → Bulk insert sensor snapshots
  POST /dtcs             → Record a single DTC event
  POST /trips            → Record a completed trip

Query endpoints (3):
  GET /vehicles/<id>/snapshots → Query snapshots by vehicle
  GET /vehicles/<id>/dtcs      → Get DTC history for a vehicle
  GET /vehicles/<id>/trips     → Get trip history for a vehicle

DTC management (1):
  DELETE /dtcs/<id>  → Soft-delete (set cleared_at timestamp)

Blueprint is registered with url_prefix='/api/obd' in __init__.py.
"""
import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from app import db
from app.models.obd import OBDSnapshot, OBDDTCEvent, OBDTrip

logger = logging.getLogger(__name__)
obd_bp = Blueprint('obd', __name__)


# ── Helper Functions ────────────────────────────────────────────

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


def _parse_limit(value, default=100, max_limit=1000):
    """Parse and clamp a limit parameter."""
    try:
        return max(1, min(int(value), max_limit))
    except (ValueError, TypeError):
        return default


# ── Snapshot Fields ─────────────────────────────────────────────

# All optional sensor columns on OBDSnapshot.
# Used to dynamically build the row dict from incoming JSON.
SNAPSHOT_SENSOR_FIELDS = (
    'rpm', 'speed_kph', 'coolant_temp_c', 'engine_load_pct',
    'throttle_pct', 'intake_air_temp_c', 'maf_rate_gs',
    'fuel_level_pct', 'short_fuel_trim_pct',
)


# ── Ingestion Endpoints ────────────────────────────────────────

@obd_bp.route('/snapshots/batch', methods=['POST'])
def ingest_snapshots():
    """Batch insert OBD-II sensor snapshots.

    Expects: {
        "vehicle_id": 1,
        "snapshots": [
            {"recorded_at": "ISO", "rpm": 2500, "speed_kph": 80, ...},
            ...
        ]
    }

    Each snapshot must include a valid recorded_at timestamp.
    Optional sensor fields are included only when present and non-null.
    Uses bulk_insert_mappings for performance — duplicates are unlikely
    given millisecond-resolution timestamps from the app.

    Returns: {"ingested": N, "rejected": N}
    """
    data = request.get_json(silent=True) or {}
    vehicle_id = data.get('vehicle_id')
    snapshots = data.get('snapshots', [])

    # Validate required fields
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400
    if not isinstance(snapshots, list):
        return jsonify({'error': 'snapshots must be an array'}), 400

    valid_rows = []
    rejected = 0

    for s in snapshots:
        # recorded_at is required — skip if missing or unparseable
        recorded_at = _parse_dt(s.get('recorded_at'))
        if not recorded_at:
            rejected += 1
            continue

        try:
            row = {
                'vehicle_id': vehicle_id,
                'recorded_at': recorded_at,
                'created_at': datetime.now(timezone.utc),
            }

            # Include only sensor fields that are present and non-null
            for field in SNAPSHOT_SENSOR_FIELDS:
                val = s.get(field)
                if val is not None:
                    row[field] = float(val)

            valid_rows.append(row)
        except (ValueError, TypeError):
            rejected += 1
            continue

    ingested = 0
    if valid_rows:
        try:
            db.session.bulk_insert_mappings(OBDSnapshot, valid_rows)
            db.session.commit()
            ingested = len(valid_rows)
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to ingest OBD snapshots: {e}")
            return jsonify({'error': 'Database error during snapshot ingestion'}), 500

    return jsonify({
        'ingested': ingested,
        'rejected': rejected,
    })


# ── Query Endpoints ─────────────────────────────────────────────

@obd_bp.route('/vehicles/<int:vehicle_id>/snapshots', methods=['GET'])
def query_snapshots(vehicle_id):
    """Query OBD-II snapshots for a specific vehicle.

    Optional params:
      - limit (int, default 100, max 1000)
      - offset (int, default 0)
      - start (ISO datetime) — filter snapshots on or after this time
      - end (ISO datetime) — filter snapshots on or before this time

    Returns: {"snapshots": [...], "total": N}
    """
    query = OBDSnapshot.query.filter_by(vehicle_id=vehicle_id)

    # Date range filters
    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(OBDSnapshot.recorded_at >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(OBDSnapshot.recorded_at <= end)

    # Total count before pagination (for client-side paging)
    total = query.count()

    # Pagination
    limit = _parse_limit(request.args.get('limit', 100))
    try:
        offset = max(0, int(request.args.get('offset', 0)))
    except (ValueError, TypeError):
        offset = 0

    snapshots = query.order_by(OBDSnapshot.recorded_at.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'snapshots': [s.to_dict() for s in snapshots],
        'total': total,
    })


# ── DTC Endpoints ──────────────────────────────────────────────

@obd_bp.route('/dtcs', methods=['POST'])
def create_dtc():
    """Record a single Diagnostic Trouble Code event.

    Expects: {
        "vehicle_id": 1,
        "dtc_code": "P0301",
        "description": "Cylinder 1 Misfire Detected",
        "is_pending": false,
        "recorded_at": "ISO"
    }

    Required: vehicle_id, dtc_code
    Returns: 201 with the created DTC event dict.
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    if not data.get('vehicle_id'):
        return jsonify({'error': 'vehicle_id is required'}), 400
    if not data.get('dtc_code'):
        return jsonify({'error': 'dtc_code is required'}), 400

    recorded_at = _parse_dt(data.get('recorded_at')) or datetime.now(timezone.utc)

    dtc = OBDDTCEvent(
        vehicle_id=data['vehicle_id'],
        dtc_code=data['dtc_code'],
        description=data.get('description'),
        is_pending=data.get('is_pending', False),
        recorded_at=recorded_at,
    )

    try:
        db.session.add(dtc)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create DTC event: {e}")
        return jsonify({'error': 'Database error creating DTC event'}), 500

    return jsonify(dtc.to_dict()), 201


@obd_bp.route('/vehicles/<int:vehicle_id>/dtcs', methods=['GET'])
def query_dtcs(vehicle_id):
    """Get DTC history for a specific vehicle.

    Optional params:
      - include_cleared (string, default "false") — set to "true" to include
        DTCs that have been cleared (cleared_at IS NOT NULL)

    Returns: {"dtcs": [...]}
    """
    query = OBDDTCEvent.query.filter_by(vehicle_id=vehicle_id)

    # By default, only show active (un-cleared) DTCs
    include_cleared = request.args.get('include_cleared', 'false').lower() == 'true'
    if not include_cleared:
        query = query.filter(OBDDTCEvent.cleared_at.is_(None))

    dtcs = query.order_by(OBDDTCEvent.recorded_at.desc()).all()

    return jsonify({
        'dtcs': [d.to_dict() for d in dtcs],
    })


@obd_bp.route('/dtcs/<int:dtc_id>', methods=['DELETE'])
def clear_dtc(dtc_id):
    """Soft-delete a DTC event by setting its cleared_at timestamp.

    Does NOT actually delete the row — the DTC remains in history
    and can be seen with ?include_cleared=true.

    Returns: Updated DTC event dict.
    """
    dtc = OBDDTCEvent.query.get_or_404(dtc_id)

    dtc.cleared_at = datetime.now(timezone.utc)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to clear DTC {dtc_id}: {e}")
        return jsonify({'error': 'Database error clearing DTC'}), 500

    return jsonify(dtc.to_dict())


# ── Trip Endpoints ──────────────────────────────────────────────

@obd_bp.route('/trips', methods=['POST'])
def create_trip():
    """Record a completed OBD-II trip summary.

    Expects: {
        "vehicle_id": 1,
        "start_time": "ISO",
        "end_time": "ISO",
        "duration_seconds": 1800,
        "distance_km": 25.4,
        "max_rpm": 5200,
        "max_speed_kph": 110.5,
        "average_speed_kph": 55.2,
        "snapshot_count": 360
    }

    Required: vehicle_id, start_time
    Returns: 201 with the created trip dict.
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    if not data.get('vehicle_id'):
        return jsonify({'error': 'vehicle_id is required'}), 400

    start_time = _parse_dt(data.get('start_time'))
    if not start_time:
        return jsonify({'error': 'start_time is required'}), 400

    trip = OBDTrip(
        vehicle_id=data['vehicle_id'],
        start_time=start_time,
        end_time=_parse_dt(data.get('end_time')),
        duration_seconds=data.get('duration_seconds'),
        distance_km=data.get('distance_km'),
        max_rpm=data.get('max_rpm'),
        max_speed_kph=data.get('max_speed_kph'),
        average_speed_kph=data.get('average_speed_kph'),
        snapshot_count=data.get('snapshot_count', 0),
    )

    try:
        db.session.add(trip)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create OBD trip: {e}")
        return jsonify({'error': 'Database error creating trip'}), 500

    return jsonify(trip.to_dict()), 201


@obd_bp.route('/vehicles/<int:vehicle_id>/trips', methods=['GET'])
def query_trips(vehicle_id):
    """Get trip history for a specific vehicle.

    Optional params:
      - limit (int, default 50, max 1000)
      - offset (int, default 0)

    Returns: {"trips": [...], "total": N}
    """
    query = OBDTrip.query.filter_by(vehicle_id=vehicle_id)

    # Total count before pagination
    total = query.count()

    # Pagination
    limit = _parse_limit(request.args.get('limit', 50))
    try:
        offset = max(0, int(request.args.get('offset', 0)))
    except (ValueError, TypeError):
        offset = 0

    trips = query.order_by(OBDTrip.start_time.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'trips': [t.to_dict() for t in trips],
        'total': total,
    })
