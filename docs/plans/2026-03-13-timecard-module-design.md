# Timecard Module — Design Document

**Date:** 2026-03-13
**Status:** Approved
**Replaces:** Work Hours module (monthly manual entry)

## Overview

Replace external TogglTrack and the existing Work Hours module with native Datacore time tracking. Timer runs entirely on the backend (no iOS background timer). Supports clock-in/out via iOS app, Apple Watch, App Intents (Focus mode automations), and actionable push notifications.

**No React frontend changes.** iOS/iPad/Mac/Watch only.

---

## Database

### Table: `time_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `start_time` | timestamptz, NOT NULL | Always UTC |
| `end_time` | timestamptz, nullable | NULL = timer running |
| `work_type` | varchar, NOT NULL | `in_office`, `wfh`, `support_call`, `business_travel`, `holiday`, `vacation` |
| `duration_seconds` | integer, nullable | Computed on stop: `end_time - start_time` |
| `notes` | text, nullable | |
| `forgotten_alert_sent` | boolean, default false | Prevents duplicate forgotten-timer notifications |
| `created_at` | timestamptz, default now(UTC) | |

### Constraints & Indexes

- **Partial unique index:** `CREATE UNIQUE INDEX idx_one_active_timer ON time_entries ((TRUE)) WHERE end_time IS NULL` — enforces one active timer at the DB level.
- **Index on start_time:** `CREATE INDEX idx_time_entries_start ON time_entries (start_time)` — for date-range queries.

### No Summary Tables

All statistics computed live from `time_entries` via SQL aggregation. The table will have at most a few thousand rows after years of use — no performance concern.

### Migration Approach

Idempotent SQL in `_run_safe_migrations()` matching the existing pattern. The `time_entries` table is also defined as a SQLAlchemy model so `db.create_all()` creates it on first startup.

### Old Work Hours Data

The old `work_hours_months` table remains in the DB (additive-only policy) but nothing reads it. Clean break.

---

## Flask API — `/api/timecard/`

Blueprint: `timecard_bp` registered at `/api/timecard` in `__init__.py`.

### Core Timer Endpoints

**`POST /start`** — Start a timer.
- Body: `{work_type: string, notes?: string}`
- Valid work types for start: `in_office`, `wfh`, `support_call`, `business_travel`
- If timer already running: auto-stop it first (compute duration, close it), then start new one. Return both stopped and new entries.
- Emits `timecard.clock_in` event (and `timecard.auto_stop` if a timer was stopped).
- Returns: `{entry: {...}, stopped_entry?: {...}}`

**`POST /stop`** — Stop the running timer.
- Body: `{notes?: string}` (optional override)
- If no timer running: return 400.
- Computes `duration_seconds = end_time - start_time`, closes entry.
- Emits `timecard.clock_out` event.
- Returns: `{entry: {...}}`

**`GET /status`** — Current timer state.
- Returns: `{active: bool, entry?: {id, work_type, start_time, elapsed_seconds, elapsed_display}}`
- `elapsed_seconds` computed server-side as `NOW() - start_time`.
- `elapsed_display` is human-readable (e.g., "4h 12m").

**`POST /quick-day`** — Log 8-hour holiday or vacation.
- Body: `{type: "holiday"|"vacation", date?: "YYYY-MM-DD"}`
- `date` defaults to today in America/Chicago.
- 409 if timer currently running (don't auto-stop for this endpoint).
- 409 if holiday/vacation already exists for that date.
- Creates a completed entry with `duration_seconds = 28800` (8 hours).
- Emits `timecard.quick_day` event.

### Data Endpoints

**`GET /history`** — Time entries for a date range.
- Params: `start_date`, `end_date`, `work_type` (optional filter)
- Returns completed entries ordered by `start_time` descending.

**`GET /stats`** — Aggregated statistics for charts.
- Params: `start_date`, `end_date`
- Returns:
  - `totals_by_type`: `[{work_type, total_hours, total_days, avg_hours_per_day}]`
  - `daily_breakdown`: `[{date, work_type, hours}]` — for stacked bar charts
  - `weekly_averages`: `[{week_start, avg_hours}]` — for trend line
- All computed live from `time_entries` via SQL aggregation.

### Entry Management

**`PUT /entry/<id>`** — Edit a time entry.
- Body: `{start_time?, end_time?, work_type?, notes?}`
- Recalculates `duration_seconds` if times change.

**`DELETE /entry/<id>`** — Delete a time entry.

---

## Scheduler Jobs

### Forgotten Timer Check

Added to `scheduler.py` via `_add_timecard_forgotten_timer_job()`.

- **Trigger:** APScheduler `interval`, every 1 hour
- **Logic:** Query for `end_time IS NULL AND start_time < NOW() - 8 hours AND forgotten_alert_sent = false`
- **Action:** Emit `timecard.forgotten_timer` event, set `forgotten_alert_sent = true`
- **Job ID:** `timecard_forgotten_timer_check`

---

## Notification Integration

### Events (5 total)

| Event Name | Trigger | Title Template | Body Template |
|------------|---------|----------------|---------------|
| `timecard.clock_in` | `/start` | `Clocked In` | `{{work_type_label}} at {{time}}` |
| `timecard.clock_out` | `/stop` | `Clocked Out` | `{{duration}} — {{work_type_label}}` |
| `timecard.auto_stop` | `/start` (timer running) | `Timer Switched` | `Stopped {{old_type}} ({{old_duration}}) → Started {{new_type}}` |
| `timecard.quick_day` | `/quick-day` | `Day Logged` | `{{day_type}} — 8h recorded for {{date}}` |
| `timecard.forgotten_timer` | Hourly scheduler | `Forgot to Clock Out?` | `{{work_type_label}} timer still running — {{duration}}` |

### Implementation

- **Seeded rules:** `_seed_timecard_notification_rules()` in `__init__.py`, all disabled by default.
- **AVAILABLE_EVENTS:** 5 entries added to list in `notifications.py` under module `timecard`.
- **APNs extras:** `thread_id: 'timecard'`, `deep_link: 'datacore://timecard'`.
- **Actionable notification:** `TIMECARD_CLOCK_OUT` category with "Clock Out" action button on `clock_in` and `forgotten_timer` notifications. Registered in iOS `PushNotificationManager`. Action handler calls `POST /api/timecard/stop`.

---

## Existing Code Removal

### Backend (delete)
- `backend/app/routes/work_hours.py`
- `backend/app/models/work_hours.py`
- Blueprint registration in `__init__.py`
- Model import in `__init__.py`

### iOS (delete)
- `Datacore/ViewModels/WorkHoursViewModel.swift`
- `Datacore/Views/WorkHours/WorkHoursView.swift`
- `Datacore/Views/WorkHours/WorkHoursMonthRow.swift`
- `Datacore/Views/WorkHours/WorkHoursEditSheet.swift`
- `Endpoint` cases: `.workHoursYears`, `.workHoursYear`, `.workHoursUpdateMonth`, `.workHoursSummary`

### iOS (modify)
- `AppModule`: Replace `.workHours` with `.timecard`
- `iPadSidebar`, `MacSidebar`, TabView: Update navigation entry
- `DashboardView`: Replace Work Hours summary card with Timecard status card

### Watch (delete)
- Work Hours related views/data if any exist in `DatacoreWatch/`

### DB tables
- `work_hours_months` and related tables remain in PostgreSQL (additive-only policy).

---

## iOS App — Timecard Module

### New Files

| File | Purpose |
|------|---------|
| `Models/TimeEntry.swift` | `Codable` struct matching `to_dict()` output |
| `Models/TimecardStatus.swift` | `Codable` struct for `/status` response |
| `Models/TimecardStats.swift` | `Codable` struct for `/stats` response |
| `ViewModels/TimecardViewModel.swift` | `@Observable @MainActor`, timer state, history, stats |
| `Views/Timecard/TimecardView.swift` | Root view with 3-tab segmented picker |
| `Views/Timecard/TimecardDashboardTab.swift` | Live timer, quick actions, today summary, week overview |
| `Views/Timecard/TimecardHistoryTab.swift` | Date-grouped entries, edit/delete |
| `Views/Timecard/TimecardStatsTab.swift` | Swift Charts (monthly bars, donut, trend line) |
| `Views/Timecard/TimecardEntryForm.swift` | Edit sheet for manual corrections |

### Endpoint Cases

New cases in `Endpoint.swift`:

```
// MARK: - Timecard
case timecardStart                    // POST /api/timecard/start
case timecardStop                     // POST /api/timecard/stop
case timecardStatus                   // GET  /api/timecard/status
case timecardQuickDay                 // POST /api/timecard/quick-day
case timecardHistory                  // GET  /api/timecard/history
case timecardStats                    // GET  /api/timecard/stats
case timecardEntry(id: Int)           // PUT/DELETE /api/timecard/entry/<id>
```

### Navigation

- `AppModule.timecard` — title: "Timecard", replaces `.workHours`
- Sidebar position: Productivity section (same slot as Work Hours)
- Icon: `clock.badge.checkmark`
- iPad/Mac: Same sidebar slot with badge showing active timer dot

### Timer Display

- `TimecardViewModel` stores `serverStartTime: Date?` from `/status`
- View uses `TimelineView(.periodic(from: .now, by: 1))` for 1-second local updates
- Silent `/status` re-sync every 60 seconds
- Backend is always source of truth

### Size Class Branching

- **iPhone:** Single-column, segmented tab picker at top
- **iPad/Mac:** Side-by-side panels (timer + today on left, week overview on right), inline history below

### Work Type Colors & Icons

| Work Type | Color | SF Symbol | Abbreviation |
|-----------|-------|-----------|--------------|
| In Office | `.orange` | `building.2` | OFC |
| WFH | `.blue` | `house` | WFH |
| Support Call | `.red` | `phone` | SUP |
| Business Travel | `.purple` | `airplane` | TRV |
| Holiday | `.green` | `gift` | HOL |
| Vacation | `.teal` | `beach.umbrella` | VAC |

---

## Apple Watch

### Complication: `TimecardComplication.swift`

Location: `DatacoreWatchComplications/`

- `TimecardEntry: TimelineEntry` — `date`, `isActive`, `workType`, `startTime`, `isPlaceholder`
- `TimecardProvider: TimelineProvider` — fetches `/api/timecard/status` via `WatchAPIClient`
- Forward timeline entries (30-min intervals over 4 hours) matching launch countdown pattern
- Cached via `WatchDataCache.timecardStatus`

**Families:**
- **Circular:** Play/stop icon + work type abbreviation (OFC, WFH, SUP, TRV)
- **Rectangular:** `Text(startTime, style: .timer)` for live elapsed display, or "Not Clocked In"

### Watch Detail View

`DatacoreWatch/Views/TimecardDetailView.swift` — Current status + Clock Out button. Added to `ContentView` hub and `WatchViewModel`.

### Watch Endpoint

`WatchEndpoint.timecardStatus` — `/api/timecard/status`

---

## App Intents (8 total)

Location: iOS app target (shared via `project.yml`), following existing `LogFuelIntent` pattern.

| Intent | Phrase | API Call |
|--------|--------|----------|
| `ClockInOfficeIntent` | "Clock In Office" | `POST /start {work_type: "in_office"}` |
| `ClockInWFHIntent` | "Clock In WFH" | `POST /start {work_type: "wfh"}` |
| `ClockInSupportCallIntent` | "Clock In Support Call" | `POST /start {work_type: "support_call"}` |
| `ClockInBusinessTravelIntent` | "Clock In Business Travel" | `POST /start {work_type: "business_travel"}` |
| `ClockOutIntent` | "Clock Out" | `POST /stop` |
| `TimecardStatusIntent` | "Time Status" | `GET /status` |
| `LogHolidayIntent` | "Log Holiday" | `POST /quick-day {type: "holiday"}` |
| `LogVacationIntent` | "Log Vacation" | `POST /quick-day {type: "vacation"}` |

All intents designed to run silently in Focus mode automations (no confirmation prompt required). Return confirmation dialog result for manual invocation.

---

## Implementation Order

1. Database: model + migration + partial unique index
2. Flask API: core endpoints (start, stop, status, quick-day)
3. Flask API: data endpoints (history, stats, entry CRUD)
4. Notification events + seeded rules + AVAILABLE_EVENTS
5. Forgotten timer scheduler job
6. Remove old Work Hours module (backend + iOS)
7. iOS: models, view model, Endpoint cases
8. iOS: views (dashboard tab, history tab, stats tab, entry form)
9. iOS: notification category + actionable "Clock Out" handler
10. App Intents (8 intents)
11. Watch complication
12. Watch detail view + WatchEndpoint
