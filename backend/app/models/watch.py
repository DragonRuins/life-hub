"""
Watch Timekeeping Module - Database Models

Defines four tables:
  - watches: Mechanical/quartz watches you own or track
  - timekeeping_periods: A measurement window (start -> end) for tracking accuracy
  - timekeeping_readings: Individual time comparisons within a period
  - watch_service_logs: Service/repair history for a watch

SQLAlchemy models map Python classes to database tables.
Each attribute becomes a column. You interact with the database
using Python objects instead of writing raw SQL.
"""
from datetime import datetime, timezone
from app import db


class Watch(db.Model):
    """A watch you own or track for timekeeping accuracy."""
    __tablename__ = 'watches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)          # Display name, e.g., "Daily Speedmaster"
    brand = db.Column(db.String(100), nullable=False)         # e.g., "Omega"
    model = db.Column(db.String(100))                          # e.g., "Speedmaster Professional"
    reference_number = db.Column(db.String(100))               # e.g., "311.30.42.30.01.005"
    serial_number = db.Column(db.String(100))                  # Unique to your piece
    movement_type = db.Column(db.String(50))                   # "automatic", "manual", "quartz"
    movement_caliber = db.Column(db.String(100))               # e.g., "Calibre 1861"
    purchase_date = db.Column(db.Date)
    purchase_price = db.Column(db.Float)
    crystal_type = db.Column(db.String(50))                    # e.g., "hesalite", "sapphire"
    case_size_mm = db.Column(db.Float)                         # Diameter in mm
    water_resistance = db.Column(db.String(50))                # e.g., "50m", "200m"
    notes = db.Column(db.Text)
    image_filename = db.Column(db.String(255))                 # UUID-stored image filename

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one watch has many timekeeping periods
    # Ordered newest-first so the active/latest period is first
    periods = db.relationship(
        'TimekeepingPeriod', backref='watch', cascade='all, delete-orphan',
        order_by='TimekeepingPeriod.started_at.desc()'
    )

    # Relationship: one watch has many service logs
    service_logs = db.relationship(
        'WatchServiceLog', backref='watch', cascade='all, delete-orphan',
        order_by='WatchServiceLog.service_date.desc()'
    )

    def active_period(self):
        """Return the currently active (open) timekeeping period, or None."""
        for period in self.periods:
            if period.ended_at is None:
                return period
        return None

    def latest_service(self):
        """Return the most recent service log entry, or None."""
        return self.service_logs[0] if self.service_logs else None

    def _current_rate(self, active):
        """Get the last non-null rate from the active period's readings."""
        if not active or not active.readings:
            return None
        # Readings are ordered by reference_time asc, so iterate backwards
        for reading in reversed(active.readings):
            if reading.rate is not None:
                return reading.rate
        return None

    def _current_offset(self, active):
        """Get the latest offset_seconds from the active period."""
        if not active or not active.readings:
            return None
        # Last reading (latest reference_time) has the most recent offset
        return active.readings[-1].offset_seconds

    def to_dict(self, include_periods=False, include_services=False):
        """Convert to dictionary for JSON responses.

        Args:
            include_periods: If True, include full period data with readings.
            include_services: If True, include full service log data.
        """
        active = self.active_period()
        last_service = self.latest_service()

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
            # Summary fields
            'has_active_period': active is not None,
            'current_rate': self._current_rate(active),
            'current_offset': self._current_offset(active),
            'last_service_date': last_service.service_date.isoformat() if last_service else None,
            'period_count': len(self.periods),
        }

        if include_periods:
            result['periods'] = [p.to_dict(include_readings=True) for p in self.periods]
            result['active_period'] = active.to_dict(include_readings=True) if active else None

        if include_services:
            result['service_logs'] = [s.to_dict() for s in self.service_logs]

        return result


class TimekeepingPeriod(db.Model):
    """A measurement window for tracking watch accuracy over time.

    A period starts when you begin measuring and ends when you close it.
    While open, you add readings by comparing the watch time to a reference.
    On close, stats (avg_rate, best_rate, worst_rate) are cached.
    """
    __tablename__ = 'timekeeping_periods'

    id = db.Column(db.Integer, primary_key=True)
    watch_id = db.Column(db.Integer, db.ForeignKey('watches.id'), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)        # When tracking began
    ended_at = db.Column(db.DateTime)                           # Null while active
    avg_rate = db.Column(db.Float)                              # Cached: average sec/day
    total_readings = db.Column(db.Integer)                      # Cached: number of readings
    best_rate = db.Column(db.Float)                             # Cached: closest to 0
    worst_rate = db.Column(db.Float)                            # Cached: furthest from 0
    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one period has many readings, ordered chronologically
    readings = db.relationship(
        'TimekeepingReading', backref='period', cascade='all, delete-orphan',
        order_by='TimekeepingReading.reference_time.asc()'
    )

    def compute_stats(self):
        """Calculate and cache stats from readings.

        Call this when closing a period or when stats need refreshing.
        - avg_rate: mean of all non-null rates
        - best_rate: rate closest to 0 (most accurate)
        - worst_rate: rate furthest from 0 (least accurate)
        - total_readings: count of all readings
        """
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
        """Convert to dictionary for JSON responses.

        Args:
            include_readings: If True, include all reading data.
        """
        result = {
            'id': self.id,
            'watch_id': self.watch_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'avg_rate': self.avg_rate,
            'total_readings': self.total_readings,
            'best_rate': self.best_rate,
            'worst_rate': self.worst_rate,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'reading_count': len(self.readings),
        }

        if include_readings:
            result['readings'] = [r.to_dict() for r in self.readings]

        return result


class TimekeepingReading(db.Model):
    """A single time comparison: what the watch shows vs. actual time.

    The offset is watch_time - reference_time in seconds.
    Positive = watch is fast, negative = watch is slow.
    The rate (sec/day) is computed from the delta between consecutive readings.
    """
    __tablename__ = 'timekeeping_readings'

    id = db.Column(db.Integer, primary_key=True)
    period_id = db.Column(db.Integer, db.ForeignKey('timekeeping_periods.id'), nullable=False)
    watch_time = db.Column(db.DateTime, nullable=False)        # Time shown on watch face
    reference_time = db.Column(db.DateTime, nullable=False)    # Phone's actual time at save
    offset_seconds = db.Column(db.Float)                        # watch_time - reference_time
    rate = db.Column(db.Float)                                  # sec/day since previous reading, null for first
    note = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
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
    """A service or repair record for a watch."""
    __tablename__ = 'watch_service_logs'

    id = db.Column(db.Integer, primary_key=True)
    watch_id = db.Column(db.Integer, db.ForeignKey('watches.id'), nullable=False)

    # Service details
    service_date = db.Column(db.Date, nullable=False)          # When sent for service
    return_date = db.Column(db.Date)                            # When returned from service
    service_type = db.Column(db.String(100))                    # e.g., "Full service", "Regulation", "Crystal replacement"
    cost = db.Column(db.Float)
    watchmaker = db.Column(db.String(200))                      # Who did the work

    # Accuracy before/after (sec/day) to measure service effectiveness
    rate_before = db.Column(db.Float)                           # sec/day before service
    rate_after = db.Column(db.Float)                            # sec/day after service

    notes = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'watch_id': self.watch_id,
            'service_date': self.service_date.isoformat() if self.service_date else None,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'service_type': self.service_type,
            'cost': self.cost,
            'watchmaker': self.watchmaker,
            'rate_before': self.rate_before,
            'rate_after': self.rate_after,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
