"""
Notification Module - Database Models

A complete notification system with five tables:
  - notification_channels: WHERE notifications get sent (Pushover, Discord, in-app, etc.)
  - notification_rules: WHEN and WHY a notification fires (schedule, event, condition)
  - notification_rule_channels: Links rules to channels (many-to-many with extra settings)
  - notification_log: History of every notification sent (for debugging and display)
  - notification_settings: Global settings like quiet hours and kill switch (singleton row)

How it all connects:
  1. You create Channels (e.g., "My Phone via Pushover", "Discord Server")
  2. You create Rules that define triggers (e.g., "When oil change is due")
  3. You link Rules to Channels so the rule knows WHERE to send
  4. When a Rule fires, a Log entry is created for each channel it was sent to
  5. Settings control global behavior like quiet hours and the master on/off switch

SQLAlchemy models map Python classes to database tables.
Each attribute becomes a column. You interact with the database
using Python objects instead of writing raw SQL.
"""
from datetime import datetime, timezone
from app import db


class NotificationChannel(db.Model):
    """
    A delivery channel for notifications.

    Each channel represents one destination where notifications can be sent.
    The 'config' column stores channel-specific secrets and settings as JSON.

    Examples:
      - Pushover: config = {"user_key": "abc123", "api_token": "xyz789"}
      - Discord:  config = {"webhook_url": "https://discord.com/api/webhooks/..."}
      - Email:    config = {"smtp_host": "...", "to_address": "you@example.com"}
      - In-App:   config = {} (no external config needed)
    """
    __tablename__ = 'notification_channels'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)           # User-friendly name, e.g., "My Phone"
    channel_type = db.Column(db.String(50), nullable=False)    # 'in_app', 'pushover', 'discord', 'email', 'sms'
    config = db.Column(db.JSON, nullable=False, default=dict)  # Channel-specific secrets/settings (JSONB in PostgreSQL)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Index on channel_type for filtering queries like "show me all Discord channels"
    __table_args__ = (
        db.Index('ix_notification_channels_channel_type', 'channel_type'),
    )

    # Relationship: one channel appears in many rule-channel links
    # This lets you do channel.rule_links to see which rules use this channel
    rule_links = db.relationship(
        'NotificationRuleChannel', backref='channel', cascade='all, delete-orphan'
    )

    # Relationship: one channel has many log entries
    # SET NULL on delete is handled by the foreign key, not the relationship
    logs = db.relationship('NotificationLog', backref='channel')

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'channel_type': self.channel_type,
            'config': self.config,
            'is_enabled': self.is_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class NotificationRule(db.Model):
    """
    Defines WHEN and WHY a notification should fire.

    There are three types of rules (rule_type):
      - 'scheduled': Fires on a cron schedule, interval, or one-time date
      - 'event': Fires when a specific event happens (e.g., 'vehicle.mileage_updated')
      - 'condition': Fires when data meets certain conditions (e.g., mileage > threshold)

    Templates support {{variable}} placeholders that get filled in when the rule fires.
    For example: "Oil change due for {{vehicle_name}} at {{mileage}} miles"

    Priority levels: 'low', 'normal', 'high', 'critical'
    Cooldown prevents the same rule from firing too frequently.
    """
    __tablename__ = 'notification_rules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)           # Human-readable rule name
    description = db.Column(db.Text)                            # Optional longer explanation
    module = db.Column(db.String(50))                           # Which module ('vehicles', 'notes', etc.) or null for global
    rule_type = db.Column(db.String(50), nullable=False)       # 'scheduled', 'event', 'condition'

    # Schedule config (only used when rule_type is 'scheduled')
    # Example: {"type": "cron", "cron": "0 9 * * *"} or {"type": "interval", "minutes": 60}
    schedule_config = db.Column(db.JSON)

    # Event trigger (only used when rule_type is 'event')
    # e.g., 'vehicle.mileage_updated', 'note.created'
    event_name = db.Column(db.String(100))

    # Conditions that must be true for the rule to fire
    # Array of objects: [{"field": "current_mileage", "operator": ">=", "value": 5000, "relative_to": "last_oil_change"}]
    conditions = db.Column(db.JSON, nullable=False, default=list)

    # Message templates with {{variable}} placeholders
    title_template = db.Column(db.String(500))                 # Optional title (some channels use it)
    body_template = db.Column(db.Text, nullable=False)         # The main notification message

    # Delivery settings
    priority = db.Column(db.String(20), nullable=False, default='normal')  # 'low', 'normal', 'high', 'critical'
    cooldown_minutes = db.Column(db.Integer, default=0)        # Minimum minutes between firings (0 = no cooldown)
    last_fired_at = db.Column(db.DateTime)                     # When this rule last sent a notification
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Indexes for common query patterns
    __table_args__ = (
        db.Index('ix_notification_rules_rule_type', 'rule_type'),
        db.Index('ix_notification_rules_event_name', 'event_name'),
        db.Index('ix_notification_rules_module', 'module'),
    )

    # Relationship: one rule has many rule-channel links
    # "cascade='all, delete-orphan'" means deleting a rule removes its channel links too
    channel_links = db.relationship(
        'NotificationRuleChannel', backref='rule', cascade='all, delete-orphan'
    )

    # Relationship: one rule has many log entries
    # SET NULL on delete is handled by the foreign key, not the relationship
    logs = db.relationship('NotificationLog', backref='rule')

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'module': self.module,
            'rule_type': self.rule_type,
            'schedule_config': self.schedule_config,
            'event_name': self.event_name,
            'conditions': self.conditions,
            'title_template': self.title_template,
            'body_template': self.body_template,
            'priority': self.priority,
            'cooldown_minutes': self.cooldown_minutes,
            'last_fired_at': self.last_fired_at.isoformat() if self.last_fired_at else None,
            'is_enabled': self.is_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # Include the linked channel IDs for convenience
            'channel_ids': [link.channel_id for link in self.channel_links],
        }


class NotificationRuleChannel(db.Model):
    """
    Links a rule to a channel (many-to-many join table with extra data).

    This is a "join table" that connects NotificationRule and NotificationChannel.
    It's a proper Model class (not just a db.Table) because it has an extra column:
    'channel_overrides' lets you customize how a notification looks per channel.

    For example, a rule might send a normal message to Pushover but use a special
    embed color when sending to Discord.

    The composite primary key (rule_id + channel_id) means each rule-channel
    pair can only exist once.
    """
    __tablename__ = 'notification_rule_channels'

    # Composite primary key: the combination of rule_id + channel_id is unique
    rule_id = db.Column(
        db.Integer,
        db.ForeignKey('notification_rules.id', ondelete='CASCADE'),
        primary_key=True
    )
    channel_id = db.Column(
        db.Integer,
        db.ForeignKey('notification_channels.id', ondelete='CASCADE'),
        primary_key=True
    )

    # Per-rule overrides for this channel (e.g., {"sound": "alarm", "embed_color": "#ff0000"})
    channel_overrides = db.Column(db.JSON, default=dict)

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'rule_id': self.rule_id,
            'channel_id': self.channel_id,
            'channel_overrides': self.channel_overrides,
        }


class NotificationLog(db.Model):
    """
    A record of every notification that was sent (or attempted).

    Every time a rule fires, one log entry is created per channel.
    This provides a full history for debugging, display in the UI,
    and tracking read/unread state for in-app notifications.

    The channel_type is stored directly on the log (denormalized) so you can
    still filter by channel type even if the original channel is deleted.

    Status flow: pending -> sent (or failed)
    For in-app notifications: sent -> read (when user views it)
    """
    __tablename__ = 'notification_log'

    id = db.Column(db.Integer, primary_key=True)

    # Foreign keys with SET NULL: if the rule or channel is deleted, the log
    # entry stays but the reference becomes null (preserving history)
    rule_id = db.Column(
        db.Integer,
        db.ForeignKey('notification_rules.id', ondelete='SET NULL')
    )
    channel_id = db.Column(
        db.Integer,
        db.ForeignKey('notification_channels.id', ondelete='SET NULL')
    )

    # Denormalized channel type so we can query logs even after channel deletion
    channel_type = db.Column(db.String(50), nullable=False)

    # The actual notification content (rendered from templates)
    title = db.Column(db.String(500))
    body = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default='normal')

    # Delivery tracking
    status = db.Column(db.String(20), nullable=False, default='pending')  # 'pending', 'sent', 'failed', 'read'
    error_message = db.Column(db.Text)                # Error details if delivery failed
    delivery_duration_ms = db.Column(db.Integer)      # How long the delivery took in milliseconds

    # Snapshot of the event payload that triggered this notification
    # Useful for debugging: "what data did the rule see when it fired?"
    # Named 'event_data' because 'metadata' is reserved by SQLAlchemy's Declarative API
    event_data = db.Column(db.JSON)

    # Read tracking (primarily for in-app notifications)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    sent_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    read_at = db.Column(db.DateTime)

    # Indexes for common query patterns
    __table_args__ = (
        db.Index('ix_notification_log_sent_at', sent_at.desc()),
        db.Index('ix_notification_log_status', 'status'),
        db.Index('ix_notification_log_rule_id', 'rule_id'),
        db.Index('ix_notification_log_is_read_channel_type', 'is_read', 'channel_type'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'channel_id': self.channel_id,
            'channel_type': self.channel_type,
            'title': self.title,
            'body': self.body,
            'priority': self.priority,
            'status': self.status,
            'error_message': self.error_message,
            'delivery_duration_ms': self.delivery_duration_ms,
            'event_data': self.event_data,
            'is_read': self.is_read,
            'sent_at': (self.sent_at.isoformat() + 'Z') if self.sent_at else None,
            'read_at': (self.read_at.isoformat() + 'Z') if self.read_at else None,
        }


class NotificationSettings(db.Model):
    """
    Global notification settings (singleton - always one row with id=1).

    This table always has exactly one row. Instead of creating/deleting rows,
    you just update the single row. The get_settings() class method handles
    creating the row with defaults if it doesn't exist yet.

    Key features:
      - Global kill switch (enabled): turn ALL notifications on/off
      - Quiet hours: suppress notifications during sleep time
      - Default channels: which channels to use if a rule doesn't specify any
      - Retention: how many days to keep old log entries before cleanup
    """
    __tablename__ = 'notification_settings'

    # Always row 1 - this is a singleton table
    id = db.Column(db.Integer, primary_key=True, default=1)

    # Master on/off switch for the entire notification system
    enabled = db.Column(db.Boolean, nullable=False, default=True)

    # Default priority for rules that don't specify one
    default_priority = db.Column(db.String(20), default='normal')

    # Array of channel IDs to use when a rule doesn't specify channels
    # Example: [1, 3] means "send to channels 1 and 3 by default"
    default_channel_ids = db.Column(db.JSON, default=list)

    # Quiet hours: don't send notifications between these times
    # Stored as "HH:MM" strings, e.g., "22:00" and "07:00"
    quiet_hours_start = db.Column(db.String(5))     # e.g., "22:00"
    quiet_hours_end = db.Column(db.String(5))       # e.g., "07:00"
    quiet_hours_timezone = db.Column(db.String(50), default='America/Chicago')

    # How many days to keep notification log entries before auto-deleting
    retention_days = db.Column(db.Integer, default=90)

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    @classmethod
    def get_settings(cls):
        """
        Get the singleton settings row, creating it with defaults if it doesn't exist.

        This is the ONLY way you should access notification settings.
        It guarantees the row exists and returns it.

        Usage:
            settings = NotificationSettings.get_settings()
            if settings.enabled:
                # send notifications...
        """
        # Try to find the existing settings row
        settings = cls.query.get(1)

        # If it doesn't exist yet, create it with all defaults
        if settings is None:
            settings = cls(id=1)
            db.session.add(settings)
            db.session.commit()

        return settings

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'enabled': self.enabled,
            'default_priority': self.default_priority,
            'default_channel_ids': self.default_channel_ids,
            'quiet_hours_start': self.quiet_hours_start,
            'quiet_hours_end': self.quiet_hours_end,
            'quiet_hours_timezone': self.quiet_hours_timezone,
            'retention_days': self.retention_days,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
