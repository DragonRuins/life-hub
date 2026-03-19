# Watch Timekeeping Accuracy — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a mechanical watch accuracy tracking module to the Datacore iOS app (iPhone, iPad, Mac) with backend API support.

**Architecture:** Three-table hierarchy (Watch > TimekeepingPeriod > TimekeepingReading) plus a flat WatchServiceLog. Flask backend with SQLAlchemy models and RESTful endpoints. SwiftUI frontend following the established Datacore design system with Liquid Glass, PremiumStatCard, stagger reveals, CountingNumber, and charts.

**Tech Stack:** Python/Flask/SQLAlchemy (backend), Swift 6/SwiftUI/Charts (iOS), PostgreSQL (database)

**Design Doc:** `docs/plans/2026-03-19-watch-timekeeping-design.md`

---

## Task 1: Backend Models

**Files:**
- Create: `backend/app/models/watch.py`
- Modify: `backend/app/models/__init__.py` (add import at line 30)

**Step 1: Create the model file**

Create `backend/app/models/watch.py` with four SQLAlchemy models:

```python
from datetime import datetime, timezone, date
from app import db


class Watch(db.Model):
    __tablename__ = 'watches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    brand = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(100))
    reference_number = db.Column(db.String(100))
    serial_number = db.Column(db.String(100))
    movement_type = db.Column(db.String(50))  # automatic, manual, quartz
    movement_caliber = db.Column(db.String(100))
    purchase_date = db.Column(db.Date)
    purchase_price = db.Column(db.Float)
    crystal_type = db.Column(db.String(50))  # sapphire, mineral, acrylic
    case_size_mm = db.Column(db.Float)
    water_resistance = db.Column(db.String(50))
    notes = db.Column(db.Text)
    image_filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    periods = db.relationship('TimekeepingPeriod', backref='watch', cascade='all, delete-orphan',
                              order_by='TimekeepingPeriod.started_at.desc()')
    service_logs = db.relationship('WatchServiceLog', backref='watch', cascade='all, delete-orphan',
                                   order_by='WatchServiceLog.service_date.desc()')

    def active_period(self):
        """Return the active (unclosed) timekeeping period, or None."""
        for period in self.periods:
            if period.ended_at is None:
                return period
        return None

    def latest_service(self):
        """Return the most recent service log entry, or None."""
        return self.service_logs[0] if self.service_logs else None

    def to_dict(self, include_periods=False, include_services=False):
        active = self.active_period()
        latest_svc = self.latest_service()

        result = {
            'id': self.id,
            'name': self.name,
            'brand': self.brand,
            'model': self.model,
            'reference_number': self.reference_number,
            'serial_number': self.serial_number,
            'movement_type': self.movement_type,
            'movement_caliber': self.movement_caliber,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'purchase_price': self.purchase_price,
            'crystal_type': self.crystal_type,
            'case_size_mm': self.case_size_mm,
            'water_resistance': self.water_resistance,
            'notes': self.notes,
            'image_filename': self.image_filename,
            'image_url': f'/api/watches/{self.id}/image/file' if self.image_filename else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            # Summary fields for list view cards
            'has_active_period': active is not None,
            'current_rate': self._current_rate(active),
            'current_offset': self._current_offset(active),
            'last_service_date': latest_svc.service_date.isoformat() if latest_svc else None,
            'period_count': len(self.periods),
        }

        if include_periods:
            result['periods'] = [p.to_dict() for p in self.periods]
            result['active_period'] = active.to_dict(include_readings=True) if active else None

        if include_services:
            result['service_logs'] = [s.to_dict() for s in self.service_logs]

        return result

    def _current_rate(self, active):
        """Get the most recent rate from the active period."""
        if not active or not active.readings:
            return None
        # Find last reading with a non-null rate
        for reading in sorted(active.readings, key=lambda r: r.reference_time, reverse=True):
            if reading.rate is not None:
                return reading.rate
        return None

    def _current_offset(self, active):
        """Get the most recent offset from the active period."""
        if not active or not active.readings:
            return None
        latest = max(active.readings, key=lambda r: r.reference_time)
        return latest.offset_seconds


class TimekeepingPeriod(db.Model):
    __tablename__ = 'timekeeping_periods'

    id = db.Column(db.Integer, primary_key=True)
    watch_id = db.Column(db.Integer, db.ForeignKey('watches.id'), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    ended_at = db.Column(db.DateTime)  # Null = active
    avg_rate = db.Column(db.Float)
    total_readings = db.Column(db.Integer)
    best_rate = db.Column(db.Float)  # Closest to 0
    worst_rate = db.Column(db.Float)  # Furthest from 0
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    readings = db.relationship('TimekeepingReading', backref='period', cascade='all, delete-orphan',
                               order_by='TimekeepingReading.reference_time.asc()')

    def compute_stats(self):
        """Compute and cache period statistics from readings."""
        rates = [r.rate for r in self.readings if r.rate is not None]
        self.total_readings = len(self.readings)
        if rates:
            self.avg_rate = sum(rates) / len(rates)
            self.best_rate = min(rates, key=abs)
            self.worst_rate = max(rates, key=abs)
        else:
            self.avg_rate = None
            self.best_rate = None
            self.worst_rate = None

    def to_dict(self, include_readings=False):
        result = {
            'id': self.id,
            'watch_id': self.watch_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'avg_rate': self.avg_rate,
            'total_readings': self.total_readings or len(self.readings),
            'best_rate': self.best_rate,
            'worst_rate': self.worst_rate,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_readings:
            result['readings'] = [r.to_dict() for r in self.readings]
        return result


class TimekeepingReading(db.Model):
    __tablename__ = 'timekeeping_readings'

    id = db.Column(db.Integer, primary_key=True)
    period_id = db.Column(db.Integer, db.ForeignKey('timekeeping_periods.id'), nullable=False)
    watch_time = db.Column(db.DateTime, nullable=False)
    reference_time = db.Column(db.DateTime, nullable=False)
    offset_seconds = db.Column(db.Float)
    rate = db.Column(db.Float)  # sec/day since previous reading; null for first
    note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'period_id': self.period_id,
            'watch_time': self.watch_time.isoformat() if self.watch_time else None,
            'reference_time': self.reference_time.isoformat() if self.reference_time else None,
            'offset_seconds': self.offset_seconds,
            'rate': self.rate,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class WatchServiceLog(db.Model):
    __tablename__ = 'watch_service_logs'

    id = db.Column(db.Integer, primary_key=True)
    watch_id = db.Column(db.Integer, db.ForeignKey('watches.id'), nullable=False)
    service_date = db.Column(db.Date, nullable=False)
    return_date = db.Column(db.Date)
    service_type = db.Column(db.String(100))
    cost = db.Column(db.Float)
    watchmaker = db.Column(db.String(200))
    notes = db.Column(db.Text)
    rate_before = db.Column(db.Float)
    rate_after = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'watch_id': self.watch_id,
            'service_date': self.service_date.isoformat() if self.service_date else None,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'service_type': self.service_type,
            'cost': self.cost,
            'watchmaker': self.watchmaker,
            'notes': self.notes,
            'rate_before': self.rate_before,
            'rate_after': self.rate_after,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

**Step 2: Register model imports**

In `backend/app/models/__init__.py`, add at line 30:

```python
from .watch import Watch, TimekeepingPeriod, TimekeepingReading, WatchServiceLog
```

**Step 3: Commit**

```bash
git add backend/app/models/watch.py backend/app/models/__init__.py
git commit -m "feat(watches): add SQLAlchemy models for Watch, TimekeepingPeriod, TimekeepingReading, WatchServiceLog"
```

---

## Task 2: Backend API Routes — Watch CRUD + Image

**Files:**
- Create: `backend/app/routes/watches.py`
- Modify: `backend/app/__init__.py` (register blueprint after line 104)

**Step 1: Create the route file with Watch CRUD and image handling**

Create `backend/app/routes/watches.py`:

```python
import os
import uuid
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app import db
from app.models.watch import Watch, TimekeepingPeriod, TimekeepingReading, WatchServiceLog

watches_bp = Blueprint('watches', __name__)

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


# ─── Watch CRUD ───────────────────────────────────────────────

@watches_bp.route('/', methods=['GET'])
def list_watches():
    """GET /api/watches/ — List all watches with summary stats."""
    watches = Watch.query.order_by(Watch.name.asc()).all()
    return jsonify([w.to_dict() for w in watches])


@watches_bp.route('/', methods=['POST'])
def create_watch():
    """POST /api/watches/ — Create a new watch."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('brand'):
        return jsonify({'error': 'name and brand are required'}), 400

    watch = Watch(
        name=data['name'],
        brand=data['brand'],
        model=data.get('model'),
        reference_number=data.get('reference_number'),
        serial_number=data.get('serial_number'),
        movement_type=data.get('movement_type'),
        movement_caliber=data.get('movement_caliber'),
        purchase_date=date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else None,
        purchase_price=data.get('purchase_price'),
        crystal_type=data.get('crystal_type'),
        case_size_mm=data.get('case_size_mm'),
        water_resistance=data.get('water_resistance'),
        notes=data.get('notes'),
    )
    db.session.add(watch)
    db.session.commit()
    return jsonify(watch.to_dict()), 201


@watches_bp.route('/<int:watch_id>', methods=['GET'])
def get_watch(watch_id):
    """GET /api/watches/<id> — Get watch detail with periods and services."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify(watch.to_dict(include_periods=True, include_services=True))


@watches_bp.route('/<int:watch_id>', methods=['PUT'])
def update_watch(watch_id):
    """PUT /api/watches/<id> — Update watch metadata."""
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    for field in ('name', 'brand', 'model', 'reference_number', 'serial_number',
                  'movement_type', 'movement_caliber', 'crystal_type',
                  'case_size_mm', 'water_resistance', 'notes'):
        if field in data:
            setattr(watch, field, data[field])

    if 'purchase_date' in data:
        watch.purchase_date = date.fromisoformat(data['purchase_date']) if data['purchase_date'] else None
    if 'purchase_price' in data:
        watch.purchase_price = data['purchase_price']

    db.session.commit()
    return jsonify(watch.to_dict())


@watches_bp.route('/<int:watch_id>', methods=['DELETE'])
def delete_watch(watch_id):
    """DELETE /api/watches/<id> — Delete watch and all related data."""
    watch = Watch.query.get_or_404(watch_id)

    # Delete image file if exists
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
    return jsonify({'message': 'Watch deleted'}), 200


# ─── Watch Image ──────────────────────────────────────────────

@watches_bp.route('/<int:watch_id>/image', methods=['POST'])
def upload_watch_image(watch_id):
    """POST /api/watches/<id>/image — Upload watch photo."""
    watch = Watch.query.get_or_404(watch_id)

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({'error': f'File type .{ext} not allowed. Use: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400

    upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # Delete old image if exists
    if watch.image_filename:
        old_path = os.path.join(upload_dir, watch.image_filename)
        try:
            if os.path.exists(old_path):
                os.remove(old_path)
        except OSError:
            pass

    stored_name = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(upload_dir, stored_name))

    watch.image_filename = stored_name
    db.session.commit()
    return jsonify(watch.to_dict()), 200


@watches_bp.route('/<int:watch_id>/image/file', methods=['GET'])
def serve_watch_image(watch_id):
    """GET /api/watches/<id>/image/file — Serve the watch photo."""
    watch = Watch.query.get_or_404(watch_id)
    if not watch.image_filename:
        return jsonify({'error': 'No image for this watch'}), 404
    upload_dir = current_app.config.get('UPLOAD_DIR', '/app/uploads')
    return send_from_directory(upload_dir, watch.image_filename)


@watches_bp.route('/<int:watch_id>/image', methods=['DELETE'])
def delete_watch_image(watch_id):
    """DELETE /api/watches/<id>/image — Remove watch photo."""
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
```

**Step 2: Register the blueprint**

In `backend/app/__init__.py`, add after the last blueprint registration (after `jumpers_bp` around line 104):

```python
from app.routes.watches import watches_bp
app.register_blueprint(watches_bp, url_prefix='/api/watches')
```

**Step 3: Commit**

```bash
git add backend/app/routes/watches.py backend/app/__init__.py
git commit -m "feat(watches): add Watch CRUD and image upload API endpoints"
```

---

## Task 3: Backend API Routes — Timekeeping Periods & Readings

**Files:**
- Modify: `backend/app/routes/watches.py` (append to existing file)

**Step 1: Add period and reading endpoints**

Append the following to `backend/app/routes/watches.py`:

```python
# ─── Timekeeping Periods ──────────────────────────────────────

@watches_bp.route('/<int:watch_id>/periods', methods=['GET'])
def list_periods(watch_id):
    """GET /api/watches/<id>/periods — List all timekeeping periods."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify([p.to_dict() for p in watch.periods])


@watches_bp.route('/<int:watch_id>/periods/active', methods=['GET'])
def get_active_period(watch_id):
    """GET /api/watches/<id>/periods/active — Get the active period with readings."""
    watch = Watch.query.get_or_404(watch_id)
    active = watch.active_period()
    if not active:
        return jsonify({'error': 'No active timekeeping period'}), 404
    return jsonify(active.to_dict(include_readings=True))


@watches_bp.route('/<int:watch_id>/periods', methods=['POST'])
def create_period(watch_id):
    """POST /api/watches/<id>/periods — Start a new period (auto-closes active)."""
    watch = Watch.query.get_or_404(watch_id)

    # Close any existing active period
    active = watch.active_period()
    if active:
        active.ended_at = datetime.now(timezone.utc)
        active.compute_stats()

    period = TimekeepingPeriod(
        watch_id=watch.id,
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(period)
    db.session.commit()
    return jsonify(period.to_dict()), 201


@watches_bp.route('/<int:watch_id>/periods/reset', methods=['POST'])
def reset_period(watch_id):
    """POST /api/watches/<id>/periods/reset — Close the active period."""
    watch = Watch.query.get_or_404(watch_id)
    active = watch.active_period()
    if not active:
        return jsonify({'error': 'No active timekeeping period to reset'}), 404

    data = request.get_json() or {}
    active.ended_at = datetime.now(timezone.utc)
    active.notes = data.get('notes')
    active.compute_stats()
    db.session.commit()
    return jsonify(active.to_dict(include_readings=True))


@watches_bp.route('/periods/<int:period_id>', methods=['DELETE'])
def delete_period(period_id):
    """DELETE /api/watches/periods/<id> — Delete a period and its readings."""
    period = TimekeepingPeriod.query.get_or_404(period_id)
    db.session.delete(period)
    db.session.commit()
    return jsonify({'message': 'Period deleted'}), 200


# ─── Timekeeping Readings ─────────────────────────────────────

def _recalculate_rates(period):
    """Recalculate offset and rate for all readings in a period, in chronological order."""
    readings = sorted(period.readings, key=lambda r: r.reference_time)
    prev = None
    for reading in readings:
        reading.offset_seconds = (reading.watch_time - reading.reference_time).total_seconds()
        if prev:
            elapsed_days = (reading.reference_time - prev.reference_time).total_seconds() / 86400.0
            if elapsed_days > 0:
                reading.rate = (reading.offset_seconds - prev.offset_seconds) / elapsed_days
            else:
                reading.rate = None
        else:
            reading.rate = None
        prev = reading


@watches_bp.route('/<int:watch_id>/readings', methods=['POST'])
def create_reading(watch_id):
    """POST /api/watches/<id>/readings — Add a timekeeping reading.

    If no active period exists, one is created automatically.
    Expects JSON: { watch_time: ISO datetime, reference_time: ISO datetime, note?: string }
    Server computes offset_seconds and rate.
    """
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    if not data or not data.get('watch_time') or not data.get('reference_time'):
        return jsonify({'error': 'watch_time and reference_time are required'}), 400

    watch_time = datetime.fromisoformat(data['watch_time'])
    reference_time = datetime.fromisoformat(data['reference_time'])

    # Auto-create period if none active
    active = watch.active_period()
    if not active:
        active = TimekeepingPeriod(
            watch_id=watch.id,
            started_at=reference_time,
        )
        db.session.add(active)
        db.session.flush()  # Get the ID

    reading = TimekeepingReading(
        period_id=active.id,
        watch_time=watch_time,
        reference_time=reference_time,
        note=data.get('note'),
    )
    db.session.add(reading)
    db.session.flush()

    # Recalculate all rates in the period (handles insertion order)
    _recalculate_rates(active)
    db.session.commit()

    return jsonify(reading.to_dict()), 201


@watches_bp.route('/readings/<int:reading_id>', methods=['PUT'])
def update_reading(reading_id):
    """PUT /api/watches/readings/<id> — Edit a reading (recalculates cascading rates)."""
    reading = TimekeepingReading.query.get_or_404(reading_id)
    data = request.get_json()

    if data.get('watch_time'):
        reading.watch_time = datetime.fromisoformat(data['watch_time'])
    if data.get('reference_time'):
        reading.reference_time = datetime.fromisoformat(data['reference_time'])
    if 'note' in data:
        reading.note = data['note']

    # Recalculate all rates in the period
    _recalculate_rates(reading.period)
    db.session.commit()

    return jsonify(reading.to_dict())


@watches_bp.route('/readings/<int:reading_id>', methods=['DELETE'])
def delete_reading(reading_id):
    """DELETE /api/watches/readings/<id> — Delete a reading (recalculates rates)."""
    reading = TimekeepingReading.query.get_or_404(reading_id)
    period = reading.period

    db.session.delete(reading)
    db.session.flush()

    # Recalculate remaining readings
    _recalculate_rates(period)
    db.session.commit()

    return jsonify({'message': 'Reading deleted'}), 200
```

**Step 2: Commit**

```bash
git add backend/app/routes/watches.py
git commit -m "feat(watches): add timekeeping period and reading API endpoints with rate recalculation"
```

---

## Task 4: Backend API Routes — Service Log & Statistics

**Files:**
- Modify: `backend/app/routes/watches.py` (append to existing file)

**Step 1: Add service log and statistics endpoints**

Append the following to `backend/app/routes/watches.py`:

```python
# ─── Service Log ──────────────────────────────────────────────

@watches_bp.route('/<int:watch_id>/services', methods=['GET'])
def list_services(watch_id):
    """GET /api/watches/<id>/services — List service logs."""
    watch = Watch.query.get_or_404(watch_id)
    return jsonify([s.to_dict() for s in watch.service_logs])


@watches_bp.route('/<int:watch_id>/services', methods=['POST'])
def create_service(watch_id):
    """POST /api/watches/<id>/services — Add a service record."""
    watch = Watch.query.get_or_404(watch_id)
    data = request.get_json()

    if not data or not data.get('service_date'):
        return jsonify({'error': 'service_date is required'}), 400

    service = WatchServiceLog(
        watch_id=watch.id,
        service_date=date.fromisoformat(data['service_date']),
        return_date=date.fromisoformat(data['return_date']) if data.get('return_date') else None,
        service_type=data.get('service_type'),
        cost=data.get('cost'),
        watchmaker=data.get('watchmaker'),
        notes=data.get('notes'),
        rate_before=data.get('rate_before'),
        rate_after=data.get('rate_after'),
    )
    db.session.add(service)
    db.session.commit()
    return jsonify(service.to_dict()), 201


@watches_bp.route('/services/<int:service_id>', methods=['PUT'])
def update_service(service_id):
    """PUT /api/watches/services/<id> — Edit a service record."""
    service = WatchServiceLog.query.get_or_404(service_id)
    data = request.get_json()

    if data.get('service_date'):
        service.service_date = date.fromisoformat(data['service_date'])
    if 'return_date' in data:
        service.return_date = date.fromisoformat(data['return_date']) if data['return_date'] else None
    for field in ('service_type', 'cost', 'watchmaker', 'notes', 'rate_before', 'rate_after'):
        if field in data:
            setattr(service, field, data[field])

    db.session.commit()
    return jsonify(service.to_dict())


@watches_bp.route('/services/<int:service_id>', methods=['DELETE'])
def delete_service(service_id):
    """DELETE /api/watches/services/<id> — Delete a service record."""
    service = WatchServiceLog.query.get_or_404(service_id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({'message': 'Service record deleted'}), 200


# ─── Statistics ───────────────────────────────────────────────

@watches_bp.route('/<int:watch_id>/stats', methods=['GET'])
def get_stats(watch_id):
    """GET /api/watches/<id>/stats — Aggregated lifetime statistics."""
    watch = Watch.query.get_or_404(watch_id)

    closed_periods = [p for p in watch.periods if p.ended_at is not None]
    active = watch.active_period()

    # Collect all rates across all periods (including active)
    all_rates = []
    period_summaries = []

    for period in watch.periods:
        rates = [r.rate for r in period.readings if r.rate is not None]
        if rates:
            avg = sum(rates) / len(rates)
            all_rates.extend(rates)
            period_summaries.append({
                'period_id': period.id,
                'started_at': period.started_at.isoformat() if period.started_at else None,
                'ended_at': period.ended_at.isoformat() if period.ended_at else None,
                'avg_rate': avg,
                'best_rate': min(rates, key=abs),
                'worst_rate': max(rates, key=abs),
                'reading_count': len(period.readings),
                'is_active': period.ended_at is None,
            })

    # Total tracking days
    total_days = 0
    for period in watch.periods:
        end = period.ended_at or datetime.now(timezone.utc)
        delta = (end - period.started_at).total_seconds() / 86400.0
        total_days += max(0, delta)

    # Rate trend: compare first half of periods to second half
    trend_direction = None
    if len(period_summaries) >= 4:
        mid = len(period_summaries) // 2
        early_avg = sum(p['avg_rate'] for p in period_summaries[:mid]) / mid
        late_avg = sum(p['avg_rate'] for p in period_summaries[mid:]) / (len(period_summaries) - mid)
        # Closer to 0 = improving
        if abs(late_avg) < abs(early_avg):
            trend_direction = 'improving'
        elif abs(late_avg) > abs(early_avg):
            trend_direction = 'degrading'
        else:
            trend_direction = 'stable'

    return jsonify({
        'overall_avg_rate': sum(all_rates) / len(all_rates) if all_rates else None,
        'overall_best_rate': min(all_rates, key=abs) if all_rates else None,
        'overall_worst_rate': max(all_rates, key=abs) if all_rates else None,
        'total_periods': len(watch.periods),
        'completed_periods': len(closed_periods),
        'total_tracking_days': round(total_days, 1),
        'total_readings': sum(len(p.readings) for p in watch.periods),
        'trend_direction': trend_direction,
        'period_summaries': period_summaries,
        'current_rate': watch._current_rate(active),
        'current_offset': watch._current_offset(active),
    })
```

**Step 2: Commit**

```bash
git add backend/app/routes/watches.py
git commit -m "feat(watches): add service log CRUD and lifetime statistics endpoint"
```

---

## Task 5: iOS Models (Swift Codable Structs)

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Models/Watch.swift`

**Step 1: Create the Swift model file**

All structs are `Codable`, `Sendable`, `Identifiable`. APIClient's `keyDecodingStrategy = .convertFromSnakeCase` handles the snake_case -> camelCase conversion automatically.

```swift
import Foundation

// MARK: - Watch

struct Watch: Codable, Sendable, Identifiable {
    let id: Int
    let name: String
    let brand: String
    let model: String?
    let referenceNumber: String?
    let serialNumber: String?
    let movementType: String?
    let movementCaliber: String?
    let purchaseDate: String?  // ISO date string
    let purchasePrice: Double?
    let crystalType: String?
    let caseSizeMm: Double?
    let waterResistance: String?
    let notes: String?
    let imageFilename: String?
    let imageUrl: String?
    let createdAt: String?

    // Summary fields (from list endpoint)
    let hasActivePeriod: Bool?
    let currentRate: Double?
    let currentOffset: Double?
    let lastServiceDate: String?
    let periodCount: Int?

    // Detail fields (from detail endpoint)
    let periods: [TimekeepingPeriod]?
    let activePeriod: TimekeepingPeriod?
    let serviceLogs: [WatchServiceLog]?

    var displayName: String {
        if let model {
            return "\(brand) \(model)"
        }
        return brand
    }
}

// MARK: - TimekeepingPeriod

struct TimekeepingPeriod: Codable, Sendable, Identifiable {
    let id: Int
    let watchId: Int
    let startedAt: String?
    let endedAt: String?
    let avgRate: Double?
    let totalReadings: Int?
    let bestRate: Double?
    let worstRate: Double?
    let notes: String?
    let createdAt: String?
    let readings: [TimekeepingReading]?

    var isActive: Bool { endedAt == nil }

    var startDate: Date? {
        guard let startedAt else { return nil }
        return ISO8601DateFormatter().date(from: startedAt)
    }

    var endDate: Date? {
        guard let endedAt else { return nil }
        return ISO8601DateFormatter().date(from: endedAt)
    }

    var durationDays: Double? {
        guard let start = startDate else { return nil }
        let end = endDate ?? Date()
        return end.timeIntervalSince(start) / 86400.0
    }
}

// MARK: - TimekeepingReading

struct TimekeepingReading: Codable, Sendable, Identifiable {
    let id: Int
    let periodId: Int
    let watchTime: String?
    let referenceTime: String?
    let offsetSeconds: Double?
    let rate: Double?
    let note: String?
    let createdAt: String?

    var watchDate: Date? {
        guard let watchTime else { return nil }
        return ISO8601DateFormatter().date(from: watchTime)
    }

    var referenceDate: Date? {
        guard let referenceTime else { return nil }
        return ISO8601DateFormatter().date(from: referenceTime)
    }
}

// MARK: - WatchServiceLog

struct WatchServiceLog: Codable, Sendable, Identifiable {
    let id: Int
    let watchId: Int
    let serviceDate: String?
    let returnDate: String?
    let serviceType: String?
    let cost: Double?
    let watchmaker: String?
    let notes: String?
    let rateBefore: Double?
    let rateAfter: Double?
    let createdAt: String?
}

// MARK: - WatchStats (from /stats endpoint)

struct WatchStats: Codable, Sendable {
    let overallAvgRate: Double?
    let overallBestRate: Double?
    let overallWorstRate: Double?
    let totalPeriods: Int?
    let completedPeriods: Int?
    let totalTrackingDays: Double?
    let totalReadings: Int?
    let trendDirection: String?  // "improving", "degrading", "stable"
    let periodSummaries: [PeriodSummary]?
    let currentRate: Double?
    let currentOffset: Double?
}

struct PeriodSummary: Codable, Sendable, Identifiable {
    let periodId: Int
    let startedAt: String?
    let endedAt: String?
    let avgRate: Double?
    let bestRate: Double?
    let worstRate: Double?
    let readingCount: Int?
    let isActive: Bool?

    var id: Int { periodId }
}

// MARK: - Form Data (for POST/PUT requests)

struct WatchFormData: Codable, Sendable {
    let name: String
    let brand: String
    let model: String?
    let referenceNumber: String?
    let serialNumber: String?
    let movementType: String?
    let movementCaliber: String?
    let purchaseDate: String?
    let purchasePrice: Double?
    let crystalType: String?
    let caseSizeMm: Double?
    let waterResistance: String?
    let notes: String?
}

struct ReadingFormData: Codable, Sendable {
    let watchTime: String  // ISO datetime
    let referenceTime: String  // ISO datetime
    let note: String?
}

struct ServiceFormData: Codable, Sendable {
    let serviceDate: String
    let returnDate: String?
    let serviceType: String?
    let cost: Double?
    let watchmaker: String?
    let notes: String?
    let rateBefore: Double?
    let rateAfter: Double?
}

struct PeriodResetData: Codable, Sendable {
    let notes: String?
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/Watch.swift
git commit -m "feat(watches): add Swift Codable model structs"
```

---

## Task 6: iOS Network Layer — Endpoint Cases

**Files:**
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Network/Endpoint.swift`

**Step 1: Add endpoint cases**

Add the following cases to the `Endpoint` enum (after the Debts section, around line 223):

```swift
// MARK: - Watches
case watches                                       // GET  /api/watches/
case watch(id: Int)                                // GET  /api/watches/<id>
case createWatch                                   // POST /api/watches/
case updateWatch(id: Int)                          // PUT  /api/watches/<id>
case deleteWatch(id: Int)                          // DELETE /api/watches/<id>
case watchImage(id: Int)                           // POST /api/watches/<id>/image
case watchImageFile(id: Int)                       // GET  /api/watches/<id>/image/file
case deleteWatchImage(id: Int)                     // DELETE /api/watches/<id>/image
case watchPeriods(watchId: Int)                    // GET  /api/watches/<id>/periods
case watchActivePeriod(watchId: Int)               // GET  /api/watches/<id>/periods/active
case createWatchPeriod(watchId: Int)               // POST /api/watches/<id>/periods
case resetWatchPeriod(watchId: Int)                // POST /api/watches/<id>/periods/reset
case deleteWatchPeriod(periodId: Int)              // DELETE /api/watches/periods/<id>
case createWatchReading(watchId: Int)              // POST /api/watches/<id>/readings
case updateWatchReading(readingId: Int)            // PUT  /api/watches/readings/<id>
case deleteWatchReading(readingId: Int)            // DELETE /api/watches/readings/<id>
case watchServices(watchId: Int)                   // GET  /api/watches/<id>/services
case createWatchService(watchId: Int)              // POST /api/watches/<id>/services
case updateWatchService(serviceId: Int)            // PUT  /api/watches/services/<id>
case deleteWatchService(serviceId: Int)            // DELETE /api/watches/services/<id>
case watchStats(watchId: Int)                      // GET  /api/watches/<id>/stats
```

Add the corresponding path cases to the `path` computed property switch:

```swift
case .watches, .createWatch:                       return "/api/watches/"
case .watch(let id),
     .updateWatch(let id),
     .deleteWatch(let id):                         return "/api/watches/\(id)"
case .watchImage(let id):                          return "/api/watches/\(id)/image"
case .watchImageFile(let id):                      return "/api/watches/\(id)/image/file"
case .deleteWatchImage(let id):                    return "/api/watches/\(id)/image"
case .watchPeriods(let wid),
     .createWatchPeriod(let wid):                  return "/api/watches/\(wid)/periods"
case .watchActivePeriod(let wid):                  return "/api/watches/\(wid)/periods/active"
case .resetWatchPeriod(let wid):                   return "/api/watches/\(wid)/periods/reset"
case .deleteWatchPeriod(let pid):                  return "/api/watches/periods/\(pid)"
case .createWatchReading(let wid):                 return "/api/watches/\(wid)/readings"
case .updateWatchReading(let rid):                 return "/api/watches/readings/\(rid)"
case .deleteWatchReading(let rid):                 return "/api/watches/readings/\(rid)"
case .watchServices(let wid),
     .createWatchService(let wid):                 return "/api/watches/\(wid)/services"
case .updateWatchService(let sid):                 return "/api/watches/services/\(sid)"
case .deleteWatchService(let sid):                 return "/api/watches/services/\(sid)"
case .watchStats(let wid):                         return "/api/watches/\(wid)/stats"
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Network/Endpoint.swift
git commit -m "feat(watches): add API endpoint cases for watch timekeeping module"
```

---

## Task 7: iOS Design System — Module Accent Color

**Files:**
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Design/DatacoreColors.swift`

**Step 1: Add `.watches` case to `ModuleAccent`**

Add `case watches` to the enum (after `gpsTracking`, line 17).

Add the color mapping in the `color` computed property switch:

```swift
case .watches: return .indigo
```

The `gradient` and `areaGradient` computed properties derive automatically from `color`.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Design/DatacoreColors.swift
git commit -m "feat(watches): add .watches module accent color (indigo)"
```

---

## Task 8: iOS ViewModel — WatchesViewModel

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/ViewModels/WatchesViewModel.swift`

**Step 1: Create the ViewModel**

This ViewModel manages all watch module state: list, detail, CRUD operations, readings, periods, services, and stats. Follows the `@Observable @MainActor` pattern used by all other ViewModels.

Key design decisions:
- `loadWatches()` for the list view
- `loadWatch(id:)` for the detail view (fetches full detail with periods + services)
- `loadStats(watchId:)` for the statistics data
- All mutating operations (create, update, delete) return `Bool` for success/failure
- `_recalculateRates` is NOT needed client-side — the server handles all rate recalculation

The ViewModel will be large but follows the exact same patterns as `VehiclesViewModel`. Create it with all CRUD methods for watches, readings, periods, and services.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/ViewModels/WatchesViewModel.swift
git commit -m "feat(watches): add WatchesViewModel with full CRUD operations"
```

---

## Task 9: iOS Navigation Integration

**Files:**
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Models/AppModule.swift` (add `.watches` case, line 4-5)
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/ContentView.swift` (add to `selectedModuleView` switch, around line 157)
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Shared/iPadSidebar.swift` (add sidebar row)
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Shared/ModuleLauncherSheet.swift` (add module card)

**Step 1: Add `.watches` to `AppModule` enum**

In `AppModule.swift`, add `watches` to the enum cases and add a title case:

```swift
case watches
// In title switch:
case .watches: return "Watches"
```

**Step 2: Add to ContentView `selectedModuleView`**

In the switch statement mapping modules to views:

```swift
case .watches:
    WatchesListView()
```

**Step 3: Add to iPad sidebar**

Add a `sidebarRow(.watches, icon: "clock.fill", label: "Watches")` in an appropriate section.

**Step 4: Add to ModuleLauncherSheet**

Add a `moduleCard(.watches, icon: "clock.fill", tint: .indigo)` with appropriate stagger reveal index.

**Step 5: Inject the ViewModel**

Ensure `WatchesViewModel` is created and injected via `.environment()` at the app's root level (same pattern as other ViewModels). Check the app entry point to see where ViewModels are injected.

**Step 6: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -A
git commit -m "feat(watches): integrate watches module into navigation (tabs, sidebar, launcher)"
```

---

## Task 10: iOS Views — WatchesListView + WatchCardView

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchesListView.swift`
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchCardView.swift`

**Step 1: Create WatchesListView**

The collection/landing page. iPhone: single-column `LazyVStack`. iPad/Mac: 2-column `LazyVGrid` via `AdaptiveGrid`.

Key elements:
- `@Environment(WatchesViewModel.self)` for data
- `@Environment(\.horizontalSizeClass)` for layout branching
- `@State private var hasAppeared = false` for stagger reveals
- Toolbar "+" button presenting `WatchFormView` as sheet
- `.task { await vm.loadWatches() }` + `.refreshable`
- Loading: shimmer skeletons. Empty: `EmptyStateView` with `clock.fill` icon
- Each card is a `NavigationLink` to `WatchDetailView`

**Step 2: Create WatchCardView**

A card component displaying a single watch in the list. Uses `.buttonStyle(.datacoreCard)`.

Layout:
- Leading: Watch photo (rounded rectangle, 60x60) or placeholder icon
- Center: Name (primary), Brand/Model (secondary)
- Trailing stack: 3 mini stats — Rate (with `CountingNumber`, colored by magnitude), Offset, Last Service
- Status dot (green circle if active period, gray if not)
- `.staggerReveal(index:isVisible:)`

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchesListView.swift Datacore/Views/Watches/WatchCardView.swift
git commit -m "feat(watches): add collection view with watch cards"
```

---

## Task 11: iOS Views — WatchFormView (Create/Edit)

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchFormView.swift`

**Step 1: Create the form**

Bi-modal form (create vs edit) using `Mode` enum pattern. Follows the established form pattern where the form calls ViewModel methods directly.

Sections:
- **Required:** Name, Brand
- **Model Details:** Model, Reference Number, Serial Number
- **Movement:** Movement Type (Picker: automatic/manual/quartz), Caliber
- **Case:** Crystal Type (Picker: sapphire/mineral/acrylic), Case Size (TextField + "mm"), Water Resistance
- **Purchase:** Purchase Date (DatePicker), Purchase Price (TextField + "$")
- **Notes:** TextEditor

All TextFields use appropriate keyboard types. No Steppers (per coding standards). Pickers use `.pickerStyle(.menu)`.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchFormView.swift
git commit -m "feat(watches): add watch create/edit form"
```

---

## Task 12: iOS Views — WatchDetailView + WatchOverviewTab

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchDetailView.swift`
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchOverviewTab.swift`

**Step 1: Create WatchDetailView**

The 4-tab container. Segmented Picker with `.platformFeedback(.selection)` on tab change. Tab enum: `.overview`, `.accuracy`, `.history`, `.service`.

- iPhone: icon-only tabs. iPad/Mac: labeled tabs
- `.task { await vm.loadWatch(id:) }` + `.refreshable`
- Loading state: shimmer skeletons on iPhone
- `.navigationBarTitleDisplayMode(sizeClass == .regular ? .inline : .large)`
- Toolbar: edit button (presents `WatchFormView` in edit mode)

**Step 2: Create WatchOverviewTab**

- Hero image section (rounded rectangle, parallax in scroll, tap to change photo via image picker)
- Specs section: grouped rows for all watch metadata
- Quick Stats: 2x2 `PremiumStatCard` grid
  - Current Rate (sec/day) with `TrendBadge` + `MiniSparkline` of recent rates
  - Current Offset (seconds)
  - Total Tracking Days
  - Periods Completed
- Last Service card showing most recent service or empty state
- All sections use `.scrollReveal()`

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchDetailView.swift Datacore/Views/Watches/WatchOverviewTab.swift
git commit -m "feat(watches): add detail view shell and overview tab"
```

---

## Task 13: iOS Views — ReadingCaptureView

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/ReadingCaptureView.swift`

**Step 1: Create the reading capture view**

This is the core interaction for the entire module. Two capture modes:

**Manual Mode:**
- Hour picker (1-12, Picker with `.pickerStyle(.menu)`)
- Minute picker (0-59, Picker with `.pickerStyle(.menu)`)
- Second picker (0, 15, 30, 45 — Picker with `.pickerStyle(.menu)`)
- AM/PM picker (segmented)
- Large "Capture" button that:
  1. Records `Date()` as `referenceTime`
  2. Constructs `watchTime` from the picker values (using the same date as reference but with the entered H:M:S)
  3. Calls `vm.createReading(watchId:, data:)`
  4. `.platformFeedback(.success)` on save
  5. Dismisses

**Photo Mode:**
- Camera capture using `UIImagePickerController` or `PhotosUI` — records `Date()` at capture moment as `referenceTime`
- Shows photo preview (not persisted — only used to read the time)
- Same H:M:S pickers appear below the photo
- Save constructs `watchTime`, calls API, discards photo, dismisses

**Important:** The `watchTime` DateTime must be constructed carefully. Use the `referenceTime`'s date (year/month/day) combined with the user's entered hour/minute/second. Handle the edge case where it's 11:59 PM on the phone but the watch shows 12:01 AM (crossed midnight) — in this case the watch date should be the next day.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/ReadingCaptureView.swift
git commit -m "feat(watches): add reading capture view with manual and photo modes"
```

---

## Task 14: iOS Views — ReadingEditView

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/ReadingEditView.swift`

**Step 1: Create the edit view**

Simple form pre-populated from an existing `TimekeepingReading`. Allows editing:
- Hour/Minute/Second pickers (pre-filled from `watchTime`)
- AM/PM (pre-filled)
- Note text field
- Save calls `vm.updateReading(readingId:, data:)`
- Delete button with confirmation calls `vm.deleteReading(readingId:)`

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/ReadingEditView.swift
git commit -m "feat(watches): add reading edit view"
```

---

## Task 15: iOS Views — WatchAccuracyTab

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchAccuracyTab.swift`

**Step 1: Create the accuracy tab**

The active period view with readings list and charts.

Sections:
- **Period Header:** "Period started [date]" with duration. "Reset Period" button with confirmation alert (calls `vm.resetPeriod(watchId:)`). `.platformFeedback(.success)` on reset.
- **New Reading Button:** Prominent button presenting `ReadingCaptureView` as sheet
- **Readings List:** Reverse-chronological. Each row shows:
  - Watch time (formatted as "10:31:00 AM")
  - Reference time
  - Offset (colored: green < 3s, yellow 3-10s, red > 10s absolute)
  - Rate (sec/day) with `TrendBadge`
  - Swipe `.onDelete` and tap to present `ReadingEditView`
  - `.staggerReveal()`
- **Charts (using Swift Charts):**
  - **Offset Over Time:** `LineMark` with `AreaMark` gradient fill. X = reference_time, Y = offset_seconds. `ModuleAccent.watches.areaGradient`.
  - **Rate Over Time:** `LineMark` for individual rates + `RuleMark` for average. X = reference_time, Y = rate.
  - Both charts: Catmull-Rom interpolation, `.scrollReveal()`, labeled axes
- **Empty state** if no active period: "Start tracking" prompt with button to create first reading

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchAccuracyTab.swift
git commit -m "feat(watches): add accuracy tab with readings list and charts"
```

---

## Task 16: iOS Views — WatchHistoryTab

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchHistoryTab.swift`

**Step 1: Create the history tab**

Shows closed periods and cross-period analysis.

Sections:
- **Period List:** `DisclosureGroup` or expandable cards for each closed period:
  - Header: date range, duration, avg rate (`TrendBadge`), reading count
  - Expanded: individual readings listed (same row format as accuracy tab)
  - `.staggerReveal()` on cards
- **Cross-Period Charts (using Swift Charts):**
  - **Avg Rate Per Period:** `BarMark`. X = period index or start date, Y = avg_rate. Color by rate magnitude.
  - **Rate Trend:** `LineMark` connecting period avg_rates. Shows long-term accuracy trend.
  - **Consistency:** `RectangleMark` or range bars showing best/worst spread per period.
  - All charts: `.scrollReveal()`, labeled, `ModuleAccent.watches` colors
- **Empty state** if no closed periods

This tab uses `vm.stats` (loaded via `vm.loadStats(watchId:)`) for the `periodSummaries` chart data.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchHistoryTab.swift
git commit -m "feat(watches): add history tab with period list and cross-period charts"
```

---

## Task 17: iOS Views — WatchServiceTab + WatchServiceFormView

**Files:**
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchServiceTab.swift`
- Create: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Watches/WatchServiceFormView.swift`

**Step 1: Create WatchServiceTab**

Simple reverse-chronological list of service records.
- Each row: service date, type, cost (if present), watchmaker
- Rate improvement shown if both `rateBefore` and `rateAfter` are set
- Swipe to delete, tap to edit (presents `WatchServiceFormView`)
- Toolbar "+" button to add new service
- `.staggerReveal()` on rows
- Empty state if no services

**Step 2: Create WatchServiceFormView**

Bi-modal form (create/edit). Fields:
- Service Date (DatePicker, required)
- Return Date (DatePicker, optional)
- Service Type (TextField with common suggestions: "Full Service", "Regulation", "Crystal Replacement", "Gasket Replacement", "Battery Replacement")
- Cost (TextField, `.keyboardType(.decimalPad)`)
- Watchmaker (TextField)
- Notes (TextEditor)
- Rate Before / Rate After (TextFields, `.keyboardType(.decimalPad)`, optional — auto-populated from current rate if available)

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Watches/WatchServiceTab.swift Datacore/Views/Watches/WatchServiceFormView.swift
git commit -m "feat(watches): add service log tab and service form"
```

---

## Task 18: Dashboard Integration

**Files:**
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Dashboard/DashboardView.swift`

**Step 1: Add watch summary to dashboard**

Add a compact watch summary section to the dashboard. This should show:
- Number of watches being tracked
- Most accurate watch (lowest absolute avg_rate)
- Any watches needing service (if you want to add that later — for now just a count + best performer)

Use `PremiumStatCard` for the stats. Use `ModuleAccent.watches.color` (indigo).

The `WatchesViewModel` should be available via environment. Add a `loadWatchesSummary()` method if needed (or reuse `loadWatches()` which already includes summary fields).

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Dashboard/DashboardView.swift
git commit -m "feat(watches): add watch summary card to dashboard"
```

---

## Task 19: Build Verification + xcodegen

**Step 1: Regenerate Xcode project**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
```

**Step 2: Build iOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Build macOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 4: Fix any build errors until both targets produce zero errors**

**Step 5: Ask about version bump**

Check current `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.yml`. Ask user whether to bump.

**Step 6: Final commit + push**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -A
git commit -m "feat(watches): watch timekeeping accuracy module — complete implementation"
```

Push both repos:
```bash
# Backend (Personal_Database)
cd /Users/chaseburrell/Documents/VisualStudioCode/Personal_Database
git push origin main

# Apple app
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git push origin main
```
