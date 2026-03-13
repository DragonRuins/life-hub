# Debt Payoff Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a debt snowball payoff tracker with Flask API backend and native iOS/macOS SwiftUI frontend.

**Architecture:** Flask/PostgreSQL backend with 3 tables (debts, debt_payments, snowball_savings), REST API, APScheduler autopay cron, event bus notifications. Native SwiftUI frontend with @Observable ViewModel, offline cache, and quad-platform views (iPhone/iPad/Mac).

**Tech Stack:** Python 3.12 / Flask / SQLAlchemy / APScheduler (backend), Swift 6 / SwiftUI / iOS 26+ (frontend)

---

## Task 1: Backend — Database Models

**Files:**
- Create: `backend/app/models/debt.py`

**Step 1: Create the model file with all three tables**

```python
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
```

**Step 2: Register models in `backend/app/models/__init__.py`**

Add this line at the end of the existing imports:

```python
from .debt import Debt, DebtPayment, SnowballSavings
```

**Step 3: Commit**

```bash
git add backend/app/models/debt.py backend/app/models/__init__.py
git commit -m "feat(debt): add Debt, DebtPayment, SnowballSavings models"
```

---

## Task 2: Backend — API Routes

**Files:**
- Create: `backend/app/routes/debts.py`

**Step 1: Create the routes file with all endpoints**

```python
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
```

**Step 2: Commit**

```bash
git add backend/app/routes/debts.py
git commit -m "feat(debt): add API routes for debts, payments, savings, snowball"
```

---

## Task 3: Backend — Registration & Notification Events

**Files:**
- Modify: `backend/app/__init__.py` (3 locations)
- Modify: `backend/app/routes/notifications.py` (AVAILABLE_EVENTS)

**Step 1: Register blueprint in `backend/app/__init__.py`**

After line 87 (`from app.routes.obd import obd_bp` / `app.register_blueprint(obd_bp, ...)`), add:

```python
    from app.routes.debts import debts_bp
    app.register_blueprint(debts_bp, url_prefix='/api/debts')
```

**Step 2: Add to model imports in `backend/app/__init__.py`**

On line 97 (the `from app.models import ...` line), add `, debt` to the end of the import list:

```python
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, work_hours, obd, debt  # noqa: F401
```

**Step 3: Seed default notification rules in `backend/app/__init__.py`**

After the `_seed_smarthome_notification_rules` call (around line 138), add:

```python
        # Auto-seed debt payoff notification rules (all disabled by default).
        try:
            _seed_debt_notification_rules(db)
        except Exception:
            pass  # Don't break startup if seeding fails
```

Then add the seed function before `_run_safe_migrations` (around line 382):

```python
def _seed_debt_notification_rules(db):
    """Seed default debt payoff notification rules on first startup."""
    from app.models.notification import NotificationRule

    debt_rules = [
        {
            'name': 'Debt Paid Off',
            'event_name': 'debt.paid_off',
            'module': 'debts',
            'description': 'When a debt is fully paid off',
            'title_template': 'Debt Paid Off: {{debt_label}}',
            'body_template': '{{debt_label}} is paid off! You\'ve freed up ${{monthly_payment}}/mo. Total freed: ${{total_freed_monthly}}/mo.',
        },
        {
            'name': 'Autopay Logged',
            'event_name': 'debt.autopay_logged',
            'module': 'debts',
            'description': 'When an autopay deduction is recorded',
            'title_template': 'Autopay: {{debt_label}}',
            'body_template': 'Autopay: ${{amount_paid}} applied to {{debt_label}}. Remaining balance: ${{remaining_balance}}.',
        },
        {
            'name': 'Savings Ready to Pay Off',
            'event_name': 'debt.savings_ready',
            'module': 'debts',
            'description': 'When savings balance can cover the next target debt',
            'title_template': 'Ready to Pay Off: {{debt_label}}',
            'body_template': 'Your savings (${{savings_balance}}) can now cover {{debt_label}} (${{debt_balance}}). Ready to pay it off?',
        },
        {
            'name': 'Savings Approaching Target',
            'event_name': 'debt.savings_approaching',
            'module': 'debts',
            'description': 'When savings reaches 80% of the next target debt',
            'title_template': 'Almost There: {{debt_label}}',
            'body_template': 'You\'re 80%+ of the way to paying off {{debt_label}}. ~${{shortfall}} more to go.',
        },
        {
            'name': 'All Debts Cleared',
            'event_name': 'debt.all_cleared',
            'module': 'debts',
            'description': 'When the last active debt is paid off',
            'title_template': 'All Debts Paid Off!',
            'body_template': 'All debts are paid off! Total interest saved: ${{total_interest_saved}}.',
        },
    ]

    for rule_data in debt_rules:
        existing = NotificationRule.query.filter_by(
            event_name=rule_data['event_name']
        ).first()
        if not existing:
            db.session.add(NotificationRule(
                name=rule_data['name'],
                description=rule_data['description'],
                module=rule_data['module'],
                rule_type='event',
                event_name=rule_data['event_name'],
                title_template=rule_data['title_template'],
                body_template=rule_data['body_template'],
                priority='normal',
                is_enabled=False,
            ))
    db.session.commit()
```

**Step 4: Add debt events to `AVAILABLE_EVENTS` in `backend/app/routes/notifications.py`**

After the last entry in `AVAILABLE_EVENTS` (the `astro.apod_new` entry ending at line 168), add before the closing `]`:

```python
    # ── Debt Payoff Events ─────────────────────────────────────
    {
        'name': 'debt.paid_off',
        'module': 'debts',
        'description': 'When a debt is fully paid off',
        'fields': ['debt_label', 'monthly_payment', 'total_freed_monthly'],
    },
    {
        'name': 'debt.autopay_logged',
        'module': 'debts',
        'description': 'When an autopay payment is recorded',
        'fields': ['debt_label', 'amount_paid', 'remaining_balance'],
    },
    {
        'name': 'debt.savings_ready',
        'module': 'debts',
        'description': 'When savings balance can cover the next target debt',
        'fields': ['savings_balance', 'debt_label', 'debt_balance'],
    },
    {
        'name': 'debt.savings_approaching',
        'module': 'debts',
        'description': 'When savings reaches 80% of the next target debt',
        'fields': ['savings_balance', 'debt_label', 'debt_balance', 'shortfall'],
    },
    {
        'name': 'debt.all_cleared',
        'module': 'debts',
        'description': 'When all debts are paid off',
        'fields': ['total_interest_saved', 'total_debts_paid'],
    },
```

**Step 5: Commit**

```bash
git add backend/app/__init__.py backend/app/routes/notifications.py
git commit -m "feat(debt): register blueprint, seed notification rules, add AVAILABLE_EVENTS"
```

---

## Task 4: Backend — Autopay Cron Job

**Files:**
- Modify: `backend/app/services/scheduler.py`

**Step 1: Add the autopay job registration in `init_scheduler()`**

In `init_scheduler()`, after the line `_reconcile_launch_reminders()` (line 71), add:

```python
            _add_debt_autopay_job()
```

**Step 2: Add the job functions at the end of the file**

After the `_fire_delayed_push` function (end of file), add:

```python


# ═══════════════════════════════════════════════════════════════════════════
# Debt Autopay Daily Check
# ═══════════════════════════════════════════════════════════════════════════

def _add_debt_autopay_job():
    """Add a daily job at 1 AM Central to process autopay debts."""
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _run_debt_autopay,
        trigger='cron',
        id='debt_autopay_check',
        hour=7,       # 1 AM Central = 7 AM UTC (during CDT; 7 AM UTC = 1 AM CDT)
        minute=0,
        replace_existing=True,
    )
    logger.info("Debt autopay check job scheduled (daily at 1 AM Central / 7 AM UTC)")


def _run_debt_autopay():
    """Process autopay for debts due today. Idempotent — skips if already processed."""
    global _app
    if not _app:
        return

    with _app.app_context():
        from app import db
        from app.models.debt import Debt, DebtPayment
        from app.services.event_bus import emit
        from datetime import date
        from decimal import Decimal
        from sqlalchemy import func

        try:
            today = date.today()
            today_day = today.day

            # Find autopay-eligible debts due today
            eligible = Debt.query.filter(
                Debt.autopay_enabled == True,      # noqa: E712
                Debt.due_day == today_day,
                Debt.status.in_(['active', 'targeted']),
            ).all()

            if not eligible:
                return

            processed = 0
            for debt in eligible:
                # Idempotent: skip if already processed today
                existing = DebtPayment.query.filter_by(
                    debt_id=debt.id,
                    payment_date=today,
                    payment_type='autopay',
                ).first()
                if existing:
                    continue

                # Calculate payment amount (capped at remaining balance)
                amount = min(debt.monthly_payment, debt.current_balance)

                payment = DebtPayment(
                    debt_id=debt.id,
                    amount_paid=amount,
                    interest_saved=Decimal('0'),
                    payment_date=today,
                    payment_type='autopay',
                    notes='Automatic payment',
                )
                db.session.add(payment)

                # Deduct from balance
                debt.current_balance = max(Decimal('0'), debt.current_balance - amount)

                was_active = debt.status in ('active', 'targeted')

                # Check if paid off
                if debt.current_balance <= 0:
                    debt.status = 'paid_off'
                    debt.paid_off_date = today

                db.session.flush()

                # Emit autopay notification
                try:
                    emit('debt.autopay_logged',
                         debt_label=debt.label,
                         amount_paid=float(amount),
                         remaining_balance=float(debt.current_balance))
                except Exception:
                    pass

                # Emit paid-off notification if applicable
                if debt.status == 'paid_off' and was_active:
                    try:
                        freed = db.session.query(
                            func.coalesce(func.sum(Debt.monthly_payment), 0)
                        ).filter(Debt.status == 'paid_off').scalar()

                        emit('debt.paid_off',
                             debt_label=debt.label,
                             monthly_payment=float(debt.monthly_payment),
                             total_freed_monthly=float(freed))

                        # Check if all debts cleared
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

                processed += 1

            db.session.commit()
            if processed:
                logger.info(f"Debt autopay: processed {processed} payment(s)")

        except Exception as e:
            db.session.rollback()
            logger.error(f"Debt autopay check failed: {e}")
```

**Step 3: Commit**

```bash
git add backend/app/services/scheduler.py
git commit -m "feat(debt): add daily autopay cron job (1 AM Central)"
```

---

## Task 5: Apple App — Swift Models

**Files:**
- Create: `Datacore/Models/Debt.swift`

All models go in one file since they're small and tightly coupled.

**Step 1: Create the model file**

```swift
import Foundation

/// A tracked debt with balance, monthly payment, and payoff status.
/// Matches Flask Debt.to_dict() output.
struct Debt: Codable, Sendable, Identifiable {
    let id: Int
    let label: String
    let originalBalance: Double
    let currentBalance: Double
    let monthlyPayment: Double
    let interestRate: Double?
    let status: String
    let autopayEnabled: Bool?
    let dueDay: Int?
    let payoffOrder: Int?
    let paidOffDate: String?
    let createdAt: String?
    let updatedAt: String?
    let payments: [DebtPayment]?
    let paymentCount: Int?
    let ratio: Double?

    // Projected fields from snowball endpoint
    let shortfall: Double?
    let monthsUntilReady: Double?

    /// Whether this debt is still active (not paid off).
    var isActive: Bool { status != "paid_off" }

    /// Display-friendly status label.
    var statusLabel: String {
        switch status {
        case "paid_off": "Paid Off"
        case "targeted": "Targeted"
        case "active": "Active"
        default: status.capitalized
        }
    }
}


/// An immutable payment record against a debt.
/// Matches Flask DebtPayment.to_dict() output.
struct DebtPayment: Codable, Sendable, Identifiable {
    let id: Int
    let debtId: Int
    let amountPaid: Double
    let interestSaved: Double?
    let paymentDate: String?
    let paymentType: String?
    let notes: String?
    let createdAt: String?

    /// Display-friendly payment type label.
    var typeLabel: String {
        switch paymentType {
        case "lump_sum": "Lump Sum"
        case "autopay": "Autopay"
        case "manual": "Manual"
        default: paymentType?.capitalized ?? "Unknown"
        }
    }
}


/// A savings balance snapshot from the append-only snowball_savings table.
/// Matches Flask SnowballSavings.to_dict() output.
struct SnowballSavings: Codable, Sendable, Identifiable {
    let id: Int
    let balance: Double
    let notes: String?
    let createdAt: String?
    let updatedAt: String?
}


/// Dashboard summary returned by GET /api/debts/snowball.
struct SnowballDashboard: Codable, Sendable {
    let freedMonthly: Double
    let currentSavings: Double
    let totalInterestSaved: Double
    let totalPaidOff: PaidOffSummary
    let remainingDebts: [Debt]
    let nextTarget: Debt?
    let totalRemainingBalance: Double

    struct PaidOffSummary: Codable, Sendable {
        let count: Int
        let sum: Double
    }
}


/// Response from GET /api/debts/savings.
struct SavingsResponse: Codable, Sendable {
    let currentBalance: Double
    let updatedAt: String?
    let history: [SnowballSavings]
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/Debt.swift
git commit -m "feat(debt): add Swift model structs for Debt, DebtPayment, SnowballSavings"
```

---

## Task 6: Apple App — Endpoint Cases

**Files:**
- Modify: `Datacore/Network/Endpoint.swift`

**Step 1: Add enum cases**

After the `// MARK: - Snooze` section (line 230), before the `/// The URL path component` comment (line 233), add:

```swift
    // MARK: - Debts
    case debts                                          // GET  /api/debts/
    case debt(id: Int)                                  // GET  /api/debts/<id>
    case createDebt                                     // POST /api/debts/
    case updateDebt(id: Int)                            // PUT  /api/debts/<id>
    case deleteDebt(id: Int)                            // DELETE /api/debts/<id>
    case debtPayments(debtId: Int)                      // GET  /api/debts/<id>/payments
    case createDebtPayment(debtId: Int)                 // POST /api/debts/<id>/payments
    case debtSavings                                    // GET  /api/debts/savings
    case createDebtSavings                              // POST /api/debts/savings
    case debtSnowball                                   // GET  /api/debts/snowball
```

**Step 2: Add paths to the `path` computed property**

Before the closing `}` of the `path` property (before the `/// Query parameters` comment), add:

```swift
        // Debts
        case .debts, .createDebt:                          return "/api/debts/"
        case .debt(let id),
             .updateDebt(let id),
             .deleteDebt(let id):                          return "/api/debts/\(id)"
        case .debtPayments(let debtId),
             .createDebtPayment(let debtId):               return "/api/debts/\(debtId)/payments"
        case .debtSavings, .createDebtSavings:             return "/api/debts/savings"
        case .debtSnowball:                                return "/api/debts/snowball"
```

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Network/Endpoint.swift
git commit -m "feat(debt): add Endpoint enum cases for debt API"
```

---

## Task 7: Apple App — ViewModel

**Files:**
- Create: `Datacore/ViewModels/DebtViewModel.swift`

**Step 1: Create the ViewModel**

```swift
import Foundation

/// Manages debt tracking state — loading, CRUD, savings, and snowball dashboard.
@Observable
@MainActor
final class DebtViewModel {
    // MARK: - State

    var debts: [Debt] = []
    var selectedDebt: Debt?
    var snowball: SnowballDashboard?
    var savingsResponse: SavingsResponse?
    var isLoading = false
    var error: APIError?

    /// Current savings balance (convenience accessor).
    var currentSavings: Double { savingsResponse?.currentBalance ?? 0 }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        error = nil
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadDebts() }
            group.addTask { await self.loadSnowball() }
            group.addTask { await self.loadSavings() }
        }
        isLoading = false
    }

    // MARK: - Debts

    func loadDebts() async {
        do {
            debts = try await APIClient.shared.get(.debts)
            DebtDataCache.debts = debts
        } catch let apiError as APIError {
            if debts.isEmpty {
                if let cached = DebtDataCache.debts { debts = cached }
                else { self.error = apiError }
            }
        } catch {}
    }

    func loadDebtDetail(id: Int) async {
        do {
            selectedDebt = try await APIClient.shared.get(.debt(id: id))
            DebtDataCache.setDebt(selectedDebt, for: id)
        } catch let apiError as APIError {
            if selectedDebt == nil {
                selectedDebt = DebtDataCache.debt(for: id)
                if selectedDebt == nil { self.error = apiError }
            }
        } catch {}
    }

    func createDebt(_ data: [String: Any]) async -> Bool {
        do {
            let _: Debt = try await APIClient.shared.post(.createDebt, body: data)
            await loadAll()
            return true
        } catch {
            self.error = error as? APIError
            return false
        }
    }

    func updateDebt(id: Int, _ data: [String: Any]) async -> Bool {
        do {
            let _: Debt = try await APIClient.shared.put(.updateDebt(id: id), body: data)
            await loadAll()
            return true
        } catch {
            self.error = error as? APIError
            return false
        }
    }

    func deleteDebt(id: Int) async -> Bool {
        do {
            try await APIClient.shared.delete(.deleteDebt(id: id))
            if selectedDebt?.id == id { selectedDebt = nil }
            await loadAll()
            return true
        } catch {
            self.error = error as? APIError
            return false
        }
    }

    // MARK: - Payments

    func logPayment(debtId: Int, _ data: [String: Any]) async -> Bool {
        do {
            let _: DebtPayment = try await APIClient.shared.post(
                .createDebtPayment(debtId: debtId), body: data
            )
            await loadAll()
            // Refresh the detail view too
            await loadDebtDetail(id: debtId)
            return true
        } catch {
            self.error = error as? APIError
            return false
        }
    }

    // MARK: - Savings

    func loadSavings() async {
        do {
            savingsResponse = try await APIClient.shared.get(.debtSavings)
        } catch {}
    }

    func updateSavings(balance: Double, notes: String?) async -> Bool {
        let body: [String: Any] = [
            "balance": balance,
            "notes": notes as Any,
        ]
        do {
            let _: SnowballSavings = try await APIClient.shared.post(
                .createDebtSavings, body: body
            )
            await loadAll()
            return true
        } catch {
            self.error = error as? APIError
            return false
        }
    }

    // MARK: - Snowball Dashboard

    func loadSnowball() async {
        do {
            snowball = try await APIClient.shared.get(.debtSnowball)
            DebtDataCache.snowball = snowball
        } catch {
            if snowball == nil { snowball = DebtDataCache.snowball }
        }
    }
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/ViewModels/DebtViewModel.swift
git commit -m "feat(debt): add DebtViewModel with CRUD, payments, savings, snowball"
```

---

## Task 8: Apple App — Cache

**Files:**
- Create: `Datacore/Cache/DebtDataCache.swift`

**Step 1: Create the cache file**

```swift
import Foundation

/// Persistent cache for Debt data, enabling offline browsing.
enum DebtDataCache {
    private nonisolated(unsafe) static let store = SharedDefaults.store

    // MARK: - Debts List

    private static let debtsKey = "ios_debts"

    static var debts: [Debt]? {
        get { decode(forKey: debtsKey) }
        set { encode(newValue, forKey: debtsKey) }
    }

    // MARK: - Per-Debt Detail

    static func debt(for id: Int) -> Debt? {
        decode(forKey: "ios_debt_\(id)")
    }

    static func setDebt(_ debt: Debt?, for id: Int) {
        encode(debt, forKey: "ios_debt_\(id)")
    }

    // MARK: - Snowball Dashboard

    private static let snowballKey = "ios_debt_snowball"

    static var snowball: SnowballDashboard? {
        get { decode(forKey: snowballKey) }
        set { encode(newValue, forKey: snowballKey) }
    }

    // MARK: - Helpers

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private static func encode<T: Encodable>(_ value: T?, forKey key: String) {
        guard let value else { store.removeObject(forKey: key); return }
        store.set(try? encoder.encode(value), forKey: key)
    }

    private static func decode<T: Decodable>(forKey key: String) -> T? {
        guard let data = store.data(forKey: key) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Cache/DebtDataCache.swift
git commit -m "feat(debt): add DebtDataCache for offline persistence"
```

---

## Task 9: Apple App — AppModule & Wire-Up

**Files:**
- Modify: `Datacore/Models/AppModule.swift`
- Modify: `Datacore/DatacoreApp.swift`
- Modify: `Datacore/Views/Shared/DatacoreNotifications.swift`

**Step 1: Add `debts` case to AppModule enum**

In `AppModule.swift`, add `debts` to the case list (after `obd`):

```swift
    case workHours, obd, debts, settings
```

Add title in the switch:

```swift
        case .debts: "Debt Payoff"
```

**Step 2: Add ViewModel injection in `DatacoreApp.swift`**

Add a new `@State` property (after `obdVM`, line 67):

```swift
    @State private var debtVM = DebtViewModel()
```

Add `.environment()` call (after `.environment(obdVM)`, line 89):

```swift
                .environment(debtVM)
```

**Step 3: Add notification name in `DatacoreNotifications.swift`**

Add at the end of the extension:

```swift
    static let datacoreAddDebt = Notification.Name("datacoreAddDebt")
    static let datacoreAddDebtPayment = Notification.Name("datacoreAddDebtPayment")
```

**Step 4: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/AppModule.swift Datacore/DatacoreApp.swift Datacore/Views/Shared/DatacoreNotifications.swift
git commit -m "feat(debt): add AppModule case, ViewModel injection, notification names"
```

---

## Task 10: Apple App — Wire-up (Mac, Sidebars, ContentView, EnvironmentInjector)

This task wires the new module into all navigation surfaces. The exact files and locations depend on the current state of:

- `Datacore/ContentView.swift` — iPad/iPhone navigation
- `Datacore/MacApp/MacModuleRouter.swift` — macOS routing
- `Datacore/MacApp/MacDatacoreApp.swift` — macOS ViewModel injection
- `Datacore/Views/Shared/iPadSidebar.swift` — iPad sidebar
- `Datacore/MacApp/MacSidebar.swift` — Mac sidebar
- `Datacore/Views/Shared/EnvironmentInjector.swift` — shared environment injection
- `Datacore/Views/Shared/ControlPill.swift` — toolbar actions

**Step 1: Read each file and add the debt module entry**

For each file, find the existing pattern (e.g., the `case .obd:` or `case .workHours:` line) and add a matching `case .debts:` entry.

**ContentView.swift — `selectedModuleView` switch:**
```swift
case .debts:
    DebtView()
```

**ContentView.swift — MoreView (iPhone):**
```swift
NavigationLink {
    DebtView()
} label: {
    Label("Debt Payoff", systemImage: "creditcard")
}
```

**MacModuleRouter.swift:**
```swift
case .debts:
    MacDebtView()
```

**iPadSidebar.swift:**
```swift
sidebarRow(.debts, icon: "creditcard", label: "Debt Payoff")
```

**MacSidebar.swift:**
```swift
sidebarRow(.debts, icon: "creditcard", label: "Debt Payoff")
```

**MacDatacoreApp.swift:**
```swift
@State private var debtVM = DebtViewModel()
// ... and in .environment chain:
.environment(debtVM)
```

**EnvironmentInjector.swift:**
Add `debtVM: DebtViewModel` parameter and `.environment(debtVM)` modifier. Update all call sites.

**ControlPill.swift:**
```swift
case .debts:
    pillButton(icon: "plus", help: "Add Debt (Cmd+N)") {
        NotificationCenter.default.post(name: .datacoreAddDebt, object: nil)
    }
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -A
git commit -m "feat(debt): wire up navigation — sidebars, ContentView, MacRouter, ControlPill"
```

---

## Task 11: Apple App — iOS Views (iPhone + iPad)

**Files:**
- Create: `Datacore/Views/Debt/DebtView.swift` — Main list + summary
- Create: `Datacore/Views/Debt/DebtDetailView.swift` — Detail + payment history
- Create: `Datacore/Views/Debt/DebtFormView.swift` — Add/edit debt form
- Create: `Datacore/Views/Debt/DebtPaymentFormView.swift` — Log payment form
- Create: `Datacore/Views/Debt/DebtSavingsView.swift` — Savings tracker

These views follow the existing patterns from other modules (WorkHoursView, FuelEconomyView):

- `@Environment(DebtViewModel.self)` for state
- `@Environment(\.horizontalSizeClass)` for iPad/iPhone branching
- `.platformNavTitleDisplayMode(sizeClass == .regular ? .inline : .large)`
- `.offlineBanner()` on root views
- `.onReceive(NotificationCenter.default.publisher(for: .datacoreRefresh))` for toolbar refresh
- `.onReceive(NotificationCenter.default.publisher(for: .datacoreAddDebt))` for toolbar add

**View Architecture:**

**DebtView (main):**
- iPhone: ScrollView with summary cards (total remaining, freed monthly, savings, interest saved) at top, then debt list with status badges. Tap → push to DebtDetailView.
- iPad: HStack split — left column: debt list, right column: inline DebtDetailView for selected debt. Summary cards across top.

**DebtDetailView:**
- Shows all debt info: label, original/current balance, monthly payment, interest rate, status
- Autopay toggle + due day picker (`.pickerStyle(.menu)`)
- Payment history list
- "Log Payment" button → sheet with DebtPaymentFormView

**DebtFormView:**
- Fields: label, original balance, current balance, monthly payment, interest rate (optional), status picker, autopay toggle, due day
- No TextField for amounts — use `.keyboardType(.decimalPad)` on TextFields
- Passed via `onSubmit` callback (not API call — parent handles API)

**DebtPaymentFormView:**
- Fields: amount paid, payment date (DatePicker), payment type picker (manual/lump_sum), notes
- `onSubmit` callback pattern

**DebtSavingsView:**
- Large current savings balance
- Quick-update TextField + "Update" button
- Progress bar toward next target (from snowball dashboard)
- ETA text: "~X months until you can pay off [next target]"
- History list of balance updates

**Step 1: Build all views following the patterns above**

The implementer should study `WorkHoursView.swift` and `FuelEconomyView.swift` as reference. Key patterns to match:

- Summary stat cards use `VStack { Image(systemName:) ... Text(value) ... Text(label) }` with `.background(.quaternary, in: .rect(cornerRadius: 12))` for card styling
- Lists use `ForEach` with `NavigationLink(value:)` for iPhone, inline selection for iPad
- Forms use `.sheet()` with `NavigationStack` inside
- Money formatting: `String(format: "$%.2f", value)` or use `formatted(.currency(code: "USD"))`

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Debt/
git commit -m "feat(debt): add iOS views — DebtView, DebtDetailView, forms, savings"
```

---

## Task 12: Apple App — macOS View

**Files:**
- Create: `Datacore/MacApp/Modules/MacDebtView.swift`

**Step 1: Create the Mac view**

Follow the `MacFuelEconomyView.swift` pattern:

```swift
#if os(macOS)
struct MacDebtView: View {
    @Environment(DebtViewModel.self) private var vm
    // ... state for sheets, selection

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                statsCards
                debtTable
                savingsSection
            }
            .padding()
        }
        // ... overlays, sheets, task, onReceive
    }

    // Stats: HStack of 4 stat cards (total remaining, freed monthly, savings, interest saved)
    // Debt table: native Table with columns (Label, Balance, Monthly, Rate, Status, Autopay)
    // Context menu: Edit, Log Payment, Delete
    // Savings section: current balance, update form, progress bar
}
#endif
```

Key Mac patterns:
- Wrap entire struct in `#if os(macOS)` ... `#endif`
- Use native `Table` for debt list
- Context menus via `.contextMenu(forSelectionType:)`
- Sheets get `.macSheetFrame()`
- Background uses `.quaternary`

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/MacApp/Modules/MacDebtView.swift
git commit -m "feat(debt): add macOS view with native Table and stat cards"
```

---

## Task 13: Build Verification

**Step 1: Regenerate Xcode project**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
```

**Step 2: Build iOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Build macOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 4: Fix any errors and rebuild until clean**

**Step 5: Ask about version bump, then commit and push**

---

## Task Dependency Graph

```
Task 1 (Models) ─────┐
                      ├── Task 3 (Registration) ── Task 4 (Autopay Cron)
Task 2 (Routes) ─────┘

Task 5 (Swift Models) ── Task 6 (Endpoints) ── Task 7 (ViewModel) ── Task 8 (Cache)
                                                       │
Task 9 (AppModule/Wire) ──────────────────── Task 10 (Nav Wire-up)
                                                       │
                                              Task 11 (iOS Views)
                                              Task 12 (Mac View)
                                                       │
                                              Task 13 (Build Verify)
```

Backend tasks (1-4) and Apple tasks (5-12) can proceed in parallel. Task 13 must be last.
