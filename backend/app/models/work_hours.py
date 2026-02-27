"""
Work Hours Module - Database Model

Tracks monthly hours worked against a standard 40-hour work week.
One row per month, with computed business days and overtime via
Python's calendar module.

The table is lazily populated: when a year is first accessed,
all 12 months are created with hours_worked=None. Users then
fill in hours as they go.
"""
import calendar
from datetime import datetime, timezone

from app import db


class WorkHoursLog(db.Model):
    """A single month's work hours record."""
    __tablename__ = 'work_hours_log'

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12

    # Nullable: None means "not yet entered"
    hours_worked = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint('year', 'month', name='uq_work_hours_year_month'),
        db.Index('ix_work_hours_year', 'year'),
    )

    def _count_business_days(self):
        """Count weekdays (Mon-Fri) in this month using calendar module."""
        cal = calendar.monthcalendar(self.year, self.month)
        count = 0
        for week in cal:
            # week is [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
            # Non-zero values are valid days of the month
            for day_index in range(5):  # Mon(0) through Fri(4)
                if week[day_index] != 0:
                    count += 1
        return count

    def to_dict(self):
        """Serialize to JSON with computed fields."""
        business_days = self._count_business_days()
        required_hours = business_days * 8

        # Overtime can be negative (deficit) — intentionally not clamped
        overtime_hours = None
        if self.hours_worked is not None:
            overtime_hours = round(self.hours_worked - required_hours, 2)

        return {
            'id': self.id,
            'year': self.year,
            'month': self.month,
            'month_name': calendar.month_name[self.month],
            'hours_worked': self.hours_worked,
            'business_days': business_days,
            'required_hours': required_hours,
            'overtime_hours': overtime_hours,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
