# Overtime Balance Timer — Design Document

**Date:** 2026-03-16
**Module:** Timecard (iOS, watchOS, backend)

## Overview

Add a live overtime balance display to the Timecard module. Shows the user their month-to-date overtime surplus or deficit in real time, ticking live when clocked in.

## Core Formula

```
expected_hours = weekdays_elapsed_including_today * 8
actual_hours   = completed_entries_this_month + manual_monthly_totals + active_timer_elapsed
balance        = actual_hours - expected_hours
```

- **Weekdays:** Monday-Friday, counted from the 1st of the current month through today (inclusive), using America/Chicago timezone.
- **Holidays/vacation:** Quick-day entries (8h each) count toward actual hours, keeping the balance even.
- **Balance sign:** Positive = ahead (overtime banked). Negative = behind (deficit).

### Example

- 10 weekdays have passed (including today) -> expected = 80h
- User has 77h of completed entries this month -> balance = -3h
- User clocks in -> balance starts at -3:00:00 and ticks upward each second
- After 3 hours of work -> balance hits 0:00:00
- After 8 hours of work -> balance reaches +5:00:00
- Beyond 8 hours -> new overtime accumulating

## Backend Endpoint

### `GET /api/timecard/overtime-balance`

**Response:**
```json
{
  "balance_seconds": -10800,
  "expected_hours": 80.0,
  "actual_hours": 77.0,
  "weekdays_elapsed": 10,
  "is_clocked_in": true,
  "clock_in_time": "2026-03-16T14:30:00Z"
}
```

**Calculation:**
1. Count weekdays from month start through today (inclusive) in America/Chicago timezone
2. `expected_hours = weekdays * 8`
3. `actual_hours = sum(completed time_entries this month) + sum(manual monthly_totals for current month)`
4. If clocked in: `actual_hours += (utcnow - start_time).total_seconds() / 3600`
5. `balance_seconds = int((actual_hours - expected_hours) * 3600)`

`clock_in_time` is included so clients can compute a reference point for local ticking without re-fetching.

## Approach: Snapshot + Client Tick

The client fetches the endpoint once (on load, clock-in/out, and foreground resume). If clocked in, the client increments `balance_seconds` locally by 1 every second. This avoids polling while keeping the display accurate.

## iOS — Timecard Dashboard Card

- **Placement:** Dedicated card on the Timecard Dashboard tab, below the main timer card.
- **Style:** `PremiumStatCard`-style with an icon.
- **Main value:** Live balance formatted as `+H:MM:SS` or `-H:MM:SS`.
- **Color:** Green when positive (ahead), red when negative (behind).
- **Subtitle:** Context line, e.g., "10 weekdays x 8h = 80h expected".
- **Ticking:** When clocked in, a `Timer` publisher increments a local `@State` offset by 1 each second. When not clocked in, static value from last fetch.

**Data flow:**
- `TimecardViewModel` gains `loadOvertimeBalance()` method.
- Stores `balanceSeconds`, `isClockedIn`, `clockInTime`, `expectedHours`, `actualHours`, `weekdaysElapsed`.
- Called on dashboard load, on clock-in/out, and on app foreground resume.
- Mac/iPad get this for free — same views via size class branching.

## watchOS — Complication

- **Layout:** Existing work type + elapsed timer on top. New secondary small text line below.
- **Format:** `OT: +2:15:30` or `OT: -3:44:12` with green/red color.
- **Ticking:** When clocked in, uses `Text(referenceDate, style: .timer)` so watchOS handles live updates natively without waking the app.
- **Offline:** Cached in `WatchDataCache` for complication timeline refreshes.

## watchOS — Detail View

- New section below the existing status card in `TimecardDetailView`.
- Same format and color scheme as the complication.
- Ticks live when clocked in using a `Timer`-based approach.

**Data flow:**
- `WatchViewModel` gains `loadOvertimeBalance()` method via `WatchEndpoint.overtimeBalance`.
- Falls back to WatchConnectivity relay from iPhone if direct API fails.
- Cached in `WatchDataCache` for offline access.

## Scope

**In scope:**
- New `GET /api/timecard/overtime-balance` backend endpoint
- iOS overtime balance card on Timecard Dashboard
- watchOS complication secondary line
- watchOS detail view OT display
- `WatchEndpoint` + `WatchDataCache` + `WatchConnectivity` relay

**Out of scope:**
- Web app (React) — no web timecard module exists yet
- LCARS theme — same reason
- Historical overtime (previous months) — current month only
- Notifications/alerts based on OT balance
