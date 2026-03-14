# OBD2 Module Decommission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely remove all OBD2/Bluetooth BLE code from the Flask backend and Apple app (iOS/Mac).

**Architecture:** Delete 16 OBD-specific files (~7,000 lines), then edit ~14 integration touchpoints to remove OBD references. The 3 PostgreSQL tables are left orphaned by design. No web frontend changes needed.

**Tech Stack:** Python/Flask (backend), Swift/SwiftUI (Apple app), xcodegen (project generation)

---

### Task 1: Delete Backend OBD Files

**Files:**
- Delete: `backend/app/models/obd.py`
- Delete: `backend/app/routes/obd.py`

**Step 1: Delete the OBD model file**

```bash
rm backend/app/models/obd.py
```

**Step 2: Delete the OBD routes file**

```bash
rm backend/app/routes/obd.py
```

**Step 3: Commit**

```bash
git add -u backend/app/models/obd.py backend/app/routes/obd.py
git commit -m "chore: delete OBD backend model and routes files"
```

---

### Task 2: Remove OBD References from Flask App Factory

**Files:**
- Modify: `backend/app/__init__.py`

**Step 1: Remove the OBD blueprint registration (lines 94-95)**

Remove these two lines:
```python
    from app.routes.obd import obd_bp
    app.register_blueprint(obd_bp, url_prefix='/api/obd')
```

**Step 2: Remove `obd` from the model import (line 114)**

Change this line:
```python
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, obd, debt, timecard, gps_tracking  # noqa: F401
```
To:
```python
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, debt, timecard, gps_tracking  # noqa: F401
```

**Step 3: Remove OBD snapshot migration lines (lines 655-656)**

Remove these two lines from the `migrations` list in `_run_safe_migrations()`:
```python
        # OBD snapshot new sensor columns
        """ALTER TABLE obd_snapshots ADD COLUMN IF NOT EXISTS battery_voltage_v DOUBLE PRECISION""",
        """ALTER TABLE obd_snapshots ADD COLUMN IF NOT EXISTS odometer_km DOUBLE PRECISION""",
```

**Step 4: Commit**

```bash
git add backend/app/__init__.py
git commit -m "chore: remove OBD blueprint, model import, and migrations from app factory"
```

---

### Task 3: Delete Apple App OBD Files (Services, Views, ViewModel, Model)

**Files:**
- Delete: `Datacore/Services/OBD/` (entire directory — 5 files)
- Delete: `Datacore/Views/OBD/` (entire directory — 8 files)
- Delete: `Datacore/ViewModels/OBDViewModel.swift`
- Delete: `Datacore/Models/OBD.swift`

All paths relative to `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/`.

**Step 1: Delete OBD services directory**

```bash
rm -rf /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Services/OBD
```

**Step 2: Delete OBD views directory**

```bash
rm -rf /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/OBD
```

**Step 3: Delete OBD ViewModel**

```bash
rm /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/ViewModels/OBDViewModel.swift
```

**Step 4: Delete OBD model**

```bash
rm /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Models/OBD.swift
```

**Step 5: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -u Datacore/Services/OBD Datacore/Views/OBD Datacore/ViewModels/OBDViewModel.swift Datacore/Models/OBD.swift
git commit -m "chore: delete all OBD Swift files (services, views, ViewModel, model)"
```

---

### Task 4: Remove OBD from AppModule Enum

**Files:**
- Modify: `Datacore/Models/AppModule.swift`

**Step 1: Remove `.obd` from the case list (line 6)**

Change:
```swift
    case dashboard, vehicles, notes, fuel, weather
    case projects, knowledge, infrastructure, astrometrics, trek
    case timecard, obd, debts, gpsTracking, settings
```
To:
```swift
    case dashboard, vehicles, notes, fuel, weather
    case projects, knowledge, infrastructure, astrometrics, trek
    case timecard, debts, gpsTracking, settings
```

**Step 2: Remove the `.obd` title case (line 22)**

Remove:
```swift
        case .obd: "OBD2 Link"
```

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/AppModule.swift
git commit -m "chore: remove .obd case from AppModule enum"
```

---

### Task 5: Remove OBD from Navigation (ContentView, Sidebars, ModuleLauncher)

**Files:**
- Modify: `Datacore/ContentView.swift`
- Modify: `Datacore/MacApp/MacSidebar.swift`
- Modify: `Datacore/Views/Shared/iPadSidebar.swift`
- Modify: `Datacore/Views/Shared/ModuleLauncherSheet.swift`

**Step 1: ContentView.swift — Remove `.obd` from both switch statements**

In `selectedModuleView` (~line 158-159), remove:
```swift
        case .obd:
            OBDDashboardView()
```

In `ModuleLauncherTab.selectedModuleView` (~line 223-224), remove:
```swift
        case .obd:
            OBDDashboardView()
```

In the `#Preview` block (~line 275), remove:
```swift
        .environment(OBDViewModel())
```

**Step 2: MacSidebar.swift — Remove OBD sidebar row (line 22)**

Remove:
```swift
                sidebarRow(.obd, icon: "car.badge.gearshape", label: "OBD2 Link")
```

**Step 3: iPadSidebar.swift — Remove OBD sidebar row (line 29)**

Remove:
```swift
                sidebarRow(.obd, icon: "car.badge.gearshape", label: "OBD2 Link")
```

**Step 4: ModuleLauncherSheet.swift — Remove OBD card and fix stagger indices**

Remove the OBD card (lines 50-51):
```swift
                    moduleCard(.obd, icon: "car.badge.gearshape", tint: .orange)
                        .staggerReveal(index: 6, isVisible: cardsVisible)
```

Then renumber the stagger indices for all cards after the removed one:
- `.gpsTracking` → index 6 (was 7)
- `.astrometrics` → index 7 (was 8)
- `.trek` → index 8 (was 9)
- `.infrastructure` → index 9 (was 10)
- `.settings` → index 10 (was 11)

**Step 5: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/ContentView.swift Datacore/MacApp/MacSidebar.swift Datacore/Views/Shared/iPadSidebar.swift Datacore/Views/Shared/ModuleLauncherSheet.swift
git commit -m "chore: remove OBD from all navigation surfaces"
```

---

### Task 6: Remove OBD from App Entry Points and Environment Injection

**Files:**
- Modify: `Datacore/DatacoreApp.swift`
- Modify: `Datacore/MacApp/MacDatacoreApp.swift`
- Modify: `Datacore/Views/Shared/EnvironmentInjector.swift`

**Step 1: DatacoreApp.swift — Remove obdVM**

Remove the state variable (line 67):
```swift
    @State private var obdVM = OBDViewModel()
```

Remove the environment injection (line 91):
```swift
                .environment(obdVM)
```

Remove the setup call (line 102):
```swift
                    obdVM.setup()
```

**Step 2: MacDatacoreApp.swift — Remove obdVM**

Remove the state variable (line 48):
```swift
    @State private var obdVM = OBDViewModel()
```

Remove `obd: obdVM` from every `.injectAllEnvironments(...)` call. There are 6 occurrences (lines 66, 100, 117, 135, 152, 169). In each one, remove the `obd: obdVM,` parameter.

**Step 3: EnvironmentInjector.swift — Remove obdVM from struct, body, and extension**

Remove from the struct properties (line 22):
```swift
    let obdVM: OBDViewModel
```

Remove from the body (line 45):
```swift
            .environment(obdVM)
```

Remove from the function signature (line 72):
```swift
        obd: OBDViewModel,
```

Remove from the modifier instantiation (line 94):
```swift
            obdVM: obd,
```

**Step 4: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/DatacoreApp.swift Datacore/MacApp/MacDatacoreApp.swift Datacore/Views/Shared/EnvironmentInjector.swift
git commit -m "chore: remove OBDViewModel from app entry points and environment injection"
```

---

### Task 7: Remove OBD from Network, Sync, and Notifications

**Files:**
- Modify: `Datacore/Network/Endpoint.swift`
- Modify: `Datacore/Sync/OfflineSyncManager.swift`
- Modify: `Datacore/Sync/BackgroundTaskManager.swift`
- Modify: `Datacore/Views/Shared/DatacoreNotifications.swift`
- Modify: `DatacoreShared/Constants.swift`

**Step 1: Endpoint.swift — Remove 9 OBD endpoint cases**

Remove the enum cases (lines 223-232):
```swift
    // MARK: - OBD2 Diagnostics
    case obdSnapshotsBatch
    case obdSnapshots(vehicleId: Int)
    case obdCreateDTC
    case obdDTCs(vehicleId: Int)
    case obdClearDTC(dtcId: Int)
    case obdCreateTrip
    case obdTrips(vehicleId: Int)
    case obdUpdateOdometer(vehicleId: Int)
    case obdTrend(vehicleId: Int)
```

Remove the path mappings (lines 474-483):
```swift
        // OBD2 Diagnostics
        case .obdSnapshotsBatch:                        return "/api/obd/snapshots/batch"
        case .obdSnapshots(let vid):                    return "/api/obd/vehicles/\(vid)/snapshots"
        case .obdCreateDTC:                             return "/api/obd/dtcs"
        case .obdDTCs(let vid):                         return "/api/obd/vehicles/\(vid)/dtcs"
        case .obdClearDTC(let dtcId):                   return "/api/obd/dtcs/\(dtcId)"
        case .obdCreateTrip:                            return "/api/obd/trips"
        case .obdTrips(let vid):                        return "/api/obd/vehicles/\(vid)/trips"
        case .obdUpdateOdometer(let vid):               return "/api/obd/vehicles/\(vid)/odometer"
        case .obdTrend(let vid):                        return "/api/obd/vehicles/\(vid)/snapshots/trend"
```

Remove the queryItems case (lines 533-535):
```swift
        // OBD endpoints use query params passed via extraQueryItems in APIClient
        case .obdSnapshotsBatch, .obdSnapshots, .obdCreateDTC, .obdDTCs,
             .obdClearDTC, .obdCreateTrip, .obdTrips, .obdUpdateOdometer, .obdTrend:
            return nil
```

**Step 2: OfflineSyncManager.swift — Remove OBD operation types and replay cases**

Remove from OperationType (lines 29-30):
```swift
        static let obdSnapshotBatch = "obd_snapshot_batch"
        static let obdOdometerUpdate = "obd_odometer_update"
```

Remove from the `all` set (lines 40-41):
```swift
            obdSnapshotBatch,
            obdOdometerUpdate,
```

Remove the two replay cases in `replayItem()` (lines 261-269):
```swift
        case OperationType.obdSnapshotBatch:
            let _ = try await APIClient.shared.postRaw(.obdSnapshotsBatch, jsonBody: data)

        case OperationType.obdOdometerUpdate:
            let payload = try decoder.decode(OBDOdometerPayload.self, from: data)
            let _: OBDOdometerResult = try await APIClient.shared.post(
                .obdUpdateOdometer(vehicleId: payload.vehicleId), body: payload
            )
```

Remove from `descriptionForType()` (lines 293-294):
```swift
        case OperationType.obdSnapshotBatch: return "OBD Snapshot Batch"
        case OperationType.obdOdometerUpdate: return "OBD Odometer Update"
```

**Step 3: BackgroundTaskManager.swift — Gut OBD-only content**

The entire `BackgroundTaskManager` class exists only for OBD sync. Replace the file contents with a minimal stub that keeps the class but removes all OBD logic:

```swift
#if os(iOS)
import BackgroundTasks
import Foundation

/// Registers and schedules iOS background tasks for periodic data sync.
/// Currently empty — OBD module was decommissioned.
final class BackgroundTaskManager: Sendable {
    static let shared = BackgroundTaskManager()
    private init() {}

    /// Register all background task handlers with the system.
    func registerTasks() {
        // No background tasks currently registered
    }
}
#endif
```

**Step 4: DatacoreNotifications.swift — Remove 2 OBD notification names (lines 22-23)**

Remove:
```swift
    static let datacoreOBDConnect = Notification.Name("datacoreOBDConnect")
    static let datacoreOBDDisconnect = Notification.Name("datacoreOBDDisconnect")
```

**Step 5: Constants.swift — Remove all OBD constants**

Replace `DatacoreShared/Constants.swift` with:

```swift
import Foundation

/// Centralized constants for the Datacore sync pipeline.
/// Used by iOS, watchOS, and shared targets.
enum DatacoreConstants {
    // Currently empty — OBD constants were removed during decommission.
    // Add new background task IDs and sync constants here as needed.
}
```

**Step 6: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Network/Endpoint.swift Datacore/Sync/OfflineSyncManager.swift Datacore/Sync/BackgroundTaskManager.swift Datacore/Views/Shared/DatacoreNotifications.swift DatacoreShared/Constants.swift
git commit -m "chore: remove OBD from endpoints, offline sync, background tasks, and constants"
```

---

### Task 8: Remove OBD from project.yml (Capabilities)

**Files:**
- Modify: `project.yml`

**Step 1: Remove Bluetooth usage description (line 111)**

Remove:
```yaml
        INFOPLIST_KEY_NSBluetoothAlwaysUsageDescription: 'Datacore connects to your OBD adapter to read vehicle diagnostics and sensor data.'
```

**Step 2: Remove `bluetooth-central` from UIBackgroundModes (line 112)**

Change:
```yaml
        INFOPLIST_KEY_UIBackgroundModes: 'bluetooth-central processing fetch remote-notification'
```
To:
```yaml
        INFOPLIST_KEY_UIBackgroundModes: 'processing fetch remote-notification'
```

**Step 3: Remove `bluetooth-central` from the UIBackgroundModes array (lines 118-119)**

Change:
```yaml
        UIBackgroundModes:
          - bluetooth-central
          - processing
          - fetch
          - remote-notification
```
To:
```yaml
        UIBackgroundModes:
          - processing
          - fetch
          - remote-notification
```

**Step 4: Remove OBD BGTask identifier (line 124)**

Change:
```yaml
        BGTaskSchedulerPermittedIdentifiers:
          - com.chaseburrell.datacore.obdsync
```
To:
```yaml
        BGTaskSchedulerPermittedIdentifiers: []
```

Or remove the entire `BGTaskSchedulerPermittedIdentifiers` key if no other tasks need it. If removing entirely, also consider whether the `processing` background mode is still needed (keep it if future tasks may use it).

**Step 5: Remove `CoreBluetooth.framework` dependency (line 139)**

Remove:
```yaml
      - sdk: CoreBluetooth.framework
```

**Step 6: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add project.yml
git commit -m "chore: remove Bluetooth capability and OBD background task from project.yml"
```

---

### Task 9: Build Verification

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

Expected: zero `error:` lines.

**Step 3: Build macOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

Expected: zero `error:` lines.

**Step 4: Fix any errors**

If either build produces errors, they will likely be:
- Missing type references (some file still imports `OBDViewModel` or `OBDDashboardView`)
- Switch exhaustiveness (a switch on `AppModule` still has a `.obd` case or is missing a default)
- Unused imports

Fix all errors and rebuild until both targets compile cleanly.

**Step 5: Commit fixes (if any)**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -A
git commit -m "fix: resolve build errors from OBD decommission"
```

---

### Task 10: Final Commit and Push

**Step 1: Ask user about version bump**

Before committing, ask whether to increment the version number:
- Currently `MARKETING_VERSION: '2.0'`, `CURRENT_PROJECT_VERSION: 1`
- This is a removal, not a feature — typically just a build number bump

**Step 2: Push both repos**

Push the backend changes:
```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Personal_Database
git push origin main
```

Push the Apple app changes:
```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git push origin main
```
