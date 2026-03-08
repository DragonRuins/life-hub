"""
OBD2 Module - Database Models

Defines three tables for OBD-II vehicle diagnostics data:
  - obd_snapshots: Real-time sensor readings (RPM, speed, temps, etc.)
  - obd_dtc_events: Diagnostic Trouble Codes with pending/cleared state
  - obd_trips: Aggregated trip summaries with distance and speed stats

All tables have a foreign key to the vehicles table with CASCADE delete.
Data flows from OBD-II adapter → Apple app → Flask API.
"""
from datetime import datetime, timezone
from app import db


# ── OBD Snapshots ──────────────────────────────────────────────

class OBDSnapshot(db.Model):
    """A single OBD-II sensor reading snapshot from a vehicle."""
    __tablename__ = 'obd_snapshots'
    __table_args__ = (
        db.Index('idx_obd_snapshot_vehicle_time', 'vehicle_id', db.text('recorded_at DESC')),
        db.Index('idx_obd_snapshot_time', db.text('recorded_at DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)                # When the snapshot was captured
    rpm = db.Column(db.Float)                                           # Engine RPM
    speed_kph = db.Column(db.Float)                                     # Vehicle speed in km/h
    coolant_temp_c = db.Column(db.Float)                                # Engine coolant temperature in Celsius
    engine_load_pct = db.Column(db.Float)                               # Calculated engine load percentage
    throttle_pct = db.Column(db.Float)                                  # Throttle position percentage
    intake_air_temp_c = db.Column(db.Float)                             # Intake air temperature in Celsius
    maf_rate_gs = db.Column(db.Float)                                   # Mass Air Flow rate in grams/second
    fuel_level_pct = db.Column(db.Float)                                # Fuel tank level percentage
    short_fuel_trim_pct = db.Column(db.Float)                           # Short-term fuel trim percentage
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'rpm': self.rpm,
            'speed_kph': self.speed_kph,
            'coolant_temp_c': self.coolant_temp_c,
            'engine_load_pct': self.engine_load_pct,
            'throttle_pct': self.throttle_pct,
            'intake_air_temp_c': self.intake_air_temp_c,
            'maf_rate_gs': self.maf_rate_gs,
            'fuel_level_pct': self.fuel_level_pct,
            'short_fuel_trim_pct': self.short_fuel_trim_pct,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── OBD DTC Events ────────────────────────────────────────────

class OBDDTCEvent(db.Model):
    """A Diagnostic Trouble Code event recorded from a vehicle's OBD-II port."""
    __tablename__ = 'obd_dtc_events'
    __table_args__ = (
        db.Index('idx_obd_dtc_vehicle_time', 'vehicle_id', db.text('recorded_at DESC')),
        db.Index('idx_obd_dtc_code', 'dtc_code'),
    )

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    dtc_code = db.Column(db.String(10), nullable=False)                 # e.g., "P0301", "P0420", "B1234"
    description = db.Column(db.Text)                                    # Human-readable DTC description
    is_pending = db.Column(db.Boolean, default=False)                   # Whether this is a pending (not confirmed) code
    recorded_at = db.Column(db.DateTime, nullable=False)                # When the DTC was first detected
    cleared_at = db.Column(db.DateTime)                                 # When the DTC was cleared (null = still active)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'dtc_code': self.dtc_code,
            'description': self.description,
            'is_pending': self.is_pending,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'cleared_at': self.cleared_at.isoformat() if self.cleared_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── OBD Trips ──────────────────────────────────────────────────

class OBDTrip(db.Model):
    """An aggregated trip summary with distance, speed, and snapshot statistics."""
    __tablename__ = 'obd_trips'
    __table_args__ = (
        db.Index('idx_obd_trip_vehicle_time', 'vehicle_id', db.text('start_time DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)                 # Trip start timestamp
    end_time = db.Column(db.DateTime)                                   # Trip end timestamp (null = in progress)
    duration_seconds = db.Column(db.Integer)                            # Total trip duration in seconds
    distance_km = db.Column(db.Float)                                   # Total distance traveled in km
    max_rpm = db.Column(db.Float)                                       # Peak RPM during trip
    max_speed_kph = db.Column(db.Float)                                 # Peak speed during trip in km/h
    average_speed_kph = db.Column(db.Float)                             # Average speed during trip in km/h
    snapshot_count = db.Column(db.Integer, default=0)                   # Number of OBD snapshots in this trip
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_seconds': self.duration_seconds,
            'distance_km': self.distance_km,
            'max_rpm': self.max_rpm,
            'max_speed_kph': self.max_speed_kph,
            'average_speed_kph': self.average_speed_kph,
            'snapshot_count': self.snapshot_count or 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
