"""
Timecard Module - Monthly Total Manual Entries

Stores manually entered monthly hour totals for historical months
where individual time entries don't exist. Used as a fallback when
no real TimeEntry records exist for a given month.
"""
from datetime import datetime, timezone

from app import db


class MonthlyTotal(db.Model):
    """Manual monthly hour total for historical data entry."""
    __tablename__ = 'monthly_totals'

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    hours = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # One manual entry per month
    __table_args__ = (
        db.UniqueConstraint('year', 'month', name='uq_monthly_total_year_month'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'year': self.year,
            'month': self.month,
            'hours': self.hours,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
