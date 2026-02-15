"""
Maintenance Interval Module - Database Models

Defines three tables for tracking maintenance schedules:
  - maintenance_items: Global catalog of service types (Engine Oil, Tire Rotation, etc.)
  - vehicle_maintenance_intervals: Per-vehicle interval configuration
  - maintenance_log_items: Join table linking maintenance logs to catalog items

These work alongside the existing MaintenanceLog model in vehicle.py.
When a maintenance log is created with item_ids, the corresponding intervals
get their last_service_date/mileage updated (resetting the tracking cycle).
"""
from datetime import datetime, timezone
from app import db


class MaintenanceItem(db.Model):
    """
    A type of maintenance that can be performed.

    Some items are preset (shipped with the app, like "Engine Oil" or "Tire Rotation").
    Users can also create custom items. Preset items cannot be deleted from the UI.

    The default_miles_interval and default_months_interval are suggestions —
    the user overrides them per-vehicle in VehicleMaintenanceInterval.
    """
    __tablename__ = 'maintenance_items'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    category = db.Column(db.String(50), nullable=False)          # "Fluids", "Filters", etc.
    default_miles_interval = db.Column(db.Integer)                # e.g., 5000
    default_months_interval = db.Column(db.Integer)               # e.g., 6
    is_preset = db.Column(db.Boolean, nullable=False, default=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one item can have many intervals (one per vehicle)
    intervals = db.relationship(
        'VehicleMaintenanceInterval', backref='item', cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'default_miles_interval': self.default_miles_interval,
            'default_months_interval': self.default_months_interval,
            'is_preset': self.is_preset,
            'sort_order': self.sort_order,
        }


class VehicleMaintenanceInterval(db.Model):
    """
    Per-vehicle interval configuration for a maintenance item.

    One row per vehicle-item pair. Tracks:
      - How often the item should be serviced (miles and/or months)
      - Whether thresholds use OR or AND logic
      - When the item was last serviced (anchor for due calculations)
      - Notification milestones (which overdue thresholds trigger alerts)

    Notification thresholds work like this:
      notify_miles_thresholds: [0, 500, 1000]
      → Notify when due (0 miles overdue), again at 500 miles overdue,
        again at 1000 miles overdue. Each fires exactly once.

      notified_milestones: {"miles": [0], "months": []}
      → Tracks which thresholds have already fired.
        Cleared when the item is serviced (interval resets).
    """
    __tablename__ = 'vehicle_maintenance_intervals'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(
        db.Integer,
        db.ForeignKey('vehicles.id', ondelete='CASCADE'),
        nullable=False
    )
    item_id = db.Column(
        db.Integer,
        db.ForeignKey('maintenance_items.id', ondelete='CASCADE'),
        nullable=False
    )

    # Interval thresholds (user-configurable, defaults come from maintenance_items)
    miles_interval = db.Column(db.Integer)           # e.g., 5000 = "every 5,000 miles"
    months_interval = db.Column(db.Integer)          # e.g., 6 = "every 6 months"

    # How to evaluate the two thresholds:
    # 'or' (default): due when EITHER threshold is reached (most common, most conservative)
    # 'and': due when BOTH thresholds are exceeded
    condition_type = db.Column(db.String(3), nullable=False, default='or')

    # Snapshot of when this item was last serviced
    # Updated when a maintenance log references this item
    last_service_date = db.Column(db.Date)
    last_service_mileage = db.Column(db.Integer)

    # Notification milestone thresholds (JSON arrays)
    # Values are how many miles/months PAST DUE to notify at
    notify_miles_thresholds = db.Column(db.JSON, nullable=False, default=lambda: [0])
    notify_months_thresholds = db.Column(db.JSON, nullable=False, default=lambda: [0])

    # Tracks which milestone thresholds have already fired
    # Cleared when the item is serviced (interval resets)
    notified_milestones = db.Column(
        db.JSON, nullable=False,
        default=lambda: {"miles": [], "months": []}
    )

    is_enabled = db.Column(db.Boolean, nullable=False, default=True)

    # ── Notification delivery config (set from Notifications > Intervals tab) ──
    # When set, the interval checker dispatches directly to these channels
    # instead of emitting events for generic rules to catch.
    # None = "not configured, use generic event system"
    # []   = "configured with no channels" (silences this interval)
    notification_channel_ids = db.Column(db.JSON, nullable=True, default=None)
    notification_priority = db.Column(db.String(20), nullable=True, default=None)
    notification_title_template = db.Column(db.String(500), nullable=True, default=None)
    notification_body_template = db.Column(db.Text, nullable=True, default=None)

    # When to dispatch notifications:
    # 'immediate' (default): as soon as a threshold is detected (fuel-up, maintenance log, or daily check)
    # 'scheduled': only during the daily 9 AM scheduler check
    notification_timing = db.Column(db.String(20), nullable=False, default='immediate')

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Unique constraint: one interval per item per vehicle
    __table_args__ = (
        db.UniqueConstraint('vehicle_id', 'item_id', name='uq_vehicle_item'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'item_id': self.item_id,
            'item_name': self.item.name if self.item else None,
            'item_category': self.item.category if self.item else None,
            'sort_order': self.item.sort_order if self.item else 999,
            'miles_interval': self.miles_interval,
            'months_interval': self.months_interval,
            'condition_type': self.condition_type,
            'last_service_date': self.last_service_date.isoformat() if self.last_service_date else None,
            'last_service_mileage': self.last_service_mileage,
            'notify_miles_thresholds': self.notify_miles_thresholds,
            'notify_months_thresholds': self.notify_months_thresholds,
            'notified_milestones': self.notified_milestones,
            'is_enabled': self.is_enabled,
            'notification_channel_ids': self.notification_channel_ids,
            'notification_priority': self.notification_priority,
            'notification_title_template': self.notification_title_template,
            'notification_body_template': self.notification_body_template,
            'notification_timing': self.notification_timing,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class MaintenanceLogItem(db.Model):
    """
    Join table: which maintenance items were serviced in a log entry.

    A single maintenance log (e.g., "Full Service at Valvoline") might cover
    Engine Oil, Oil Filter, and Air Filter simultaneously. This table tracks
    which items were included.

    Logs with no items in this table represent freeform/"Other" maintenance
    (backward compatible with existing logs that only have service_type text).
    """
    __tablename__ = 'maintenance_log_items'

    log_id = db.Column(
        db.Integer,
        db.ForeignKey('maintenance_logs.id', ondelete='CASCADE'),
        primary_key=True
    )
    item_id = db.Column(
        db.Integer,
        db.ForeignKey('maintenance_items.id', ondelete='CASCADE'),
        primary_key=True
    )
