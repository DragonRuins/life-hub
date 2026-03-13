"""
Timecard Module - Database Model

Tracks individual clock-in/clock-out time entries.
A running timer is a row with end_time=NULL.
Only one timer can be active at a time (enforced by partial unique index).
"""
from datetime import datetime, timezone

from app import db


class TimeEntry(db.Model):
    """A single clock-in/clock-out time entry."""
    __tablename__ = 'time_entries'

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=True)
    work_type = db.Column(db.String(20), nullable=False)
    duration_seconds = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    forgotten_alert_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Valid work types
    TIMER_TYPES = ('in_office', 'wfh', 'support_call', 'business_travel')
    QUICK_DAY_TYPES = ('holiday', 'vacation')
    ALL_TYPES = TIMER_TYPES + QUICK_DAY_TYPES

    # Human-readable labels
    TYPE_LABELS = {
        'in_office': 'In Office',
        'wfh': 'WFH',
        'support_call': 'Support Call',
        'business_travel': 'Business Travel',
        'holiday': 'Holiday',
        'vacation': 'Vacation',
    }

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'work_type': self.work_type,
            'work_type_label': self.TYPE_LABELS.get(self.work_type, self.work_type),
            'duration_seconds': self.duration_seconds,
            'duration_display': self._format_duration(self.duration_seconds),
            'notes': self.notes,
            'forgotten_alert_sent': self.forgotten_alert_sent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def _format_duration(seconds):
        """Format seconds into human-readable string like '4h 12m'."""
        if seconds is None:
            return None
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"
