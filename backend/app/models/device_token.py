"""
Device Token storage for Apple Push Notification service (APNs).

Each row represents one registered device that can receive push notifications.
A user may have multiple devices (iPhone, iPad, Mac, Watch).
Tokens are refreshed by the device on each app launch and upserted here.
"""
from datetime import datetime, timezone
from app import db


class DeviceToken(db.Model):
    """
    An APNs device token for push notification delivery.

    Attributes:
        device_id: Unique device identifier (UIDevice.identifierForVendor or similar).
        token: The hex-encoded APNs device token string.
        platform: 'ios', 'macos', or 'watchos'.
        app_version: App marketing version at time of registration.
        created_at: When the token was first registered.
        updated_at: When the token was last refreshed.
    """
    __tablename__ = 'device_tokens'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(255), nullable=False, unique=True)
    token = db.Column(db.String(255), nullable=False)
    platform = db.Column(db.String(20), nullable=False)  # 'ios', 'macos', 'watchos'
    app_version = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.Index('ix_device_tokens_platform', 'platform'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'token': self.token[:8] + '...',  # Truncate token for security
            'platform': self.platform,
            'app_version': self.app_version,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
