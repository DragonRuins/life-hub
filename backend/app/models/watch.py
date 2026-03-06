"""
Watch Pipeline Module - Database Models

Defines seven tables for Apple Watch data ingestion:
  - watch_health_samples: HealthKit samples (heart rate, HRV, steps, etc.)
  - watch_barometer_readings: Barometric pressure and relative altitude
  - watch_nfc_events: NFC tag scan events with action execution results
  - watch_nfc_action_definitions: Configurable actions triggered by NFC tags
  - watch_nfc_timers: Start/stop timers tied to NFC toggle actions
  - watch_spatial_readings: UWB spatial/proximity readings between devices
  - watch_sync_status: Per-pipeline sync state tracking

Data flows from Apple Watch → iPhone → Flask API.
All tables are append-only except action definitions and sync status.
"""
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import JSONB
from app import db


# ── Health Samples ───────────────────────────────────────────────

class WatchHealthSample(db.Model):
    """A single HealthKit sample relayed from Apple Watch."""
    __tablename__ = 'watch_health_samples'
    __table_args__ = (
        db.Index('idx_watch_health_type_date', 'sample_type', db.text('start_date DESC')),
        db.Index('idx_watch_health_date', db.text('start_date DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)     # HealthKit sample UUID
    sample_type = db.Column(db.String(100), nullable=False)          # e.g., "heart_rate", "hrv", "steps"
    value = db.Column(db.Float, nullable=False)                      # Numeric sample value
    unit = db.Column(db.String(50), nullable=False)                  # e.g., "count/min", "ms", "count"
    start_date = db.Column(db.DateTime, nullable=False)              # Sample start timestamp
    end_date = db.Column(db.DateTime)                                # Sample end timestamp (same as start for instantaneous)
    source_device = db.Column(db.String(200))                        # e.g., "Apple Watch Series 10"
    source_app = db.Column(db.String(200))                           # e.g., "com.apple.health"
    sample_metadata = db.Column('metadata', JSONB, default=dict)      # Extra HealthKit metadata
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'uuid': self.uuid,
            'sample_type': self.sample_type,
            'value': self.value,
            'unit': self.unit,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'source_device': self.source_device,
            'source_app': self.source_app,
            'metadata': self.sample_metadata or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── Barometer Readings ──────────────────────────────────────────

class WatchBarometerReading(db.Model):
    """A barometric pressure reading from the Watch altimeter."""
    __tablename__ = 'watch_barometer_readings'
    __table_args__ = (
        db.Index('idx_watch_barometer_time', db.text('timestamp DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)     # Client-generated UUID for dedup
    timestamp = db.Column(db.DateTime, nullable=False)               # When reading was taken
    pressure_kpa = db.Column(db.Float, nullable=False)               # Absolute pressure in kilopascals
    relative_altitude_m = db.Column(db.Float)                        # Relative altitude change in meters
    lat = db.Column(db.Float)                                        # Latitude (if location available)
    lng = db.Column(db.Float)                                        # Longitude
    context = db.Column(db.String(50))                               # e.g., "outdoor", "indoor", "transit"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'uuid': self.uuid,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'pressure_kpa': self.pressure_kpa,
            'relative_altitude_m': self.relative_altitude_m,
            'lat': self.lat,
            'lng': self.lng,
            'context': self.context,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── NFC Events ──────────────────────────────────────────────────

class WatchNFCEvent(db.Model):
    """A single NFC tag scan event with action execution result."""
    __tablename__ = 'watch_nfc_events'
    __table_args__ = (
        db.Index('idx_watch_nfc_action_time', 'action_id', db.text('timestamp DESC')),
        db.Index('idx_watch_nfc_time', db.text('timestamp DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)     # Client-generated UUID for dedup
    timestamp = db.Column(db.DateTime, nullable=False)               # When the tag was scanned
    action_id = db.Column(db.String(100), nullable=False)            # Loose reference to action definition
    label = db.Column(db.String(200))                                # Human-readable label from tag
    tag_id = db.Column(db.String(200))                               # Raw NFC tag identifier
    lat = db.Column(db.Float)                                        # Latitude (if location available)
    lng = db.Column(db.Float)                                        # Longitude
    result = db.Column(JSONB, default=dict)                          # Action execution result
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'uuid': self.uuid,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'action_id': self.action_id,
            'label': self.label,
            'tag_id': self.tag_id,
            'lat': self.lat,
            'lng': self.lng,
            'result': self.result or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── NFC Action Definitions ─────────────────────────────────────

class WatchNFCActionDefinition(db.Model):
    """A configurable action that executes when a specific NFC tag is scanned."""
    __tablename__ = 'watch_nfc_action_definitions'

    id = db.Column(db.Integer, primary_key=True)
    action_id = db.Column(db.String(100), unique=True, nullable=False)  # e.g., "garage_door", "3d_printer"
    description = db.Column(db.String(500))                              # Human-readable description
    action_type = db.Column(db.String(50), nullable=False)               # toggle_timer, one_shot, context_switch
    category = db.Column(db.String(50))                                  # e.g., "homelab", "maker", "vehicle"
    config = db.Column(JSONB, default=dict)                              # Action-specific configuration
    integrations = db.Column(JSONB, default=dict)                        # External service hooks (HA, etc.)
    responses = db.Column(JSONB, default=dict)                           # Haptic/sound/message responses
    enabled = db.Column(db.Boolean, default=True)                        # Whether this action is active
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'action_id': self.action_id,
            'description': self.description,
            'action_type': self.action_type,
            'category': self.category,
            'config': self.config or {},
            'integrations': self.integrations or {},
            'responses': self.responses or {},
            'enabled': self.enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ── NFC Timers ──────────────────────────────────────────────────

class WatchNFCTimer(db.Model):
    """A start/stop timer session triggered by an NFC toggle action."""
    __tablename__ = 'watch_nfc_timers'
    __table_args__ = (
        db.Index('idx_watch_nfc_timer_action_time', 'action_id', db.text('started_at DESC')),
        db.Index('idx_watch_nfc_timer_active', 'action_id',
                 postgresql_where=db.text('ended_at IS NULL')),
    )

    id = db.Column(db.Integer, primary_key=True)
    action_id = db.Column(db.String(100), nullable=False)            # Loose reference to action definition
    started_at = db.Column(db.DateTime, nullable=False)              # Timer start timestamp
    ended_at = db.Column(db.DateTime)                                # Timer end timestamp (null = active)
    duration_seconds = db.Column(db.Integer)                         # Computed on stop, null while active
    timer_metadata = db.Column('metadata', JSONB, default=dict)       # Extra context (location, notes, etc.)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'action_id': self.action_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_seconds': self.duration_seconds,
            'is_active': self.ended_at is None,
            'metadata': self.timer_metadata or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── Spatial Readings ────────────────────────────────────────────

class WatchSpatialReading(db.Model):
    """A UWB spatial/proximity reading between devices."""
    __tablename__ = 'watch_spatial_readings'
    __table_args__ = (
        db.Index('idx_watch_spatial_time', db.text('timestamp DESC')),
        db.Index('idx_watch_spatial_peer_time', 'peer_device', db.text('timestamp DESC')),
    )

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)     # Client-generated UUID for dedup
    timestamp = db.Column(db.DateTime, nullable=False)               # When reading was taken
    peer_device = db.Column(db.String(200), nullable=False)          # Name/ID of the detected peer
    distance_m = db.Column(db.Float)                                 # Distance in meters
    direction_x = db.Column(db.Float)                                # Direction vector X component
    direction_y = db.Column(db.Float)                                # Direction vector Y component
    direction_z = db.Column(db.Float)                                # Direction vector Z component
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'uuid': self.uuid,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'peer_device': self.peer_device,
            'distance_m': self.distance_m,
            'direction_x': self.direction_x,
            'direction_y': self.direction_y,
            'direction_z': self.direction_z,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── Sync Status ─────────────────────────────────────────────────

class WatchSyncStatus(db.Model):
    """Per-pipeline sync state for tracking Watch data ingestion progress."""
    __tablename__ = 'watch_sync_status'

    id = db.Column(db.Integer, primary_key=True)
    pipeline = db.Column(db.String(50), unique=True, nullable=False)  # health, barometer, nfc, spatial
    last_sync_at = db.Column(db.DateTime)                             # Last successful sync timestamp
    samples_synced = db.Column(db.Integer, default=0)                 # Cumulative count of synced samples
    last_error = db.Column(db.Text)                                   # Last error message (null = healthy)
    sync_metadata = db.Column('metadata', JSONB, default=dict)        # Extra sync context
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'pipeline': self.pipeline,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'samples_synced': self.samples_synced or 0,
            'last_error': self.last_error,
            'metadata': self.sync_metadata or {},
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
