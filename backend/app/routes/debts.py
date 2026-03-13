"""
Debt Payoff Tracker — API Routes

CRUD for debts, payment logging, savings balance tracking,
and snowball dashboard summary.

Endpoints:
  Debts:
    GET    /api/debts/                -> List all debts
    POST   /api/debts/                -> Create a debt
    GET    /api/debts/<id>            -> Get one debt with payments
    PUT    /api/debts/<id>            -> Update a debt
    DELETE /api/debts/<id>            -> Delete a debt (cascades payments)

  Payments:
    GET    /api/debts/<id>/payments   -> Payment history for a debt
    POST   /api/debts/<id>/payments   -> Log a payment

  Savings:
    GET    /api/debts/savings         -> Current savings + history
    POST   /api/debts/savings         -> Log new savings balance

  Dashboard:
    GET    /api/debts/snowball        -> Full snowball dashboard summary
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from app import db
from app.models.debt import Debt, DebtPayment, SnowballSavings
from app.services.event_bus import emit

debts_bp = Blueprint('debts', __name__)


# ═══════════════════════════════════════════════════════════════════
# Savings & Snowball — STATIC routes BEFORE parameterized routes
# ═══════════════════════════════════════════════════════════════════

@debts_bp.route('/savings', methods=['GET'])
def get_savings():
    """Get current savings balance and history of all updates."""
    entries = SnowballSavings.query.order_by(SnowballSavings.created_at.desc()).all()
    current = entries[0] if entries else None
    return jsonify({
        'current_balance': float(current.balance) if current else 0,
        'updated_at': current.updated_at.isoformat() if current and current.updated_at else None,
        'history': [e.to_dict() for e in entries],
    })


@debts_bp.route('/savings', methods=['POST'])
def log_savings():
    """Log a new savings balance snapshot."""
    data = request.get_json()
    if data.get('balance') is None:
        return jsonify({'error': 'balance is required'}), 400

    entry = SnowballSavings(
        balance=Decimal(str(data['balance'])),
        notes=data.get('notes'),
    )
    db.session.add(entry)
    db.session.commit()

    # Evaluate notification triggers
    _check_savings_notifications(float(entry.balance))

    return jsonify(entry.to_dict()), 201


@debts_bp.route('/snowball', methods=['GET'])
def snowball_dashboard():
    """Full snowball dashboard: freed cash flow, savings, remaining debts, next target, totals."""
    # Freed monthly cash flow (paid-off debts)
    freed_result = db.session.query(
        func.coalesce(func.sum(Debt.monthly_payment), 0)
    ).filter(Debt.status == 'paid_off').scalar()
    freed_monthly = float(freed_result)

    # Current savings
    latest_savings = SnowballSavings.query.order_by(
        SnowballSavings.created_at.desc()
    ).first()
    current_savings = float(latest_savings.balance) if latest_savings else 0

    # Total interest saved across all payments
    interest_result = db.session.query(
        func.coalesce(func.sum(DebtPayment.interest_saved), 0)
    ).scalar()
    total_interest_saved = float(interest_result)

    # Paid-off stats
    paid_off_debts = Debt.query.filter_by(status='paid_off').all()
    total_paid_off_count = len(paid_off_debts)
    total_paid_off_sum = sum(float(d.original_balance) for d in paid_off_debts)

    # Remaining debts ordered by cash-flow-liberation ratio DESC
    remaining = Debt.query.filter(
        Debt.status.in_(['active', 'targeted'])
    ).all()

    # Sort by ratio (monthly_payment / current_balance) descending
    remaining_sorted = sorted(
        remaining,
        key=lambda d: float(d.monthly_payment / d.current_balance) if d.current_balance and d.current_balance > 0 else 0,
        reverse=True,
    )

    # Projected timeline: estimate months to clear each debt in priority order
    remaining_dicts = []
    cumulative_savings = current_savings
    cumulative_freed = freed_monthly

    for debt in remaining_sorted:
        balance = float(debt.current_balance)
        shortfall = max(0, balance - cumulative_savings)

        if cumulative_freed > 0 and shortfall > 0:
            months_until_ready = shortfall / cumulative_freed
        elif shortfall <= 0:
            months_until_ready = 0
        else:
            months_until_ready = None  # Can't estimate without freed cash flow

        debt_dict = debt.to_dict()
        debt_dict['shortfall'] = round(shortfall, 2)
        debt_dict['months_until_ready'] = round(months_until_ready, 1) if months_until_ready is not None else None
        remaining_dicts.append(debt_dict)

        # After paying this debt, its monthly payment adds to freed cash flow
        cumulative_freed += float(debt.monthly_payment)
        cumulative_savings = max(0, cumulative_savings - balance)

    # Next target (first remaining by ratio)
    next_target = remaining_dicts[0] if remaining_dicts else None

    return jsonify({
        'freed_monthly': round(freed_monthly, 2),
        'current_savings': round(current_savings, 2),
        'total_interest_saved': round(total_interest_saved, 2),
        'total_paid_off': {
            'count': total_paid_off_count,
            'sum': round(total_paid_off_sum, 2),
        },
        'remaining_debts': remaining_dicts,
        'next_target': next_target,
        'total_remaining_balance': round(sum(float(d.current_balance) for d in remaining), 2),
    })


# ═══════════════════════════════════════════════════════════════════
# Debt CRUD
# ═══════════════════════════════════════════════════════════════════

@debts_bp.route('/', methods=['GET'])
def list_debts():
    """List all debts, sorted by status then payoff_order then ratio."""
    debts = Debt.query.all()

    # Sort: active/targeted first (by payoff_order, then ratio DESC), paid_off last
    def sort_key(d):
        status_order = {'targeted': 0, 'active': 1, 'paid_off': 2}
        ratio = float(d.monthly_payment / d.current_balance) if d.current_balance and d.current_balance > 0 else 0
        return (status_order.get(d.status, 3), d.payoff_order or 999, -ratio)

    debts_sorted = sorted(debts, key=sort_key)
    return jsonify([d.to_dict() for d in debts_sorted])


@debts_bp.route('/', methods=['POST'])
def create_debt():
    """Create a new debt."""
    data = request.get_json()

    required = ('label', 'original_balance', 'current_balance', 'monthly_payment')
    if not all(k in data for k in required):
        return jsonify({'error': f'{", ".join(required)} are required'}), 400

    debt = Debt(
        label=data['label'],
        original_balance=Decimal(str(data['original_balance'])),
        current_balance=Decimal(str(data['current_balance'])),
        monthly_payment=Decimal(str(data['monthly_payment'])),
        interest_rate=Decimal(str(data['interest_rate'])) if data.get('interest_rate') is not None else None,
        status=data.get('status', 'active'),
        autopay_enabled=data.get('autopay_enabled', False),
        due_day=data.get('due_day'),
        payoff_order=data.get('payoff_order'),
    )
    db.session.add(debt)
    db.session.commit()

    try:
        emit('debt.created',
             debt_id=debt.id,
             debt_label=debt.label,
             original_balance=float(debt.original_balance),
             monthly_payment=float(debt.monthly_payment))
    except Exception:
        pass

    return jsonify(debt.to_dict()), 201


@debts_bp.route('/<int:debt_id>', methods=['GET'])
def get_debt(debt_id):
    """Get a single debt with its payment history."""
    debt = Debt.query.get_or_404(debt_id)
    return jsonify(debt.to_dict())


@debts_bp.route('/<int:debt_id>', methods=['PUT'])
def update_debt(debt_id):
    """Update debt fields."""
    debt = Debt.query.get_or_404(debt_id)
    data = request.get_json()

    # Simple string/int/bool fields
    for field in ('label', 'status', 'autopay_enabled', 'due_day', 'payoff_order'):
        if field in data:
            setattr(debt, field, data[field])

    # Decimal fields
    for field in ('original_balance', 'current_balance', 'monthly_payment', 'interest_rate'):
        if field in data:
            value = Decimal(str(data[field])) if data[field] is not None else None
            setattr(debt, field, value)

    # Handle paid_off_date
    if 'paid_off_date' in data:
        debt.paid_off_date = date.fromisoformat(data['paid_off_date']) if data['paid_off_date'] else None

    db.session.commit()
    return jsonify(debt.to_dict())


@debts_bp.route('/<int:debt_id>', methods=['DELETE'])
def delete_debt(debt_id):
    """Delete a debt and all its payments (cascade)."""
    debt = Debt.query.get_or_404(debt_id)
    db.session.delete(debt)
    db.session.commit()
    return jsonify({'message': 'Debt deleted'}), 200


# ═══════════════════════════════════════════════════════════════════
# Payments
# ═══════════════════════════════════════════════════════════════════

@debts_bp.route('/<int:debt_id>/payments', methods=['GET'])
def list_payments(debt_id):
    """Payment history for a specific debt."""
    Debt.query.get_or_404(debt_id)  # Ensure debt exists
    payments = DebtPayment.query.filter_by(debt_id=debt_id).order_by(
        DebtPayment.payment_date.desc()
    ).all()
    return jsonify([p.to_dict() for p in payments])


@debts_bp.route('/<int:debt_id>/payments', methods=['POST'])
def log_payment(debt_id):
    """Log a payment against a debt.

    Auto-deducts from current_balance.
    For lump_sum: auto-calculates interest_saved = current_balance - amount_paid.
    If balance hits 0: auto-sets status='paid_off' and paid_off_date.
    """
    debt = Debt.query.get_or_404(debt_id)
    data = request.get_json()

    if data.get('amount_paid') is None:
        return jsonify({'error': 'amount_paid is required'}), 400

    amount_paid = Decimal(str(data['amount_paid']))
    payment_type = data.get('payment_type', 'manual')
    payment_date_str = data.get('payment_date')
    payment_date = date.fromisoformat(payment_date_str) if payment_date_str else date.today()

    # Auto-calculate interest_saved for lump-sum payoffs
    if payment_type == 'lump_sum':
        interest_saved = max(Decimal('0'), debt.current_balance - amount_paid)
    else:
        interest_saved = Decimal(str(data.get('interest_saved', 0)))

    payment = DebtPayment(
        debt_id=debt.id,
        amount_paid=amount_paid,
        interest_saved=interest_saved,
        payment_date=payment_date,
        payment_type=payment_type,
        notes=data.get('notes'),
    )
    db.session.add(payment)

    # Deduct from balance
    debt.current_balance = max(Decimal('0'), debt.current_balance - amount_paid)

    # Check if fully paid off
    was_active = debt.status in ('active', 'targeted')
    if debt.current_balance <= 0:
        debt.status = 'paid_off'
        debt.paid_off_date = date.today()

    db.session.commit()

    # Emit notification events
    try:
        if debt.status == 'paid_off' and was_active:
            # Calculate total freed monthly
            freed = db.session.query(
                func.coalesce(func.sum(Debt.monthly_payment), 0)
            ).filter(Debt.status == 'paid_off').scalar()

            emit('debt.paid_off',
                 debt_label=debt.label,
                 monthly_payment=float(debt.monthly_payment),
                 total_freed_monthly=float(freed))

            # Check if all debts are cleared
            remaining = Debt.query.filter(
                Debt.status.in_(['active', 'targeted'])
            ).count()
            if remaining == 0:
                total_interest = db.session.query(
                    func.coalesce(func.sum(DebtPayment.interest_saved), 0)
                ).scalar()
                total_debts = Debt.query.filter_by(status='paid_off').count()
                emit('debt.all_cleared',
                     total_interest_saved=float(total_interest),
                     total_debts_paid=total_debts)
    except Exception:
        pass

    return jsonify(payment.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def _check_savings_notifications(savings_balance):
    """Evaluate savings-based notification triggers after a balance update."""
    try:
        # Find the next target debt (highest ratio active/targeted)
        remaining = Debt.query.filter(
            Debt.status.in_(['active', 'targeted'])
        ).all()

        if not remaining:
            return

        # Sort by ratio descending
        next_target = max(
            remaining,
            key=lambda d: float(d.monthly_payment / d.current_balance) if d.current_balance and d.current_balance > 0 else 0,
        )
        target_balance = float(next_target.current_balance)

        if savings_balance >= target_balance:
            emit('debt.savings_ready',
                 savings_balance=round(savings_balance, 2),
                 debt_label=next_target.label,
                 debt_balance=round(target_balance, 2))
        elif target_balance > 0 and savings_balance >= target_balance * 0.8:
            shortfall = round(target_balance - savings_balance, 2)
            emit('debt.savings_approaching',
                 savings_balance=round(savings_balance, 2),
                 debt_label=next_target.label,
                 debt_balance=round(target_balance, 2),
                 shortfall=shortfall)
    except Exception:
        pass
