# Debt Payoff Tracker — Design Document

**Date:** 2026-03-13
**Platform:** iOS + macOS only (no web frontend). Flask/PostgreSQL backend for API and persistence.
**Strategy:** Cash-flow-liberation — prioritize debts that free the most monthly payment per dollar spent.

---

## Data Model

### Table: `debts`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| label | VARCHAR(100) | User-defined label (e.g. "Debt #6") |
| original_balance | Numeric(10,2) | Balance at time of entry |
| current_balance | Numeric(10,2) | Updated as payments are logged |
| monthly_payment | Numeric(10,2) | Required monthly payment amount |
| interest_rate | Numeric(5,2) NULLABLE | APR if known, optional |
| status | VARCHAR(20) | `active`, `targeted`, `paid_off` |
| autopay_enabled | BOOLEAN | Default FALSE |
| due_day | INTEGER NULLABLE | Day of month (1-31). Required if autopay enabled |
| payoff_order | INTEGER NULLABLE | Priority rank within the plan |
| paid_off_date | DATE NULLABLE | Set when fully paid |
| created_at | TIMESTAMP | Default NOW() UTC |
| updated_at | TIMESTAMP | Auto-update on change |

### Table: `debt_payments`

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| debt_id | INTEGER FK -> debts.id | CASCADE delete |
| amount_paid | Numeric(10,2) | Actual amount paid |
| interest_saved | Numeric(10,2) | Auto-calculated on lump_sum: current_balance - amount_paid. 0 for regular/autopay. |
| payment_date | DATE | When payment was made |
| payment_type | VARCHAR(20) | `manual`, `autopay`, `lump_sum` |
| notes | TEXT NULLABLE | Optional context |
| created_at | TIMESTAMP | Default NOW() UTC |

Payments are immutable. Corrections are logged as new adjustment entries.

### Table: `snowball_savings`

Append-only. Each row is a balance snapshot. Current balance = most recent row.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| balance | Numeric(10,2) | Current savings balance |
| notes | TEXT NULLABLE | Optional context |
| created_at | TIMESTAMP | Default NOW() UTC |
| updated_at | TIMESTAMP | Auto-update |

### Design Decisions

- All money fields use `db.Numeric(10, 2)` for precise decimal math (not `db.Float`).
- Snowball savings is append-only for full audit trail of balance changes.
- No deletion of payment records — immutable once logged.
- Single active plan — no campaign/plan table. All active + targeted debts form the plan.

---

## API Endpoints

All under `/api/debts/` prefix. Blueprint: `debts_bp`.

### Debts CRUD

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/debts/` | List all debts (sorted by payoff_order, then ratio) |
| POST | `/api/debts/` | Create new debt |
| GET | `/api/debts/<id>` | Single debt with payment history |
| PUT | `/api/debts/<id>` | Update debt fields |
| DELETE | `/api/debts/<id>` | Delete debt (cascades payments) |

### Payments

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/debts/<id>/payments` | Log a payment |
| GET | `/api/debts/<id>/payments` | Payment history for a debt |

**Payment behavior:**
- Deducts `amount_paid` from `current_balance`
- If `payment_type = 'lump_sum'`: auto-calculate `interest_saved = current_balance - amount_paid`
- If `current_balance <= 0` after deduction: auto-set `status = 'paid_off'`, `paid_off_date = today`
- Emits `debt.paid_off` event if status changed

### Savings

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/debts/savings` | Log new savings balance snapshot (body: `{ balance, notes }`) |
| GET | `/api/debts/savings` | Current savings balance + history |

**Savings behavior:**
- After insert, evaluate notification triggers (ready to pay off, approaching payoff)

### Snowball Dashboard

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/debts/snowball` | Full dashboard summary |

**Returns:**
- `freed_monthly`: SUM(monthly_payment) WHERE status = 'paid_off'
- `current_savings`: most recent snowball_savings.balance
- `remaining_debts`: ordered by cash-flow-liberation ratio (monthly_payment / current_balance DESC)
- `next_target`: the highest-ratio active/targeted debt, with shortfall and ETA
- `total_interest_saved`: SUM(interest_saved) across all payments
- `total_paid_off`: count and sum of cleared debts
- `projected_timeline`: estimated months to clear each remaining debt in priority order

### Strategy Calculator (v2 — deferred)

`GET /api/debts/strategy?budget=<amount>` — What-if simulation for lump-sum payoff planning.

---

## Autopay Cron Job

- **Schedule:** Daily at 1:00 AM Central (`America/Chicago`) via APScheduler
- **Query:** `autopay_enabled = True AND due_day = today AND status IN ('active', 'targeted')`
- **Idempotent:** Skip if payment with `payment_type = 'autopay'` already exists for this debt on this date
- **Actions:**
  1. Create `debt_payments` record: `amount_paid = monthly_payment`, `interest_saved = 0`, `payment_type = 'autopay'`
  2. Deduct `monthly_payment` from `current_balance`
  3. If `current_balance <= 0`: auto-set `status = 'paid_off'`, `paid_off_date = today`
  4. Emit `debt.autopay_logged` event
  5. If paid off, also emit `debt.paid_off` event
- **Note:** Autopay is tracking only — Datacore does not move real money. Records reflect that real-world autopay occurred.

---

## Notification Events

Emitted through the existing event bus. Registered in `AVAILABLE_EVENTS` so users create rules via Notifications settings page. All channels including native iOS APNs push fire through the existing dispatcher.

| Event | Trigger | Template Fields |
|-------|---------|-----------------|
| `debt.paid_off` | Balance hits 0 | `debt_label`, `monthly_payment`, `total_freed_monthly` |
| `debt.autopay_logged` | Autopay cron fires | `debt_label`, `amount_paid`, `remaining_balance` |
| `debt.savings_ready` | Savings >= next target balance | `savings_balance`, `debt_label`, `debt_balance` |
| `debt.savings_approaching` | Savings >= 80% of next target | `savings_balance`, `debt_label`, `debt_balance`, `shortfall` |
| `debt.all_cleared` | Last active/targeted debt paid off | `total_interest_saved`, `total_debts_paid` |

---

## Derived Calculations

### Freed Monthly Cash Flow
```sql
SUM(monthly_payment) WHERE status = 'paid_off'
```

### Payoff Priority Ranking (Cash-Flow-Liberation Ratio)
```
ratio = monthly_payment / current_balance
ORDER BY ratio DESC
```
Higher ratio = more monthly payment freed per dollar spent.

### Interest Saved (on lump-sum payoff)
```
interest_saved = current_balance - amount_paid
```
Only calculated on `lump_sum` payments. Regular monthly/autopay payments have `interest_saved = 0`.

### Projected Payoff Timeline
Given freed cash flow + savings balance, estimate months to clear each remaining debt in priority order. Factor in autopay deductions reducing balances over time.

### Savings Shortfall
```
shortfall = next_target_balance - current_savings
months_until_ready = shortfall / freed_monthly
```

---

## iOS / macOS App Architecture

### Models (Codable + Sendable structs)

- `Debt.swift` — id, label, originalBalance, currentBalance, monthlyPayment, interestRate, status, autopayEnabled, dueDay, payoffOrder, paidOffDate, payments (optional nested array)
- `DebtPayment.swift` — id, debtId, amountPaid, interestSaved, paymentDate, paymentType, notes
- `SnowballSavings.swift` — id, balance, notes, createdAt
- `SnowballDashboard.swift` — freedMonthly, currentSavings, remainingDebts, nextTarget, totalInterestSaved, totalPaidOff, projectedTimeline

### Endpoint Enum Cases

```
case debts, createDebt
case debt(id: Int), updateDebt(id: Int), deleteDebt(id: Int)
case debtPayments(debtId: Int), createDebtPayment(debtId: Int)
case debtSavings, createDebtSavings
case debtSnowball
```

### ViewModel: `DebtViewModel.swift`

`@Observable @MainActor` with:
- `debts: [Debt]`, `selectedDebt: Debt?`, `snowball: SnowballDashboard?`
- `savingsHistory: [SnowballSavings]`, `currentSavings: Decimal?`
- `isLoading`, `error: APIError?`
- Async methods: `loadDebts()`, `loadDebtDetail(id:)`, `createDebt()`, `updateDebt()`, `deleteDebt()`, `logPayment()`, `updateSavings()`, `loadSnowball()`
- Cache-first loading via `DebtDataCache`

### Cache: `DebtDataCache.swift`

App Group UserDefaults with `ios_debts`, `ios_debt_<id>`, `ios_snowball` keys.

### Views

**iPhone (compact sizeClass):**
- `DebtView.swift` — Main list view with summary cards at top (total debt, freed monthly, savings, interest saved). Debt rows show label, balance, monthly payment, status badge, autopay indicator. Paid-off debts muted.
- Tap debt → push to `DebtDetailView.swift` — Full info, autopay toggle + due day picker, payment history, log payment button
- `DebtSavingsView.swift` — Large savings balance, quick-update field, progress bar toward next target, ETA, history
- `DebtPaymentFormView.swift` — Amount paid, date, payment type picker, notes

**iPad (regular sizeClass):**
- `HStack` split: debt list left, inline detail right
- Snowball summary cards across top
- Same data, denser layout

**Mac:**
- `MacDebtView.swift` — `NavigationSplitView` with list + detail pane
- Same ViewModel, native macOS materials

**Navigation:**
- Add `case debts` to `AppModule` enum
- Wire into TabView (iPhone), sidebar (iPad/Mac)
- Icon: `creditcard` or `chart.line.downtrend.xyaxis` (SF Symbols)

---

## Out of Scope (v1)

- Strategy calculator endpoint (`GET /api/debts/strategy`)
- Apple Watch views/complications
- Web frontend (Catppuccin/LCARS)
- Debt-to-debt transfers or consolidation tracking
- Recurring income tracking
