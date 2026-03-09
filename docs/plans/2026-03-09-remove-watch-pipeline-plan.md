# Remove Watch Data Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all Watch Data Pipeline code (health, barometer, NFC, spatial, sync) from web app and Apple app.

**Architecture:** Pure deletion + surgical edits to shared files. No new logic. Single atomic commit.

**Tech Stack:** Flask/SQLAlchemy (backend), React (frontend), SwiftUI (Apple app), XcodeGen (project config)

---

### Task 1: Web App Backend — Delete pipeline files

**Files:**
- Delete: `backend/app/models/watch.py`
- Delete: `backend/app/routes/watch.py`
- Delete: `backend/migrations/versions/add_watch_tables.py`

### Task 2: Web App Backend — Strip references from __init__.py

**Files:**
- Modify: `backend/app/__init__.py`

**Changes:**
- Remove lines 86-87: `from app.routes.watch import watch_bp` + `app.register_blueprint(watch_bp, url_prefix='/api/watch')`
- Remove `watch` from the model import on line 100

### Task 3: Web App Frontend — Delete all watch files

**Files:**
- Delete: `frontend/src/api/watchApi.js`
- Delete: `frontend/src/pages/WatchOverview.jsx`
- Delete: `frontend/src/pages/WatchHealth.jsx`
- Delete: `frontend/src/pages/WatchHealthDetail.jsx`
- Delete: `frontend/src/pages/WatchNFC.jsx`
- Delete: `frontend/src/pages/WatchBarometer.jsx`
- Delete: `frontend/src/pages/WatchSpatial.jsx`
- Delete: `frontend/src/pages/WatchSync.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchOverview.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchHealth.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchHealthDetail.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchNFC.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchBarometer.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchSpatial.jsx`
- Delete: `frontend/src/themes/lcars/LCARSWatchSync.jsx`
- Delete: `frontend/src/components/watch/` (entire directory)

### Task 4: Web App Frontend — Strip App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Changes:**
- Remove `Watch` from lucide-react imports (line 9)
- Remove 7 Catppuccin Watch imports (lines 23-29)
- Remove 7 LCARS Watch imports (lines 79-85)
- Remove 7 LCARS Watch routes (lines 176-182)
- Remove sidebar Watch link (line 265)
- Remove drawer Watch link (line 363)
- Remove 7 Catppuccin Watch routes (lines 412-418)

### Task 5: Apple App — Delete pipeline-only files

**Files:**
- Delete: `Datacore/HealthKit/HealthKitManager.swift`
- Delete: `Datacore/Sync/SyncEngine.swift`
- Delete: `Datacore/Sync/PhoneSessionManager.swift`
- Delete: `Datacore/ViewModels/WatchPipelineViewModel.swift`
- Delete: `Datacore/Views/Health/` (entire directory)
- Delete: `Datacore/Views/Watch/` (entire directory)
- Delete: `Datacore/Views/Sync/` (entire directory)
- Delete: `Datacore/Intents/NFCTriggerIntent.swift`
- Delete: `Datacore/Intents/SyncNowIntent.swift`
- Delete: `DatacoreShared/Networking/DatacoreAPIClient.swift`
- Delete: `DatacoreShared/Models/HealthSample.swift`
- Delete: `DatacoreShared/Models/BarometerReading.swift`
- Delete: `DatacoreShared/Models/NFCEvent.swift`
- Delete: `DatacoreShared/Models/SpatialReading.swift`
- Delete: `DatacoreShared/Models/SyncPayload.swift`
- Delete: `DatacoreShared/Models/WatchAPIResponses.swift`
- Delete: `DatacoreShared/ViewComponents/MetricCardView.swift`
- Delete: `DatacoreShared/ViewComponents/SparklineView.swift`
- Delete: `DatacoreShared/ViewComponents/SyncStatusBadge.swift`
- Delete: `DatacoreShared/ViewComponents/TimeRangePickerView.swift`
- Delete: `DatacoreShared/Storage/LocalQueue.swift`
- Delete: `DatacoreWatch/Sensors/AltimeterCollector.swift`
- Delete: `DatacoreWatch/Spatial/NearbyInteractionManager.swift`
- Delete: `DatacoreWatch/NFC/NFCHandler.swift`
- Delete: `DatacoreWatch/Views/WatchHealthSummaryView.swift`

### Task 6: Apple App — Edit shared files

**Files:**
- Modify: `Datacore/Network/Endpoint.swift` — remove watch pipeline endpoint cases + paths + query items
- Modify: `Datacore/Datacore.entitlements` — remove HealthKit entitlements
- Modify: `Datacore/DatacoreApp.swift` — remove watchPipelineVM state, env injection, HealthKit auth block
- Modify: `DatacoreShared/Constants.swift` — remove pipeline-specific constants (keep OBD)
- Modify: `DatacoreWatch/DatacoreWatchApp.swift` — remove nfcHandler + altimeter state/env injection
- Modify: `Datacore/Sync/BackgroundTaskManager.swift` — remove health/full sync, keep OBD only
- Modify: `Datacore/Info.plist` — remove healthsync + fullsync BGTask identifiers
- Modify: `project.yml` — remove HealthKit framework, update file refs

### Task 7: Apple App — Regenerate and build

**Commands:**
```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

### Task 8: Documentation — Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — remove Watch Data Pipeline section, clean up references

### Task 9: Commit and push

Single atomic commit with all changes across both repos.
