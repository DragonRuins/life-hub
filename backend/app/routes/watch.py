"""
Watch Pipeline Module - API Routes

Receives HealthKit samples, barometer readings, NFC events, and UWB spatial
readings from the iPhone app (which relays Apple Watch data).

Ingestion endpoints (5):
  POST /health       → Batch upsert health samples
  POST /barometer    → Batch upsert barometer readings
  POST /nfc          → Single NFC event + action execution
  POST /spatial      → Single spatial reading upsert
  POST /sync         → Mixed batch (delegates per type)

NFC Action CRUD (5):
  GET    /nfc/actions             → List action definitions
  POST   /nfc/actions             → Create an action definition
  PUT    /nfc/actions/<action_id> → Update an action definition
  DELETE /nfc/actions/<action_id> → Delete an action definition
  GET    /nfc/timers              → List timer sessions

Query endpoints (4):
  GET /health/query    → Query health samples by type/date/limit
  GET /health/latest   → Latest sample per type (DISTINCT ON)
  GET /barometer/query → Query barometer readings by date/context
  GET /sync/status     → Per-pipeline sync status

Blueprint is registered with url_prefix='/api/watch' in __init__.py (Session 5).
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import text
from app import db
from app.models.watch import (
    WatchHealthSample, WatchBarometerReading, WatchNFCEvent,
    WatchNFCActionDefinition, WatchNFCTimer,
    WatchSpatialReading, WatchSyncStatus,
)

watch_bp = Blueprint('watch', __name__)


# ── Helper Functions ────────────────────────────────────────────

def format_duration(seconds):
    """Format seconds into human-readable duration.

    Examples:
        7800 -> "2h 10m"
        2700 -> "45m"
        30   -> "30s"
    """
    if seconds is None:
        return None
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    hours = minutes // 60
    remaining_minutes = minutes % 60
    if hours > 0 and remaining_minutes > 0:
        return f"{hours}h {remaining_minutes}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{minutes}m"


def update_sync_status(pipeline, count):
    """Upsert a sync status row — creates if missing, updates if exists.

    Uses PostgreSQL INSERT ... ON CONFLICT DO UPDATE for atomic upsert.
    Wrapped in try/except to prevent sync status failures from crashing
    the parent ingestion endpoint.
    """
    try:
        stmt = pg_insert(WatchSyncStatus).values(
            pipeline=pipeline,
            last_sync_at=datetime.now(timezone.utc),
            samples_synced=count,
            last_error=None,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=['pipeline'],
            set_={
                'last_sync_at': stmt.excluded.last_sync_at,
                'samples_synced': WatchSyncStatus.samples_synced + count,
                'last_error': None,
                'updated_at': datetime.now(timezone.utc),
            }
        )
        db.session.execute(stmt)
    except Exception as e:
        # Log but don't crash — sync status is advisory, not critical
        import logging
        logging.getLogger(__name__).warning(f"Failed to update sync status for {pipeline}: {e}")


def _parse_dt(value):
    """Parse an ISO datetime string, returning None for empty/null/invalid values."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    if isinstance(value, str):
        try:
            # Handle both 'Z' suffix and '+00:00' timezone formats
            value = value.replace('Z', '+00:00')
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None
    return value


def _parse_limit(value, default=100, max_limit=1000):
    """Parse and clamp a limit query parameter. Returns default on invalid input."""
    try:
        return max(1, min(int(value), max_limit))
    except (ValueError, TypeError):
        return default


def _handle_toggle_timer(action, event):
    """Handle a toggle_timer NFC action — start or stop a timer.

    If an active timer exists for this action_id, stop it.
    Otherwise, start a new timer.
    Returns a dict with status, timer_id, duration, and haptic feedback.
    """
    # Look for an active (un-ended) timer for this action.
    # Use with_for_update() to lock the row and prevent race conditions
    # where two concurrent taps both see "no active timer" and start two.
    active_timer = WatchNFCTimer.query.filter_by(
        action_id=action.action_id,
        ended_at=None,
    ).with_for_update().first()

    if active_timer:
        # Stop the active timer
        now = datetime.now(timezone.utc)
        active_timer.ended_at = now
        duration = int((now - active_timer.started_at).total_seconds())
        active_timer.duration_seconds = duration
        formatted = format_duration(duration)
        return {
            'status': 'stopped',
            'timer_id': active_timer.id,
            'duration_seconds': duration,
            'formatted_duration': formatted,
            'haptic': 'success',
            'message': f"Done — {formatted}",
        }
    else:
        # Start a new timer
        timer = WatchNFCTimer(
            action_id=action.action_id,
            started_at=datetime.now(timezone.utc),
        )
        db.session.add(timer)
        db.session.flush()  # Get the timer ID
        return {
            'status': 'started',
            'timer_id': timer.id,
            'duration_seconds': None,
            'formatted_duration': None,
            'haptic': 'start',
            'message': 'Timer started',
        }


def _handle_one_shot(action, event):
    """Handle a one_shot NFC action — execute integrations and return results.

    Placeholder for future Home Assistant / homelab hooks.
    """
    results = {}
    integrations = action.integrations or {}

    for name, config in integrations.items():
        results[name] = _execute_integration(config)

    return {
        'status': 'executed',
        'integrations_triggered': list(integrations.keys()),
        'results': results,
        'haptic': 'success',
        'message': action.responses.get('success_message', 'Action executed') if action.responses else 'Action executed',
    }


def _handle_context_switch(action, event):
    """Handle a context_switch NFC action — return context identifier.

    Used for tracking location/activity context (e.g., "at workshop").
    """
    config = action.config or {}
    context_id = config.get('context_id', action.action_id)

    return {
        'status': 'switched',
        'context_id': context_id,
        'haptic': 'success',
        'message': config.get('message', f"Context: {context_id}"),
    }


def _execute_integration(config):
    """Placeholder for external integration hooks (Home Assistant, etc.).

    Returns mock results for now. Will be expanded when integrations
    are wired up (e.g., HA webhook calls, Docker API actions).
    """
    return {
        'status': 'ok',
        'mock': True,
        'integration_type': config.get('type', 'unknown'),
    }


# ── Ingestion Endpoints ────────────────────────────────────────

@watch_bp.route('/health', methods=['POST'])
def ingest_health():
    """Batch upsert HealthKit samples.

    Expects: {"samples": [{uuid, sample_type, value, unit, start_date, ...}, ...]}
    Skips records missing required fields. Uses ON CONFLICT DO NOTHING for dedup.
    """
    data = request.get_json(silent=True) or {}
    samples = data.get('samples', [])

    if not isinstance(samples, list):
        return jsonify({'error': 'samples must be an array'}), 400

    # Filter to valid records only, skip malformed values
    valid_rows = []
    rejected = 0
    for s in samples:
        if not all(s.get(f) for f in ('uuid', 'sample_type', 'value', 'unit', 'start_date')):
            rejected += 1
            continue
        try:
            valid_rows.append({
                'uuid': s['uuid'],
                'sample_type': s['sample_type'],
                'value': float(s['value']),
                'unit': s['unit'],
                'start_date': _parse_dt(s['start_date']),
                'end_date': _parse_dt(s.get('end_date')),
                'source_device': s.get('source_device'),
                'source_app': s.get('source_app'),
                'sample_metadata': s.get('metadata', {}),
                'created_at': datetime.now(timezone.utc),
            })
        except (ValueError, TypeError):
            rejected += 1
            continue

    ingested = 0
    if valid_rows:
        stmt = pg_insert(WatchHealthSample).values(valid_rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
        result = db.session.execute(stmt)
        ingested = result.rowcount

    # Update sync status
    if ingested > 0:
        update_sync_status('health', ingested)

    db.session.commit()

    return jsonify({
        'ingested': ingested,
        'rejected': rejected,
        'duplicates': len(valid_rows) - ingested,
    })


@watch_bp.route('/barometer', methods=['POST'])
def ingest_barometer():
    """Batch upsert barometer readings.

    Expects: {"readings": [{uuid, timestamp, pressure_kpa, ...}, ...]}
    Skips records missing required fields. Uses ON CONFLICT DO NOTHING for dedup.
    """
    data = request.get_json(silent=True) or {}
    readings = data.get('readings', [])

    if not isinstance(readings, list):
        return jsonify({'error': 'readings must be an array'}), 400

    valid_rows = []
    rejected = 0
    for r in readings:
        if not all(r.get(f) for f in ('uuid', 'timestamp', 'pressure_kpa')):
            rejected += 1
            continue
        try:
            valid_rows.append({
                'uuid': r['uuid'],
                'timestamp': _parse_dt(r['timestamp']),
                'pressure_kpa': float(r['pressure_kpa']),
                'relative_altitude_m': float(r['relative_altitude_m']) if r.get('relative_altitude_m') is not None else None,
                'lat': float(r['lat']) if r.get('lat') is not None else None,
                'lng': float(r['lng']) if r.get('lng') is not None else None,
                'context': r.get('context'),
                'created_at': datetime.now(timezone.utc),
            })
        except (ValueError, TypeError):
            rejected += 1
            continue

    ingested = 0
    if valid_rows:
        stmt = pg_insert(WatchBarometerReading).values(valid_rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
        result = db.session.execute(stmt)
        ingested = result.rowcount

    if ingested > 0:
        update_sync_status('barometer', ingested)

    db.session.commit()

    return jsonify({
        'ingested': ingested,
        'rejected': rejected,
        'duplicates': len(valid_rows) - ingested,
    })


@watch_bp.route('/nfc', methods=['POST'])
def ingest_nfc():
    """Process a single NFC tag scan event and execute the associated action.

    Expects: {uuid, timestamp, action_id, label, tag_id, lat, lng}
    Looks up the action definition and executes the appropriate handler.
    Still stores the event even if the action is not found.
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    if not all(data.get(f) for f in ('uuid', 'timestamp', 'action_id')):
        return jsonify({'error': 'uuid, timestamp, and action_id are required'}), 400

    action_id = data['action_id']

    # Look up the action definition
    action = WatchNFCActionDefinition.query.filter_by(action_id=action_id).first()

    # Check for duplicate event (idempotent upsert)
    existing_event = WatchNFCEvent.query.filter_by(uuid=data['uuid']).first()
    if existing_event:
        return jsonify({
            'event': existing_event.to_dict(),
            'action': None,
            'result': {'status': 'duplicate', 'message': 'Event already recorded'},
        })

    # Create the event record
    event = WatchNFCEvent(
        uuid=data['uuid'],
        timestamp=_parse_dt(data['timestamp']),
        action_id=action_id,
        label=data.get('label'),
        tag_id=data.get('tag_id'),
        lat=float(data['lat']) if data.get('lat') is not None else None,
        lng=float(data['lng']) if data.get('lng') is not None else None,
    )

    # Execute the action (or record that it wasn't found)
    if not action:
        event.result = {'error': 'action_not_found'}
        db.session.add(event)
        update_sync_status('nfc', 1)
        db.session.commit()
        return jsonify({
            'event': event.to_dict(),
            'action': None,
            'result': {'error': 'action_not_found'},
        })

    if not action.enabled:
        event.result = {'error': 'action_disabled'}
        db.session.add(event)
        update_sync_status('nfc', 1)
        db.session.commit()
        return jsonify({
            'event': event.to_dict(),
            'action': action.action_type,
            'result': {'error': 'action_disabled'},
        })

    # Dispatch to the appropriate handler
    handlers = {
        'toggle_timer': _handle_toggle_timer,
        'one_shot': _handle_one_shot,
        'context_switch': _handle_context_switch,
    }
    handler = handlers.get(action.action_type)
    if handler:
        result = handler(action, event)
    else:
        result = {'error': f'unknown action_type: {action.action_type}'}

    event.result = result
    db.session.add(event)
    update_sync_status('nfc', 1)
    db.session.commit()

    return jsonify({
        'event': event.to_dict(),
        'action': action.action_type,
        'result': result,
    })


@watch_bp.route('/spatial', methods=['POST'])
def ingest_spatial():
    """Upsert a single UWB spatial reading.

    Expects: {uuid, timestamp, peer_device, distance_m, direction_x/y/z}
    Uses ON CONFLICT DO NOTHING for dedup by uuid.
    """
    data = request.get_json(silent=True) or {}

    if not all(data.get(f) for f in ('uuid', 'timestamp', 'peer_device')):
        return jsonify({'error': 'uuid, timestamp, and peer_device are required'}), 400

    stmt = pg_insert(WatchSpatialReading).values(
        uuid=data['uuid'],
        timestamp=_parse_dt(data['timestamp']),
        peer_device=data['peer_device'],
        distance_m=float(data['distance_m']) if data.get('distance_m') is not None else None,
        direction_x=float(data['direction_x']) if data.get('direction_x') is not None else None,
        direction_y=float(data['direction_y']) if data.get('direction_y') is not None else None,
        direction_z=float(data['direction_z']) if data.get('direction_z') is not None else None,
        created_at=datetime.now(timezone.utc),
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
    result = db.session.execute(stmt)

    if result.rowcount > 0:
        update_sync_status('spatial', 1)

    db.session.commit()

    return jsonify({'status': 'recorded'})


@watch_bp.route('/sync', methods=['POST'])
def ingest_sync():
    """Mixed batch ingestion — delegates to the same logic per data type.

    Expects: {
        "health": [{...}, ...],
        "barometer": [{...}, ...],
        "spatial": [{...}, ...]
    }
    Returns per-type ingestion counts.
    """
    data = request.get_json(silent=True) or {}
    results = {}

    # Health samples
    health_samples = data.get('health', [])
    if health_samples and isinstance(health_samples, list):
        valid_rows = []
        for s in health_samples:
            if not all(s.get(f) for f in ('uuid', 'sample_type', 'value', 'unit', 'start_date')):
                continue
            try:
                valid_rows.append({
                    'uuid': s['uuid'],
                    'sample_type': s['sample_type'],
                    'value': float(s['value']),
                    'unit': s['unit'],
                    'start_date': _parse_dt(s['start_date']),
                    'end_date': _parse_dt(s.get('end_date')),
                    'source_device': s.get('source_device'),
                    'source_app': s.get('source_app'),
                    'sample_metadata': s.get('metadata', {}),
                    'created_at': datetime.now(timezone.utc),
                })
            except (ValueError, TypeError):
                continue
        if valid_rows:
            stmt = pg_insert(WatchHealthSample).values(valid_rows)
            stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
            res = db.session.execute(stmt)
            count = res.rowcount
            if count > 0:
                update_sync_status('health', count)
            results['health'] = count
        else:
            results['health'] = 0
    else:
        results['health'] = 0

    # Barometer readings
    baro_readings = data.get('barometer', [])
    if baro_readings and isinstance(baro_readings, list):
        valid_rows = []
        for r in baro_readings:
            if not all(r.get(f) for f in ('uuid', 'timestamp', 'pressure_kpa')):
                continue
            try:
                valid_rows.append({
                    'uuid': r['uuid'],
                    'timestamp': _parse_dt(r['timestamp']),
                    'pressure_kpa': float(r['pressure_kpa']),
                    'relative_altitude_m': float(r['relative_altitude_m']) if r.get('relative_altitude_m') is not None else None,
                    'lat': float(r['lat']) if r.get('lat') is not None else None,
                    'lng': float(r['lng']) if r.get('lng') is not None else None,
                    'context': r.get('context'),
                    'created_at': datetime.now(timezone.utc),
                })
            except (ValueError, TypeError):
                continue
        if valid_rows:
            stmt = pg_insert(WatchBarometerReading).values(valid_rows)
            stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
            res = db.session.execute(stmt)
            count = res.rowcount
            if count > 0:
                update_sync_status('barometer', count)
            results['barometer'] = count
        else:
            results['barometer'] = 0
    else:
        results['barometer'] = 0

    # Spatial readings
    spatial_readings = data.get('spatial', [])
    if spatial_readings and isinstance(spatial_readings, list):
        spatial_count = 0
        for s in spatial_readings:
            if not all(s.get(f) for f in ('uuid', 'timestamp', 'peer_device')):
                continue
            stmt = pg_insert(WatchSpatialReading).values(
                uuid=s['uuid'],
                timestamp=_parse_dt(s['timestamp']),
                peer_device=s['peer_device'],
                distance_m=float(s['distance_m']) if s.get('distance_m') is not None else None,
                direction_x=float(s['direction_x']) if s.get('direction_x') is not None else None,
                direction_y=float(s['direction_y']) if s.get('direction_y') is not None else None,
                direction_z=float(s['direction_z']) if s.get('direction_z') is not None else None,
                created_at=datetime.now(timezone.utc),
            )
            stmt = stmt.on_conflict_do_nothing(index_elements=['uuid'])
            res = db.session.execute(stmt)
            spatial_count += res.rowcount
        if spatial_count > 0:
            update_sync_status('spatial', spatial_count)
        results['spatial'] = spatial_count
    else:
        results['spatial'] = 0

    db.session.commit()

    return jsonify({'sync_results': results})


# ── NFC Action CRUD ─────────────────────────────────────────────

@watch_bp.route('/nfc/actions', methods=['GET'])
def list_nfc_actions():
    """List all NFC action definitions.

    Optional filters: ?category=homelab, ?enabled_only=true
    """
    query = WatchNFCActionDefinition.query

    category = request.args.get('category')
    if category:
        query = query.filter_by(category=category)

    enabled_only = request.args.get('enabled_only', '').lower() == 'true'
    if enabled_only:
        query = query.filter_by(enabled=True)

    actions = query.order_by(WatchNFCActionDefinition.action_id).all()
    return jsonify([a.to_dict() for a in actions])


@watch_bp.route('/nfc/actions', methods=['POST'])
def create_nfc_action():
    """Create a new NFC action definition.

    Required: action_id, action_type
    Returns 409 if action_id already exists.
    """
    data = request.get_json(silent=True) or {}

    if not data.get('action_id') or not data.get('action_type'):
        return jsonify({'error': 'action_id and action_type are required'}), 400

    # Check for duplicate
    existing = WatchNFCActionDefinition.query.filter_by(action_id=data['action_id']).first()
    if existing:
        return jsonify({'error': f"action_id '{data['action_id']}' already exists"}), 409

    action = WatchNFCActionDefinition(
        action_id=data['action_id'],
        description=data.get('description'),
        action_type=data['action_type'],
        category=data.get('category'),
        config=data.get('config', {}),
        integrations=data.get('integrations', {}),
        responses=data.get('responses', {}),
        enabled=data.get('enabled', True),
    )
    db.session.add(action)
    db.session.commit()

    return jsonify(action.to_dict()), 201


@watch_bp.route('/nfc/actions/<action_id>', methods=['PUT'])
def update_nfc_action(action_id):
    """Update an existing NFC action definition.

    Looks up by string action_id, not integer id.
    """
    action = WatchNFCActionDefinition.query.filter_by(action_id=action_id).first()
    if not action:
        return jsonify({'error': f"action '{action_id}' not found"}), 404

    data = request.get_json(silent=True) or {}

    # Update allowed fields
    if 'description' in data:
        action.description = data['description']
    if 'action_type' in data:
        action.action_type = data['action_type']
    if 'category' in data:
        action.category = data['category']
    if 'config' in data:
        action.config = data['config']
    if 'integrations' in data:
        action.integrations = data['integrations']
    if 'responses' in data:
        action.responses = data['responses']
    if 'enabled' in data:
        action.enabled = data['enabled']

    db.session.commit()
    return jsonify(action.to_dict())


@watch_bp.route('/nfc/actions/<action_id>', methods=['DELETE'])
def delete_nfc_action(action_id):
    """Delete an NFC action definition.

    Does NOT cascade-delete timers (loose coupling via string action_id).
    """
    action = WatchNFCActionDefinition.query.filter_by(action_id=action_id).first()
    if not action:
        return jsonify({'error': f"action '{action_id}' not found"}), 404

    db.session.delete(action)
    db.session.commit()
    return jsonify({'message': f"action '{action_id}' deleted"})


@watch_bp.route('/nfc/timers', methods=['GET'])
def list_nfc_timers():
    """List NFC timer sessions.

    Optional filters: ?action_id=X, ?active_only=true, ?limit=100
    """
    query = WatchNFCTimer.query

    action_id = request.args.get('action_id')
    if action_id:
        query = query.filter_by(action_id=action_id)

    active_only = request.args.get('active_only', '').lower() == 'true'
    if active_only:
        query = query.filter(WatchNFCTimer.ended_at.is_(None))

    limit = _parse_limit(request.args.get('limit', 100))
    timers = query.order_by(WatchNFCTimer.started_at.desc()).limit(limit).all()

    # Add formatted_duration to each timer dict
    result = []
    for t in timers:
        d = t.to_dict()
        d['formatted_duration'] = format_duration(t.duration_seconds)
        result.append(d)

    return jsonify(result)


@watch_bp.route('/nfc/events', methods=['GET'])
def list_nfc_events():
    """List NFC tap events with optional filters.

    Optional: ?action_id=X, ?start=ISO, ?end=ISO, ?limit=100 (max 1000)
    """
    query = WatchNFCEvent.query

    action_id = request.args.get('action_id')
    if action_id:
        query = query.filter_by(action_id=action_id)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(WatchNFCEvent.timestamp >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(WatchNFCEvent.timestamp <= end)

    try:
        limit = max(1, min(int(request.args.get('limit', 100)), 1000))
    except (ValueError, TypeError):
        limit = 100

    events = query.order_by(WatchNFCEvent.timestamp.desc()).limit(limit).all()
    return jsonify([e.to_dict() for e in events])


# ── Query Endpoints ─────────────────────────────────────────────

@watch_bp.route('/health/query', methods=['GET'])
def query_health():
    """Query health samples with filters.

    Optional: ?type=heart_rate, ?start=ISO, ?end=ISO, ?limit=100 (max 1000)
    """
    query = WatchHealthSample.query

    sample_type = request.args.get('type')
    if sample_type:
        query = query.filter_by(sample_type=sample_type)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(WatchHealthSample.start_date >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(WatchHealthSample.start_date <= end)

    limit = _parse_limit(request.args.get('limit', 100))
    samples = query.order_by(WatchHealthSample.start_date.desc()).limit(limit).all()

    return jsonify([s.to_dict() for s in samples])


@watch_bp.route('/health/latest', methods=['GET'])
def latest_health():
    """Get the latest sample for each sample type.

    Uses PostgreSQL DISTINCT ON for efficient per-type latest lookup.
    Returns a dict keyed by sample_type (not an array).
    """
    sql = text("""
        SELECT DISTINCT ON (sample_type)
            id, uuid, sample_type, value, unit, start_date, end_date,
            source_device, source_app, metadata, created_at
        FROM watch_health_samples
        ORDER BY sample_type, start_date DESC
    """)
    rows = db.session.execute(sql).mappings().all()

    result = {}
    for row in rows:
        result[row['sample_type']] = {
            'id': row['id'],
            'uuid': row['uuid'],
            'sample_type': row['sample_type'],
            'value': row['value'],
            'unit': row['unit'],
            'start_date': row['start_date'].isoformat() if row['start_date'] else None,
            'end_date': row['end_date'].isoformat() if row['end_date'] else None,
            'source_device': row['source_device'],
            'source_app': row['source_app'],
            'metadata': row['metadata'] or {},
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
        }

    return jsonify(result)


@watch_bp.route('/barometer/query', methods=['GET'])
def query_barometer():
    """Query barometer readings with filters.

    Optional: ?start=ISO, ?end=ISO, ?context=outdoor, ?limit=100 (max 1000)
    """
    query = WatchBarometerReading.query

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(WatchBarometerReading.timestamp >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(WatchBarometerReading.timestamp <= end)

    context = request.args.get('context')
    if context:
        query = query.filter_by(context=context)

    limit = _parse_limit(request.args.get('limit', 100))
    readings = query.order_by(WatchBarometerReading.timestamp.desc()).limit(limit).all()

    return jsonify([r.to_dict() for r in readings])


@watch_bp.route('/sync/status', methods=['GET'])
def sync_status():
    """Get sync status for all 4 pipelines.

    Always returns all 4 pipelines (health, barometer, nfc, spatial)
    with zero-state defaults for missing rows.
    """
    all_pipelines = ['health', 'barometer', 'nfc', 'spatial']

    # Fetch existing rows
    rows = WatchSyncStatus.query.all()
    existing = {r.pipeline: r.to_dict() for r in rows}

    # Build response with defaults for missing pipelines
    result = {}
    for pipeline in all_pipelines:
        if pipeline in existing:
            result[pipeline] = existing[pipeline]
        else:
            result[pipeline] = {
                'id': None,
                'pipeline': pipeline,
                'last_sync_at': None,
                'samples_synced': 0,
                'last_error': None,
                'metadata': {},
                'updated_at': None,
            }

    return jsonify(result)
