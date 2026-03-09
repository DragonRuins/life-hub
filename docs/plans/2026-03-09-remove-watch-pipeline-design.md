# Remove Watch Data Pipeline — Design

**Date:** 2026-03-09
**Decision:** Remove the entire Watch Data Pipeline (health, barometer, NFC, spatial, sync status) from all platforms.
**Reason:** No practical use for health/sensor data collection.

## Scope

Remove all code related to the Watch Data Pipeline across web app (Flask + React) and Apple app (iOS/iPad/Mac/watchOS). The core watchOS companion app (vehicles, fuel, launches, work hours, WidgetKit complications) is unaffected.

## What Gets Removed

### Web App Backend
- **Delete:** `backend/app/models/watch.py`, `backend/app/routes/watch.py`, `backend/migrations/versions/add_watch_tables.py`
- **Edit:** `backend/app/__init__.py` — remove watch blueprint + model imports
- **Database:** Leave 7 tables in place (no migration needed)

### Web App Frontend
- **Delete (23 files):**
  - `frontend/src/api/watchApi.js`
  - 7 Catppuccin pages: `WatchOverview`, `WatchHealth`, `WatchHealthDetail`, `WatchNFC`, `WatchBarometer`, `WatchSpatial`, `WatchSync`
  - 7 LCARS pages: `LCARSWatchOverview`, `LCARSWatchHealth`, `LCARSWatchHealthDetail`, `LCARSWatchNFC`, `LCARSWatchBarometer`, `LCARSWatchSpatial`, `LCARSWatchSync`
  - 9 shared components: entire `frontend/src/components/watch/` directory
- **Edit:** `frontend/src/App.jsx` — remove all Watch imports, routes, sidebar links, drawer links

### Apple App — iOS/iPad/Mac
- **Delete:**
  - `Datacore/HealthKit/HealthKitManager.swift`
  - `Datacore/Sync/SyncEngine.swift`, `Datacore/Sync/BackgroundTaskManager.swift`
  - `Datacore/ViewModels/WatchPipelineViewModel.swift`
  - `Datacore/Views/Health/` (5 files), `Datacore/Views/Watch/` (entire dir), `Datacore/Views/Sync/` (2 files)
  - `Datacore/Intents/NFCTriggerIntent.swift`, `Datacore/Intents/SyncNowIntent.swift`
- **Edit (strip pipeline, keep infra):**
  - `PhoneSessionManager.swift` — remove health/barometer/NFC/spatial handlers, keep server config relay
  - `Endpoint.swift` — remove watch pipeline endpoint cases
  - `Datacore.entitlements` — remove HealthKit entitlements
  - `project.yml` — remove HealthKit framework, health background modes, BGTask identifiers, deleted file refs

### Apple App — watchOS
- **Delete:** `DatacoreWatch/Sensors/AltimeterCollector.swift`, `DatacoreWatch/NFC/NFCHandler.swift`, `DatacoreWatch/Views/WatchHealthSummaryView.swift`, pipeline-specific views
- **Edit:** `DatacoreWatchApp.swift` — remove navigation to pipeline views

### Shared Models (DatacoreShared)
- **Delete:** `HealthSample.swift`, `BarometerReading.swift`, `NFCEvent.swift`, `SpatialReading.swift`, `SyncPayload.swift`, `WatchAPIResponses.swift`
- **Delete:** `MetricCardView.swift`, `SparklineView.swift`, `SyncStatusBadge.swift`, `TimeRangePickerView.swift`
- **Edit:** `Constants.swift` — remove pipeline-specific constants only

### Documentation
- **Edit:** `CLAUDE.md` — remove Watch Data Pipeline section, clean up references

## What Stays
- Core watchOS app (vehicles, fuel, launches, work hours)
- WidgetKit complications
- WatchConnectivityManager + PhoneConnectivityManager (shared infra for core modules)
- WatchAPIClient + WatchEndpoint (used by core watchOS modules)
- WatchViewModel + WatchDataCache (core watchOS data layer)
- All 7 database tables (left in place, no DROP migration)

## Approach
Single atomic commit — all deletions + edits in one pass. Pure removal with no new logic. Verify with `xcodebuild` after Apple app changes.
