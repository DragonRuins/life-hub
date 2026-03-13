"""
Debt Payoff Tracker — Database Models

Three tables:
  - Debt: Core debt record with balance tracking and autopay settings
  - DebtPayment: Immutable payment log (manual, autopay, lump_sum)
  - SnowballSavings: Append-only savings balance snapshots
"""
from datetime import date, datetime, timezone

from app import db


class Debt(db.Model):
    """A tracked debt with balance, monthly payment, and payoff status."""
    __tablename__ = 'debts'

    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(100), nullable=False)
    original_balance = db.Column(db.Numeric(10, 2), nullable=False)
    current_balance = db.Column(db.Numeric(10, 2), nullable=False)
    monthly_payment = db.Column(db.Numeric(10, 2), nullable=False)
    interest_rate = db.Column(db.Numeric(5, 2), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')
    autopay_enabled = db.Column(db.Boolean, default=False)
    due_day = db.Column(db.Integer, nullable=True)
    payoff_order = db.Column(db.Integer, nullable=True)
    paid_off_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    payments = db.relationship(
        'DebtPayment', backref='debt', cascade='all, delete-orphan',
        order_by='DebtPayment.payment_date.desc()',
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'label': self.label,
            'original_balance': float(self.original_balance) if self.original_balance is not None else None,
            'current_balance': float(self.current_balance) if self.current_balance is not None else None,
            'monthly_payment': float(self.monthly_payment) if self.monthly_payment is not None else None,
            'interest_rate': float(self.interest_rate) if self.interest_rate is not None else None,
            'status': self.status,
            'autopay_enabled': self.autopay_enabled or False,
            'due_day': self.due_day,
            'payoff_order': self.payoff_order,
            'paid_off_date': self.paid_off_date.isoformat() if self.paid_off_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'payments': [p.to_dict() for p in self.payments] if self.payments else [],
            'payment_count': len(self.payments) if self.payments else 0,
            'ratio': float(self.monthly_payment / self.current_balance) if self.current_balance and self.current_balance > 0 else 0,
        }


class DebtPayment(db.Model):
    """An immutable payment record against a debt."""
    __tablename__ = 'debt_payments'

    id = db.Column(db.Integer, primary_key=True)
    debt_id = db.Column(db.Integer, db.ForeignKey('debts.id'), nullable=False)
    amount_paid = db.Column(db.Numeric(10, 2), nullable=False)
    interest_saved = db.Column(db.Numeric(10, 2), default=0)
    payment_date = db.Column(db.Date, nullable=False)
    payment_type = db.Column(db.String(20), nullable=False, default='manual')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'debt_id': self.debt_id,
            'amount_paid': float(self.amount_paid) if self.amount_paid is not None else None,
            'interest_saved': float(self.interest_saved) if self.interest_saved is not None else 0,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'payment_type': self.payment_type,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class SnowballSavings(db.Model):
    """Append-only log of dedicated debt-payoff savings balance snapshots."""
    __tablename__ = 'snowball_savings'

    id = db.Column(db.Integer, primary_key=True)
    balance = db.Column(db.Numeric(10, 2), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'balance': float(self.balance) if self.balance is not None else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
