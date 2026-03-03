"""
Notification Snooze tracking.

When a user snoozes a notification (via an actionable push notification button
or through the settings UI), a row is created here. The rule evaluator checks
this table before dispatching — if an active snooze exists for a rule+vehicle
combo, the notification is suppressed until the snooze expires.
"""
from datetime import datetime, timezone
from app import db


class NotificationSnooze(db.Model):
    """
    Tracks snoozed notification rules.

    A snooze suppresses a specific rule (optionally scoped to a vehicle)
    until expires_at. The rule evaluator checks for active snoozes
    before dispatching.
    """
    __tablename__ = 'notification_snoozes'

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('notification_rules.id'), nullable=False)
    vehicle_id = db.Column(db.Integer, nullable=True)  # Nullable: some rules aren't vehicle-specific
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_notification_snoozes_rule_vehicle', 'rule_id', 'vehicle_id'),
        db.Index('ix_notification_snoozes_expires', 'expires_at'),
    )

    @property
    def is_active(self):
        return self.expires_at > datetime.now(timezone.utc)

    def to_dict(self):
        return {
            'id': self.id,
            'rule_id': self.rule_id,
            'vehicle_id': self.vehicle_id,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
