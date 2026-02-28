# Datacore watchOS App — Design Document

**Date:** 2026-02-28
**Status:** Approved

## Overview

A watchOS companion app for Datacore providing both quick-glance dashboard views and interactive actions for four modules: Vehicles, Fuel, Launches, and Work Hours. Uses hybrid networking (direct API + WatchConnectivity fallback) with complications as a first-class feature.

## Modules

### 1. Vehicles

**Detail View:**
- Primary vehicle displayed (picker if multiple)
- Maintenance alerts list — each service interval with status indicator (green/yellow/red/overdue), miles remaining, days remaining
- Quick stats: current mileage, last maintenance date, last fuel-up

**Action:** "Mark Service Done" button on any interval — confirmation sheet, then `PUT /api/vehicles/intervals/<id>` to update last service date/mileage.

### 2. Fuel

**Detail View:**
- Stats header: average MPG (last 5), total spent (30d), cost per gallon average
- Recent fuel logs: last 3-5 entries showing date, gallons, MPG, cost

**Action:** "Log Fuel" compact form with:
- Gallons (decimal pad)
- Total cost (decimal pad)
- Odometer reading (number pad)
- Vehicle picker (if multiple)
- Submit via `POST /api/vehicles/<id>/fuel-logs`

### 3. Launches

**Detail View:**
- Next launch card: mission name, rocket, launch provider, pad location, live countdown timer (`TimelineView`)
- Upcoming list: next 3-5 launches with name + date

**Actions:** Read-only. No interactions needed.

### 4. Work Hours

**Detail View:**
- Current month hours (prominent display)
- Monthly breakdown: last 3 months as compact list
- YTD total

**Action:** "Log Hours" form — hours field (decimal pad) for current month. Hits `PUT /api/work-hours/<year>/<month>`.

## Navigation

Root view is a **Command Hub** — a single scrollable `NavigationStack` list with 4 rows:

1. **Vehicle Status** — primary vehicle name + maintenance alert badge (status dot). Taps into vehicle detail.
2. **Fuel** — last MPG + average MPG. Taps into fuel detail.
3. **Next Launch** — mission name + countdown timer. Taps into launch detail.
4. **Work Hours** — current month hours + YTD total. Taps into work hours detail.

Fits on one screen. Each row shows summary data inline and drills into detail on tap.

## Complications

Four complications, each supporting multiple watch face families:

### Vehicle Health
- **Graphic Circular:** Gauge ring showing worst maintenance interval % remaining. Green/yellow/red fill. Center text: miles remaining or "DUE".
- **Graphic Corner:** Small vehicle icon + status dot.
- **Modular Small:** Vehicle name abbreviation + status dot.
- **Modular Large:** Vehicle name on top. Top 2-3 most urgent intervals with service name, status dot, miles/days remaining. Sparkline of maintenance cost trend over last 6 months.

### Fuel Economy
- **Graphic Circular:** Last fill-up MPG as large number, average MPG as subtext.
- **Graphic Corner:** Gas pump icon + last MPG value.
- **Modular Small:** MPG number + trend arrow (up/down vs average).
- **Modular Large:** Vehicle name on top. Last MPG (large) + average MPG + 30-day fuel spend. Sparkline of recent MPG entries (last 10-15 fill-ups) via Swift Charts.

### Next Launch Countdown
- **Graphic Rectangular:** Mission name + live countdown timer.
- **Graphic Circular:** Countdown timer only (T-minus format).
- **Modular Large:** Mission name + rocket + countdown.

### Work Hours
- **Graphic Circular:** Gauge ring showing current month hours as progress toward target. Center: hours logged.
- **Graphic Corner:** Clock icon + hours number.
- **Modular Small:** Hours number + "MTD" label.

**Timeline refresh:** `BGAppRefreshTask` every 30 minutes. Launch countdown uses `TimelineEntry` with future dates for native ClockKit animation.

## Networking Architecture

### Primary — Direct API

`WatchAPIClient` actor (async/await, same pattern as iOS `APIClient`). 10-second timeout. Endpoints used:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dashboard/fleet-status` | Vehicle alerts, fuel stats, cost analysis |
| GET | `/api/fuel/stats?vehicle_id=X` | MPG data for complications |
| GET | `/api/vehicles/` | Vehicle list |
| POST | `/api/vehicles/<id>/fuel-logs` | Log fuel |
| PUT | `/api/vehicles/intervals/<id>` | Mark service done |
| GET | `/api/astrometrics/launches/next` | Next launch |
| GET | `/api/astrometrics/launches/upcoming` | Upcoming launches |
| GET | `/api/work-hours/<year>` | Monthly hours |
| PUT | `/api/work-hours/<year>/<month>` | Log hours |

### Fallback — WatchConnectivity

When direct API fails, watch sends `WCSession` message to iPhone app. iPhone proxies the request through its existing `APIClient` and relays the response. Simple message protocol:

- Watch sends: `["request": "fleet-status"]`
- iPhone fetches, sends back JSON
- Watch decodes same model types

### Config Sync

Server address synced from iPhone to Watch via `WCSession.transferUserInfo()` when user changes it in iOS settings. No server URL configuration on the watch.

### Data Caching

`WatchDataCache` stores last successful response per data type in UserDefaults. Ensures:
- Complications always have data to display
- App opens instantly with cached data, refreshes in background
- Staleness indicator ("last updated X min ago") on cached data

### Background Refresh

`BGAppRefreshTask` scheduled every 30 minutes:
1. Try direct API for all data
2. If fails, try WatchConnectivity relay
3. Update complication timeline entries
4. Re-schedule next refresh

## Project Structure

```
Datacore-Apple/
├── DatacoreWatch/
│   ├── DatacoreWatchApp.swift           # @main entry point
│   ├── ContentView.swift                # Root command hub list
│   ├── Views/
│   │   ├── VehicleDetailView.swift      # Maintenance alerts + mark done
│   │   ├── FuelDetailView.swift         # Stats + recent logs
│   │   ├── FuelLogFormView.swift        # Quick fuel entry form
│   │   ├── LaunchDetailView.swift       # Next launch + upcoming
│   │   ├── WorkHoursDetailView.swift    # Monthly breakdown + log hours
│   │   └── WorkHoursFormView.swift      # Quick hours entry form
│   ├── ViewModels/
│   │   └── WatchViewModel.swift         # Single ViewModel for all watch data
│   ├── Network/
│   │   ├── WatchAPIClient.swift         # Slimmed API client (9 endpoints)
│   │   └── WatchConnectivityManager.swift  # WC fallback + config sync
│   ├── Cache/
│   │   └── WatchDataCache.swift         # UserDefaults-based response cache
│   └── Complications/
│       ├── VehicleHealthComplication.swift
│       ├── FuelEconomyComplication.swift
│       ├── LaunchCountdownComplication.swift
│       └── WorkHoursComplication.swift
├── DatacoreWatch.entitlements           # App Groups for shared data
```

## Shared Code (via target membership)

Models reused from `Datacore/Models/`:
- `Vehicle.swift`, `MaintenanceLog.swift`, `FuelLog.swift`, `MaintenanceInterval.swift`
- `FuelStats.swift`
- `AstroLaunch.swift`
- `FleetStatus.swift` (and nested types)
- Work hours model types

Same pattern as existing widgets target sharing.

## iPhone-Side Changes

**One new file:** `WatchConnectivityManager.swift` in the main iOS target.
- Activates `WCSession` on app launch
- Implements `WCSessionDelegate`
- Handles watch data requests, proxies through existing `APIClient`
- Pushes server config to watch via `transferUserInfo()`

**Two one-liner integrations:**
1. `DatacoreApp.swift`: `WatchConnectivityManager.shared.activate()` on launch
2. `SettingsViewModel`: `WatchConnectivityManager.shared.syncServerConfig()` after address save

## Target Configuration

- Platform: watchOS
- Deployment target: watchOS 12.0
- Swift version: 6
- Bundle ID: `com.chaseburrell.Datacore.watchkitapp`
- App Group: shared with widgets for `SharedDefaults` access
- Added to `project.yml`, built via `xcodegen generate`

## Build Sequence

Phase 1: Direct API path — WatchAPIClient, WatchViewModel, all views, cache
Phase 2: Complications — all 4 TimelineProviders with background refresh
Phase 3: WatchConnectivity — fallback networking + config sync + iPhone-side delegate
