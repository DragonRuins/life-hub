# Work Hours Module — Design Document

**Date:** 2026-02-26
**Status:** Approved

## Purpose

Track monthly hours worked against a 40-hour work week requirement. The user already tracks time in a separate app — this module stores monthly totals and visualizes overtime/deficit at a glance. Data starts from 2025. New years are auto-created lazily on first access.

## Data Model

**Table: `work_hours_log`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer PK | Auto-increment |
| `year` | Integer | e.g. 2025 |
| `month` | Integer | 1-12 |
| `hours_worked` | Float | Nullable — null means not yet entered |
| `created_at` | DateTime | UTC |
| `updated_at` | DateTime | UTC, auto-updates on edit |

**Unique constraint:** `(year, month)`

**Computed fields in `to_dict()`:**
- `month_name` — "January", "February", etc.
- `business_days` — weekdays (Mon-Fri) in that month/year via Python `calendar`
- `required_hours` — `business_days * 8`
- `overtime_hours` — `hours_worked - required_hours` (null if hours_worked is null)

No holiday exclusions — user adds 8 hours per holiday in their time tracker.

## API Endpoints

Blueprint: `work_hours_bp` at `/api/work_hours/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/<year>` | All 12 months for a year. Lazy-creates missing months. |
| `PUT` | `/<year>/<month>` | Update `hours_worked` for a specific month. |
| `GET` | `/years` | List all years with records (for dropdown). |
| `GET` | `/summary/<year>` | Year totals: hours worked, required, overtime. |

**Lazy creation:** On `GET /<year>`, if fewer than 12 records exist, create missing months with `hours_worked = None`. Years before 2025 are rejected (400).

## Frontend — Web (Triple Theme)

### Page Layout

- **Year dropdown** in header, defaults to current year
- **Two header stat cards:** Total Hours (sum of entered months), Total Overtime (sum of overtime — green if positive, red if negative)
- **12 month rows** each with a horizontal bar graph

### Bar Graph Behavior

Each month row displays one horizontal bar:
- **Under required hours:** Green bar fills to `hours_worked / required_hours`. Red segment fills the gap from actual to required mark. Bar max = `required_hours`.
- **Over required hours (overtime):** Green bar fills to `required_hours`. Amber segment extends beyond to `hours_worked`. Bar max = `hours_worked`.
- **Exact match:** Full green bar.
- **Not entered:** Empty/gray bar.

### Edit Interaction

Click any month row to open a modal with a number input for `hours_worked`. Pre-filled with current value. Save calls `PUT /<year>/<month>`.

### Theme Implementations

All three themes (Catppuccin, LCARS, Glass) get unique implementations following existing module patterns. Dashboard summary cards added to all three dashboards.

## Frontend — iOS/iPad/Mac

### Models & ViewModel

- `WorkHoursMonth` — Codable struct matching `to_dict()` output
- `WorkHoursViewModel` — `@Observable @MainActor`, fetches year data, handles updates, tracks selected year

### Platform Layouts

| Platform | Navigation | Edit UX |
|----------|------------|---------|
| iPhone | Single-column scroll | Tap row -> sheet |
| iPad | Dense layout, stat cards side-by-side | Tap row -> popover |
| Mac | Same as iPad via NavigationSplitView | Tap row -> popover |

### SwiftUI Views

- `WorkHoursView.swift` — main view with iPhone/iPad branching
- `WorkHoursMonthRow.swift` — single month bar row (reusable)
- `WorkHoursEditSheet.swift` — modal/sheet for hours input
- `WorkHoursStatCard.swift` — header stat card

Bar rendering uses `GeometryReader` with layered `RoundedRectangle` fills — same green/red/amber color logic as web.
