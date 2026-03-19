"""
Watches Module - API Routes

Full CRUD for watches, timekeeping periods/readings, and service logs.
Tracks mechanical/quartz watch accuracy over time.

Endpoints:
  Watches:
    GET    /api/watches/                    → List all watches
    POST   /api/watches/                    → Add a new watch
    GET    /api/watches/<id>                → Get watch with periods & services
    PUT    /api/watches/<id>                → Update a watch
    DELETE /api/watches/<id>                → Delete a watch and all related data

  Watch Images:
    POST   /api/watches/<id>/image          → Upload watch image
    GET    /api/watches/<id>/image/file     → Serve watch image
    DELETE /api/watches/<id>/image          → Delete watch image

  Timekeeping Periods:
    GET    /api/watches/<id>/periods        → List all periods for a watch
    GET    /api/watches/<id>/periods/active → Get active period with readings
    POST   /api/watches/<id>/periods        → Start a new period
    POST   /api/watches/<id>/periods/reset  → Close the active period
    DELETE /api/watches/periods/<id>        → Delete a period

  Timekeeping Readings:
    POST   /api/watches/<id>/readings       → Add a reading
    PUT    /api/watches/readings/<id>       → Update a reading
    DELETE /api/watches/readings/<id>       → Delete a reading

  Service Logs:
    GET    /api/watches/<id>/services       → List service logs
    POST   /api/watches/<id>/services       → Add a service log
    PUT    /api/watches/services/<id>       → Update a service log
    DELETE /api/watches/services/<id>       → Delete a service log

  Statistics:
    GET    /api/watches/<id>/stats          → Aggregated lifetime stats
"""
import os
import uuid
from datetime import date, datetime, timezone
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app import db
from app.models.watch import Watch, TimekeepingPeriod, TimekeepingReading, WatchServiceLog

watches_bp = Blueprint('watches', __name__)


# ── Allowed image extensions ──────────────────────────────────────
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


# ── Helper Functions ──────────────────────────────────────────────

def _parse_date(value):
    """Parse an ISO date string, returning None for empty/missing values."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    return date.fromisoformat(value)


def _parse_datetime(value):
    """Parse an ISO datetime string, returning None for empty/missing values.

    Always returns a timezone-naive datetime (UTC assumed) to avoid
    offset-naive vs offset-aware comparison errors in SQLAlchemy.
    """
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    dt = datetime.fromisoformat(value)
    # Strip timezone info — store as naive UTC (consistent with other models)
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


def _parse_float(value):
    """Parse a float value, returning None for empty/missing values."""
    if value is None or (isinstance(value, str) and value.strip() == ''):
        return None
    return float(value)


def _recalculate_rates(period):
    """Recalculate offset and rate for all readings in a period.

    For each reading:
      - offset_seconds = (watch_time - reference_time).total_seconds()
      - rate = change in offset / elapsed days since previous reading
      - First reading has rate = None (no previous to compare against)

    Args:
        period: A TimekeepingPeriod with its readings loaded.
    """
    # Sort by reference_time ascending (should already be ordered, but be safe)
    readings = sorted(period.readings, key=lambda r: r.reference_time)

    prev_offset = None
    prev_ref_time = None

    for reading in readings:
        # Calculate how far ahead/behind the watch is
        reading.offset_seconds = (reading.watch_time - reading.reference_time).total_seconds()

        if prev_offset is not None and prev_ref_time is not None:
            # How many days elapsed between this reading and the previous one
            elapsed_seconds = (reading.reference_time - prev_ref_time).total_seconds()
            elapsed_days = elapsed_seconds / 86400.0

            if elapsed_days > 0:
                # Rate = change in offset per day (sec/day)
                reading.rate = (reading.offset_seconds - prev_offset) / elapsed_days
            else:
                reading.rate = None
        else:
            # First reading in the period — no rate yet
            reading.rate = None

        prev_offset = reading.offset_seconds
        prev_ref_time = reading.reference_time


# ══════════════════════════════════════════════════════════════════
#  WATCH CRUD
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/', methods=['GET'])
def list_watches():
    """List all watches, ordered by name."""
    watches = Watch.query.order_by(Watch.name.asc()).all()
    return jsonify([w.to_dict() for w in watches])


@watches_bp.route('/', methods=['POST'])
def create_watch():
    """Create a new watch.

    Required fields: name, brand
    Optional: model, reference_number, serial_number, movement_type,
              movement_caliber, purchase_date, purchase_price, crystal_type,
              case_size_mm, water_resistance, notes
    """
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    if not data.get('brand'):
        return jsonify({'error': 'Brand is required'}), 400

    watch = Watch(
        name=data['name'],
        brand=data['brand'],
        model=data.get('model'),
        reference_number=data.get('reference_number'),
        serial_number=data.get('serial_number'),
        movement_type=data.get('movement_type'),
        movement_caliber=data.get('movement_caliber'),
        purchase_date=_parse_date(data.get('purchase_date')),
        purchase_price=_parse_float(data.get('purchase_price')),
        crystal_type=data.get('crystal_type'),
        case_size_mm=_parse_float(data.get('case_size_mm')),
        water_resistance=data.get('water_resistance'),
        notes=data.get('notes'),
    )

    db.session.add(watch)
    db.session.commit()

    return jsonify(watch.to_dict()), 201


@watches_bp.route('/<int:watch_id>', methods=['GET'])
def get_watch(watch_id):
    """Get a single watch with its periods and service logs."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify(watch.to_dict(include_periods=True, include_services=True))


@watches_bp.route('/<int:watch_id>', methods=['PUT'])
def update_watch(watch_id):
    """Update watch fields."""
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    # String fields — simple setattr loop
    string_fields = [
        'name', 'brand', 'model', 'reference_number', 'serial_number',
        'movement_type', 'movement_caliber', 'crystal_type',
        'water_resistance', 'notes',
    ]
    for field in string_fields:
        if field in data:
            setattr(watch, field, data[field])

    # Special handling for typed fields
    if 'purchase_date' in data:
        watch.purchase_date = _parse_date(data['purchase_date'])
    if 'purchase_price' in data:
        watch.purchase_price = _parse_float(data['purchase_price'])
    if 'case_size_mm' in data:
        watch.case_size_mm = _parse_float(data['case_size_mm'])

    db.session.commit()
    return jsonify(watch.to_dict())


@watches_bp.route('/<int:watch_id>', methods=['DELETE'])
def delete_watch(watch_id):
    """Delete a watch and all its periods, readings, and service logs.

    Also removes the image file from disk if one exists.
    """
    watch = Watch.query.get_or_404(watch_id)

    # Delete image file from disk if exists
    if watch.image_filename:
        upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
        file_path = os.path.join(upload_dir, watch.image_filename)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            pass

    db.session.delete(watch)
    db.session.commit()

    return jsonify({'message': 'Deleted'}), 200


# ══════════════════════════════════════════════════════════════════
#  WATCH IMAGES
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/<int:watch_id>/image', methods=['POST'])
def upload_watch_image(watch_id):
    """Upload a photo for a watch.

    Expects: multipart/form-data with a 'file' field.
    Stores the file using a UUID filename and saves the filename to the watch record.
    If the watch already has an image, the old file is deleted first.
    """
    watch = Watch.query.get_or_404(watch_id)

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '' or file.filename is None:
        return jsonify({'error': 'No file selected'}), 400

    # Validate file extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'error': f'File type .{ext} not allowed. Use: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400

    upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # Delete old image if one exists
    if watch.image_filename:
        old_path = os.path.join(upload_dir, watch.image_filename)
        try:
            if os.path.exists(old_path):
                os.remove(old_path)
        except OSError:
            pass

    # Save new image with UUID filename
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(upload_dir, stored_name)
    file.save(file_path)

    # Update watch record
    watch.image_filename = stored_name
    db.session.commit()

    return jsonify(watch.to_dict()), 200


@watches_bp.route('/<int:watch_id>/image/file', methods=['GET'])
def serve_watch_image(watch_id):
    """Serve the watch's image file."""
    watch = Watch.query.get_or_404(watch_id)

    if not watch.image_filename:
        return jsonify({'error': 'No image for this watch'}), 404

    upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
    return send_from_directory(upload_dir, watch.image_filename)


@watches_bp.route('/<int:watch_id>/image', methods=['DELETE'])
def delete_watch_image(watch_id):
    """Delete the watch's image file and clear the filename from the record."""
    watch = Watch.query.get_or_404(watch_id)

    if not watch.image_filename:
        return jsonify({'error': 'No image to delete'}), 404

    upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
    file_path = os.path.join(upload_dir, watch.image_filename)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass

    watch.image_filename = None
    db.session.commit()

    return jsonify(watch.to_dict()), 200


# ══════════════════════════════════════════════════════════════════
#  TIMEKEEPING PERIODS
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/<int:watch_id>/periods', methods=['GET'])
def list_periods(watch_id):
    """List all timekeeping periods for a watch."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify([p.to_dict(include_readings=True) for p in watch.periods])


@watches_bp.route('/<int:watch_id>/periods/active', methods=['GET'])
def get_active_period(watch_id):
    """Get the active (open) period with its readings.

    Returns 404 if no period is currently active.
    """
    watch = Watch.query.get_or_404(watch_id)
    active = watch.active_period()

    if not active:
        return jsonify({'error': 'No active period'}), 404

    return jsonify(active.to_dict(include_readings=True))


@watches_bp.route('/<int:watch_id>/periods', methods=['POST'])
def create_period(watch_id):
    """Start a new timekeeping period.

    Automatically closes any existing active period first (computing its stats).
    Optional body: {notes: "..."}
    """
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json() or {}

    # Auto-close any existing active period
    active = watch.active_period()
    if active:
        active.ended_at = datetime.utcnow()
        active.compute_stats()

    # Create the new period
    period = TimekeepingPeriod(
        watch_id=watch.id,
        started_at=datetime.utcnow(),
        notes=data.get('notes'),
    )

    db.session.add(period)
    db.session.commit()

    return jsonify(period.to_dict(include_readings=True)), 201


@watches_bp.route('/<int:watch_id>/periods/reset', methods=['POST'])
def close_active_period(watch_id):
    """Close the active period, computing its stats.

    Optional body: {notes: "..."}
    Returns the closed period with all readings.
    """
    watch = Watch.query.get_or_404(watch_id)
    active = watch.active_period()

    if not active:
        return jsonify({'error': 'No active period to close'}), 404

    data = request.get_json() or {}

    # Update notes if provided
    if 'notes' in data:
        active.notes = data['notes']

    # Close period and compute stats
    active.ended_at = datetime.utcnow()
    active.compute_stats()

    db.session.commit()

    return jsonify(active.to_dict(include_readings=True))


@watches_bp.route('/periods/<int:period_id>', methods=['DELETE'])
def delete_period(period_id):
    """Delete a timekeeping period and all its readings."""
    period = TimekeepingPeriod.query.get_or_404(period_id)

    db.session.delete(period)
    db.session.commit()

    return jsonify({'message': 'Deleted'}), 200


# ══════════════════════════════════════════════════════════════════
#  TIMEKEEPING READINGS
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/<int:watch_id>/readings', methods=['POST'])
def create_reading(watch_id):
    """Add a timekeeping reading to the active period.

    If no period is active, one is automatically created.

    Required: watch_time (ISO datetime), reference_time (ISO datetime)
    Optional: note
    """
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    if not data.get('watch_time'):
        return jsonify({'error': 'watch_time is required'}), 400
    if not data.get('reference_time'):
        return jsonify({'error': 'reference_time is required'}), 400

    watch_time = _parse_datetime(data['watch_time'])
    reference_time = _parse_datetime(data['reference_time'])

    if watch_time is None or reference_time is None:
        return jsonify({'error': 'Invalid datetime format'}), 400

    # Get or create active period
    active = watch.active_period()
    if not active:
        active = TimekeepingPeriod(
            watch_id=watch.id,
            started_at=reference_time,
        )
        db.session.add(active)
        db.session.flush()  # Get the period ID before adding the reading

    # Create the reading
    reading = TimekeepingReading(
        period_id=active.id,
        watch_time=watch_time,
        reference_time=reference_time,
        note=data.get('note'),
    )

    db.session.add(reading)
    db.session.flush()  # Ensure reading is in the session before recalculating

    # Recalculate rates for the entire period
    _recalculate_rates(active)

    db.session.commit()

    return jsonify(reading.to_dict()), 201


@watches_bp.route('/readings/<int:reading_id>', methods=['PUT'])
def update_reading(reading_id):
    """Update a timekeeping reading.

    Accepts: watch_time, reference_time, note
    Recalculates rates for the entire period after update.
    """
    reading = TimekeepingReading.query.get_or_404(reading_id)
    data = request.get_json()

    if 'watch_time' in data:
        parsed = _parse_datetime(data['watch_time'])
        if parsed is None:
            return jsonify({'error': 'Invalid watch_time format'}), 400
        reading.watch_time = parsed

    if 'reference_time' in data:
        parsed = _parse_datetime(data['reference_time'])
        if parsed is None:
            return jsonify({'error': 'Invalid reference_time format'}), 400
        reading.reference_time = parsed

    if 'note' in data:
        reading.note = data['note']

    # Recalculate rates for the entire period
    _recalculate_rates(reading.period)

    db.session.commit()

    return jsonify(reading.to_dict())


@watches_bp.route('/readings/<int:reading_id>', methods=['DELETE'])
def delete_reading(reading_id):
    """Delete a timekeeping reading and recalculate rates for remaining readings."""
    reading = TimekeepingReading.query.get_or_404(reading_id)
    period = reading.period

    db.session.delete(reading)
    db.session.flush()  # Remove from session before recalculating

    # Recalculate rates for remaining readings in the period
    _recalculate_rates(period)

    db.session.commit()

    return jsonify({'message': 'Deleted'}), 200


# ══════════════════════════════════════════════════════════════════
#  SERVICE LOGS
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/<int:watch_id>/services', methods=['GET'])
def list_services(watch_id):
    """List all service logs for a watch."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify([s.to_dict() for s in watch.service_logs])


@watches_bp.route('/<int:watch_id>/services', methods=['POST'])
def create_service(watch_id):
    """Add a service log entry for a watch.

    Required: service_date (ISO date)
    Optional: return_date, service_type, cost, watchmaker, notes,
              rate_before, rate_after
    """
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    if not data.get('service_date'):
        return jsonify({'error': 'service_date is required'}), 400

    service = WatchServiceLog(
        watch_id=watch.id,
        service_date=_parse_date(data['service_date']),
        return_date=_parse_date(data.get('return_date')),
        service_type=data.get('service_type'),
        cost=_parse_float(data.get('cost')),
        watchmaker=data.get('watchmaker'),
        notes=data.get('notes'),
        rate_before=_parse_float(data.get('rate_before')),
        rate_after=_parse_float(data.get('rate_after')),
    )

    db.session.add(service)
    db.session.commit()

    return jsonify(service.to_dict()), 201


@watches_bp.route('/services/<int:service_id>', methods=['PUT'])
def update_service(service_id):
    """Update a service log entry."""
    service = WatchServiceLog.query.get_or_404(service_id)
    data = request.get_json()

    # String fields
    string_fields = ['service_type', 'watchmaker', 'notes']
    for field in string_fields:
        if field in data:
            setattr(service, field, data[field])

    # Date fields
    if 'service_date' in data:
        service.service_date = _parse_date(data['service_date'])
    if 'return_date' in data:
        service.return_date = _parse_date(data['return_date'])

    # Float fields
    if 'cost' in data:
        service.cost = _parse_float(data['cost'])
    if 'rate_before' in data:
        service.rate_before = _parse_float(data['rate_before'])
    if 'rate_after' in data:
        service.rate_after = _parse_float(data['rate_after'])

    db.session.commit()

    return jsonify(service.to_dict())


@watches_bp.route('/services/<int:service_id>', methods=['DELETE'])
def delete_service(service_id):
    """Delete a service log entry."""
    service = WatchServiceLog.query.get_or_404(service_id)

    db.session.delete(service)
    db.session.commit()

    return jsonify({'message': 'Deleted'}), 200


# ══════════════════════════════════════════════════════════════════
#  STATISTICS
# ══════════════════════════════════════════════════════════════════

@watches_bp.route('/<int:watch_id>/stats', methods=['GET'])
def get_stats(watch_id):
    """Get aggregated lifetime accuracy statistics for a watch.

    Returns:
        overall_avg_rate: Mean sec/day across all periods
        overall_best_rate: Closest to 0 across all periods
        overall_worst_rate: Furthest from 0 across all periods
        total_periods: Number of periods (active + completed)
        completed_periods: Number of closed periods
        total_tracking_days: Sum of all period durations
        total_readings: Total readings across all periods
        trend_direction: "improving", "degrading", or "stable"
        period_summaries: Per-period breakdown
        current_rate: Latest rate from active period
        current_offset: Latest offset from active period
    """
    watch = Watch.query.get_or_404(watch_id)

    all_rates = []
    period_summaries = []
    total_readings = 0
    total_tracking_days = 0.0
    completed_periods = 0
    now = datetime.utcnow()

    for period in watch.periods:
        # Collect rates from this period's readings
        period_rates = [r.rate for r in period.readings if r.rate is not None]
        all_rates.extend(period_rates)
        total_readings += len(period.readings)

        # Calculate tracking days for this period
        end = period.ended_at or now
        delta_days = (end - period.started_at).total_seconds() / 86400.0
        total_tracking_days += max(delta_days, 0)

        if period.ended_at:
            completed_periods += 1

        # Build period summary
        summary = {
            'period_id': period.id,
            'started_at': period.started_at.isoformat() if period.started_at else None,
            'ended_at': period.ended_at.isoformat() if period.ended_at else None,
            'reading_count': len(period.readings),
            'is_active': period.ended_at is None,
        }

        if period_rates:
            summary['avg_rate'] = sum(period_rates) / len(period_rates)
            summary['best_rate'] = min(period_rates, key=abs)
            summary['worst_rate'] = max(period_rates, key=abs)
        else:
            summary['avg_rate'] = None
            summary['best_rate'] = None
            summary['worst_rate'] = None

        period_summaries.append(summary)

    # Overall stats
    overall_avg = sum(all_rates) / len(all_rates) if all_rates else None
    overall_best = min(all_rates, key=abs) if all_rates else None
    overall_worst = max(all_rates, key=abs) if all_rates else None

    # Trend direction: compare first half vs second half of period averages
    trend_direction = 'stable'
    summaries_with_avg = [s for s in period_summaries if s['avg_rate'] is not None]
    if len(summaries_with_avg) >= 4:
        # Period summaries are newest-first (from the relationship ordering),
        # so reverse to get chronological order for trend analysis
        chronological = list(reversed(summaries_with_avg))
        mid = len(chronological) // 2
        first_half_avg = sum(abs(s['avg_rate']) for s in chronological[:mid]) / mid
        second_half_avg = sum(abs(s['avg_rate']) for s in chronological[mid:]) / (len(chronological) - mid)

        if second_half_avg < first_half_avg:
            trend_direction = 'improving'  # Getting closer to 0
        elif second_half_avg > first_half_avg:
            trend_direction = 'degrading'  # Getting further from 0
        # else stays 'stable'

    # Current rate and offset from active period
    active = watch.active_period()
    current_rate = watch._current_rate(active)
    current_offset = watch._current_offset(active)

    return jsonify({
        'overall_avg_rate': overall_avg,
        'overall_best_rate': overall_best,
        'overall_worst_rate': overall_worst,
        'total_periods': len(watch.periods),
        'completed_periods': completed_periods,
        'total_tracking_days': round(total_tracking_days, 1),
        'total_readings': total_readings,
        'trend_direction': trend_direction,
        'period_summaries': period_summaries,
        'current_rate': current_rate,
        'current_offset': current_offset,
    })
