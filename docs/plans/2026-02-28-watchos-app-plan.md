# Datacore watchOS App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a watchOS companion app for Datacore with four modules (Vehicles, Fuel, Launches, Work Hours), hybrid networking, data caching, and WidgetKit complications.

**Architecture:** Standalone watchOS app target in the existing Datacore-Apple Xcode project. Shares Codable model files with the iOS app via target membership in `project.yml`. Uses a slimmed-down `WatchAPIClient` actor for direct API access, `WatchDataCache` for offline persistence, and `WatchConnectivityManager` for iPhone fallback and config sync. Complications are WidgetKit-based `TimelineProvider` implementations with `BGAppRefreshTask` scheduling.

**Tech Stack:** SwiftUI (watchOS 12), Swift 6, WidgetKit (complications), WatchConnectivity, BackgroundTasks, Swift Charts (sparklines)

**Design Doc:** `docs/plans/2026-02-28-watchos-app-design.md`

**Project Root:** `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/`

---

## Phase 1: Direct API + Views + Cache

### Task 1: Create watchOS target directory structure and project.yml entry

**Files:**
- Create: `DatacoreWatch/DatacoreWatchApp.swift`
- Create: `DatacoreWatch/DatacoreWatch.entitlements`
- Create: `DatacoreWatch/Info.plist`
- Create: `DatacoreWatch/Assets.xcassets/AccentColor.colorset/Contents.json`
- Create: `DatacoreWatch/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Create: `DatacoreWatch/Assets.xcassets/Contents.json`
- Modify: `project.yml`

**Step 1: Create directory structure**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
mkdir -p DatacoreWatch/{Views,ViewModels,Network,Cache,Complications}
mkdir -p DatacoreWatch/Assets.xcassets/{AccentColor.colorset,AppIcon.appiconset}
```

**Step 2: Create the watchOS app entry point**

Create `DatacoreWatch/DatacoreWatchApp.swift`:
```swift
import SwiftUI

@main
struct DatacoreWatchApp: App {
    @State private var viewModel = WatchViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(viewModel)
        }
    }
}
```

**Step 3: Create entitlements file**

Create `DatacoreWatch/DatacoreWatch.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.chaseburrell.datacore</string>
    </array>
</dict>
</plist>
```

**Step 4: Create Info.plist**

Create `DatacoreWatch/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>WKCompanionAppBundleIdentifier</key>
    <string>com.chaseburrell.Datacore</string>
    <key>NSLocalNetworkUsageDescription</key>
    <string>Datacore connects to your self-hosted server on your local network.</string>
    <key>NSBonjourServices</key>
    <array>
        <string>_http._tcp</string>
    </array>
</dict>
</plist>
```

**Step 5: Create asset catalog stubs**

Create `DatacoreWatch/Assets.xcassets/Contents.json`:
```json
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

Create `DatacoreWatch/Assets.xcassets/AccentColor.colorset/Contents.json`:
```json
{
  "colors" : [
    {
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0.976",
          "green" : "0.827",
          "red" : "0.533"
        }
      },
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

Create `DatacoreWatch/Assets.xcassets/AppIcon.appiconset/Contents.json`:
```json
{
  "images" : [
    {
      "idiom" : "watch",
      "role" : "notificationCenter",
      "scale" : "2x",
      "size" : "24x24",
      "subtype" : "38mm"
    },
    {
      "idiom" : "watch",
      "role" : "notificationCenter",
      "scale" : "2x",
      "size" : "27.5x27.5",
      "subtype" : "42mm"
    },
    {
      "idiom" : "watch",
      "role" : "companionSettings",
      "scale" : "2x",
      "size" : "29x29"
    },
    {
      "idiom" : "watch",
      "role" : "companionSettings",
      "scale" : "3x",
      "size" : "29x29"
    },
    {
      "idiom" : "watch",
      "role" : "appLauncher",
      "scale" : "2x",
      "size" : "40x40",
      "subtype" : "38mm"
    },
    {
      "idiom" : "watch",
      "role" : "appLauncher",
      "scale" : "2x",
      "size" : "44x44",
      "subtype" : "40mm"
    },
    {
      "idiom" : "watch",
      "role" : "appLauncher",
      "scale" : "2x",
      "size" : "50x50",
      "subtype" : "44mm"
    },
    {
      "idiom" : "watch",
      "role" : "quickLook",
      "scale" : "2x",
      "size" : "86x86",
      "subtype" : "38mm"
    },
    {
      "idiom" : "watch",
      "role" : "quickLook",
      "scale" : "2x",
      "size" : "98x98",
      "subtype" : "42mm"
    },
    {
      "idiom" : "watch",
      "role" : "quickLook",
      "scale" : "2x",
      "size" : "108x108",
      "subtype" : "44mm"
    },
    {
      "idiom" : "watch",
      "scale" : "2x",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

**Step 6: Add `DatacoreWatch` target to `project.yml`**

Add the following target to the `targets:` section of `project.yml`. Model it on the existing `DatacoreWidgets` target's shared-file pattern. The watch target shares model files via explicit path includes:

```yaml
  DatacoreWatch:
    type: application
    platform: watchOS
    deploymentTarget: "12.0"
    sources:
      - path: DatacoreWatch
      - path: Datacore/Config/SharedDefaults.swift
      - path: Datacore/Config/SharedAPIClient.swift
      - path: Datacore/Config/WidgetDataModels.swift
      - path: Datacore/Models/Vehicle.swift
      - path: Datacore/Models/DashboardStats.swift
      - path: Datacore/Models/Astrometrics.swift
      - path: Datacore/Models/WorkHours.swift
      - path: Datacore/Models/FuelStats.swift
      - path: Datacore/Models/AnyCodable.swift
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.chaseburrell.Datacore.watchkitapp
        DEVELOPMENT_TEAM: XFD7636PAR
        SWIFT_VERSION: "6"
        MARKETING_VERSION: "1.0"
        CURRENT_PROJECT_VERSION: "1"
        GENERATE_INFOPLIST_FILE: true
        INFOPLIST_FILE: DatacoreWatch/Info.plist
        CODE_SIGN_ENTITLEMENTS: DatacoreWatch/DatacoreWatch.entitlements
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: AccentColor
        INFOPLIST_KEY_WKCompanionAppBundleIdentifier: com.chaseburrell.Datacore
```

Also add the watch app as an embedded dependency to the main `Datacore` iOS target. In the `Datacore` target's `dependencies:` array, add:

```yaml
      - target: DatacoreWatch
```

**Step 7: Run xcodegen to generate the Xcode project**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
```

Expected: "Generated project" with no errors. Open the `.xcodeproj` to verify the `DatacoreWatch` target exists with all shared model files visible.

**Step 8: Commit**

```bash
git add DatacoreWatch/ project.yml
git commit -m "feat(watch): scaffold watchOS target with project.yml entry and shared models"
```

---

### Task 2: Build WatchAPIClient networking layer

**Files:**
- Create: `DatacoreWatch/Network/WatchAPIClient.swift`
- Create: `DatacoreWatch/Network/WatchEndpoint.swift`

**Step 1: Create the WatchEndpoint enum**

Create `DatacoreWatch/Network/WatchEndpoint.swift`. This is a focused subset of the iOS `Endpoint` enum — only the 9 endpoints the watch uses:

```swift
import Foundation

enum WatchEndpoint {
    // Dashboard
    case fleetStatus(vehicleId: Int? = nil)

    // Vehicles
    case vehicles
    case updateInterval(intervalId: Int)

    // Fuel
    case fuelStats(vehicleId: Int?)
    case createFuelLog(vehicleId: Int)

    // Astrometrics
    case launchesNext
    case launchesUpcoming

    // Work Hours
    case workHoursYear(year: Int)
    case workHoursUpdateMonth(year: Int, month: Int)

    var path: String {
        switch self {
        case .fleetStatus:
            return "/api/dashboard/fleet-status"
        case .vehicles:
            return "/api/vehicles/"
        case .updateInterval(let intervalId):
            return "/api/vehicles/intervals/\(intervalId)"
        case .fuelStats:
            return "/api/fuel/stats"
        case .createFuelLog(let vehicleId):
            return "/api/vehicles/\(vehicleId)/fuel-logs"
        case .launchesNext:
            return "/api/astrometrics/launches/next"
        case .launchesUpcoming:
            return "/api/astrometrics/launches/upcoming"
        case .workHoursYear(let year):
            return "/api/work-hours/\(year)"
        case .workHoursUpdateMonth(let year, let month):
            return "/api/work-hours/\(year)/\(month)"
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .fleetStatus(let vehicleId):
            guard let vehicleId else { return nil }
            return [URLQueryItem(name: "vehicle_id", value: "\(vehicleId)")]
        case .fuelStats(let vehicleId):
            guard let vehicleId else { return nil }
            return [URLQueryItem(name: "vehicle_id", value: "\(vehicleId)")]
        default:
            return nil
        }
    }
}
```

**Step 2: Create the WatchAPIClient actor**

Create `DatacoreWatch/Network/WatchAPIClient.swift`. Follows the same actor pattern as iOS `APIClient` but with shorter timeouts:

```swift
import Foundation

actor WatchAPIClient {
    static let shared = WatchAPIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 20
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Public Methods

    func get<T: Decodable & Sendable>(_ endpoint: WatchEndpoint) async throws -> T {
        let request = try buildRequest(endpoint, method: "GET")
        return try await execute(request)
    }

    func post<T: Decodable & Sendable>(_ endpoint: WatchEndpoint, body: some Encodable & Sendable) async throws -> T {
        var request = try buildRequest(endpoint, method: "POST")
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    func put<T: Decodable & Sendable>(_ endpoint: WatchEndpoint, body: some Encodable & Sendable) async throws -> T {
        var request = try buildRequest(endpoint, method: "PUT")
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }

    func put(_ endpoint: WatchEndpoint, body: some Encodable & Sendable) async throws {
        var request = try buildRequest(endpoint, method: "PUT")
        request.httpBody = try encoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw WatchAPIError.httpError
        }
    }

    // MARK: - Private

    private func buildRequest(_ endpoint: WatchEndpoint, method: String) throws -> URLRequest {
        guard let baseURL = SharedDefaults.baseURL else {
            throw WatchAPIError.noServer
        }

        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint.path), resolvingAgainstBaseURL: false)
        components?.queryItems = endpoint.queryItems

        guard let url = components?.url else {
            throw WatchAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        return request
    }

    private func execute<T: Decodable & Sendable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw WatchAPIError.httpError
        }

        return try decoder.decode(T.self, from: data)
    }
}

enum WatchAPIError: Error, LocalizedError {
    case noServer
    case invalidURL
    case httpError
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .noServer:
            return "No server configured. Set up server in iPhone app."
        case .invalidURL:
            return "Invalid server URL."
        case .httpError:
            return "Server request failed."
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        }
    }
}
```

**Step 3: Verify it compiles**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
xcodebuild -project Datacore.xcodeproj -scheme DatacoreWatch -destination 'platform=watchOS Simulator,name=Apple Watch Ultra 2 (49mm)' build 2>&1 | tail -5
```

Expected: Build succeeds (may have warnings but no errors). Note: this will fail until Task 3 creates the placeholder `ContentView` and `WatchViewModel` — that's expected. Move on.

**Step 4: Commit**

```bash
git add DatacoreWatch/Network/
git commit -m "feat(watch): add WatchAPIClient actor and WatchEndpoint enum"
```

---

### Task 3: Build WatchDataCache

**Files:**
- Create: `DatacoreWatch/Cache/WatchDataCache.swift`

**Step 1: Create the cache**

Create `DatacoreWatch/Cache/WatchDataCache.swift`. Uses the App Group shared container so complication extensions can also read cached data:

```swift
import Foundation

enum WatchDataCache {
    private static let defaults = UserDefaults(suiteName: "group.com.chaseburrell.datacore") ?? .standard

    // MARK: - Cache Keys

    private enum Key: String {
        case fleetStatus = "watch_fleet_status"
        case fuelStats = "watch_fuel_stats"
        case vehicles = "watch_vehicles"
        case nextLaunch = "watch_next_launch"
        case upcomingLaunches = "watch_upcoming_launches"
        case workHours = "watch_work_hours"
        case lastUpdated = "watch_last_updated"
    }

    // MARK: - Last Updated

    static var lastUpdated: Date? {
        get { defaults.object(forKey: Key.lastUpdated.rawValue) as? Date }
        set { defaults.set(newValue, forKey: Key.lastUpdated.rawValue) }
    }

    /// Human-readable staleness string, e.g. "2 min ago" or "1 hr ago"
    static var lastUpdatedString: String? {
        guard let date = lastUpdated else { return nil }
        let seconds = Int(-date.timeIntervalSinceNow)
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(seconds / 60) min ago" }
        if seconds < 86400 { return "\(seconds / 3600) hr ago" }
        return "\(seconds / 86400)d ago"
    }

    // MARK: - Typed Accessors

    static var fleetStatus: FleetStatus? {
        get { decode(Key.fleetStatus) }
        set { encode(newValue, key: Key.fleetStatus) }
    }

    static var fuelStats: FuelStats? {
        get { decode(Key.fuelStats) }
        set { encode(newValue, key: Key.fuelStats) }
    }

    static var vehicles: [Vehicle]? {
        get { decode(Key.vehicles) }
        set { encode(newValue, key: Key.vehicles) }
    }

    static var nextLaunch: AstroNextLaunchResponse? {
        get { decode(Key.nextLaunch) }
        set { encode(newValue, key: Key.nextLaunch) }
    }

    static var upcomingLaunches: AstroLaunchListResponse? {
        get { decode(Key.upcomingLaunches) }
        set { encode(newValue, key: Key.upcomingLaunches) }
    }

    static var workHours: WorkHoursSummary? {
        get { decode(Key.workHours) }
        set { encode(newValue, key: Key.workHours) }
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

    private static func encode<T: Encodable>(_ value: T?, key: Key) {
        guard let value else {
            defaults.removeObject(forKey: key.rawValue)
            return
        }
        defaults.set(try? encoder.encode(value), forKey: key.rawValue)
    }

    private static func decode<T: Decodable>(_ key: Key) -> T? {
        guard let data = defaults.data(forKey: key.rawValue) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Cache/
git commit -m "feat(watch): add WatchDataCache with App Group UserDefaults persistence"
```

---

### Task 4: Build WatchViewModel

**Files:**
- Create: `DatacoreWatch/ViewModels/WatchViewModel.swift`

**Step 1: Create the ViewModel**

Create `DatacoreWatch/ViewModels/WatchViewModel.swift`. Single ViewModel managing all four data domains:

```swift
import Foundation
import SwiftUI

@Observable
@MainActor
final class WatchViewModel {
    // MARK: - Data

    var fleetStatus: FleetStatus?
    var fuelStats: FuelStats?
    var vehicles: [Vehicle] = []
    var nextLaunch: AstroNextLaunchResponse?
    var upcomingLaunches: [AstroLaunch] = []
    var workHours: WorkHoursSummary?

    // MARK: - State

    var isLoading = false
    var error: String?

    // MARK: - Computed

    var primaryVehicle: VehicleSummary? {
        fleetStatus?.vehicleSummaries.first
    }

    var urgentAlerts: [IntervalAlert] {
        guard let fleet = fleetStatus else { return [] }
        return fleet.intervalAlerts
            .sorted { alertPriority($0.status) < alertPriority($1.status) }
    }

    var currentMonthHours: Double? {
        let month = Calendar.current.component(.month, from: Date())
        return workHours?.months.first(where: { $0.month == month })?.hoursWorked
    }

    var ytdHours: Double? {
        workHours?.totalHours
    }

    var lastUpdatedString: String? {
        WatchDataCache.lastUpdatedString
    }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        error = nil

        // Load from cache first for instant display
        loadFromCache()

        // Then fetch fresh data
        await refreshFromAPI()

        isLoading = false
    }

    func refreshFromAPI() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadFleetStatus() }
            group.addTask { await self.loadFuelStats() }
            group.addTask { await self.loadVehicles() }
            group.addTask { await self.loadNextLaunch() }
            group.addTask { await self.loadUpcomingLaunches() }
            group.addTask { await self.loadWorkHours() }
        }

        WatchDataCache.lastUpdated = Date()
    }

    // MARK: - Actions

    func logFuel(vehicleId: Int, gallons: Double, totalCost: Double, odometer: Int) async -> Bool {
        struct FuelBody: Encodable, Sendable {
            let gallonsAdded: Double
            let totalCost: Double
            let odometerReading: Int
            let date: String
        }

        let body = FuelBody(
            gallonsAdded: gallons,
            totalCost: totalCost,
            odometerReading: odometer,
            date: ISO8601DateFormatter().string(from: Date())
        )

        do {
            let _: FuelLog = try await WatchAPIClient.shared.post(.createFuelLog(vehicleId: vehicleId), body: body)
            // Refresh fuel stats after logging
            await loadFuelStats()
            await loadFleetStatus()
            return true
        } catch {
            self.error = "Failed to log fuel"
            return false
        }
    }

    func markServiceDone(intervalId: Int) async -> Bool {
        struct IntervalUpdate: Encodable, Sendable {
            let lastServiceDate: String
            let lastServiceMileage: Int?
        }

        let mileage = primaryVehicle?.currentMileage
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        let body = IntervalUpdate(
            lastServiceDate: formatter.string(from: Date()),
            lastServiceMileage: mileage
        )

        do {
            let _: MaintenanceInterval = try await WatchAPIClient.shared.put(.updateInterval(intervalId: intervalId), body: body)
            await loadFleetStatus()
            return true
        } catch {
            self.error = "Failed to update service"
            return false
        }
    }

    func logWorkHours(hours: Double) async -> Bool {
        struct HoursBody: Encodable, Sendable {
            let hoursWorked: Double
        }

        let year = Calendar.current.component(.year, from: Date())
        let month = Calendar.current.component(.month, from: Date())

        do {
            try await WatchAPIClient.shared.put(
                .workHoursUpdateMonth(year: year, month: month),
                body: HoursBody(hoursWorked: hours)
            )
            await loadWorkHours()
            return true
        } catch {
            self.error = "Failed to log hours"
            return false
        }
    }

    // MARK: - Private Loaders

    private func loadFleetStatus() async {
        do {
            let status: FleetStatus = try await WatchAPIClient.shared.get(.fleetStatus())
            fleetStatus = status
            WatchDataCache.fleetStatus = status
        } catch {
            // Keep cached data, don't overwrite
        }
    }

    private func loadFuelStats() async {
        let vehicleId = primaryVehicle?.id ?? vehicles.first?.id
        do {
            let stats: FuelStats = try await WatchAPIClient.shared.get(.fuelStats(vehicleId: vehicleId))
            fuelStats = stats
            WatchDataCache.fuelStats = stats
        } catch {
            // Keep cached data
        }
    }

    private func loadVehicles() async {
        do {
            let list: [Vehicle] = try await WatchAPIClient.shared.get(.vehicles)
            vehicles = list
            WatchDataCache.vehicles = list
        } catch {
            // Keep cached data
        }
    }

    private func loadNextLaunch() async {
        do {
            let launch: AstroNextLaunchResponse = try await WatchAPIClient.shared.get(.launchesNext)
            nextLaunch = launch
            WatchDataCache.nextLaunch = launch
        } catch {
            // Keep cached data
        }
    }

    private func loadUpcomingLaunches() async {
        do {
            let response: AstroLaunchListResponse = try await WatchAPIClient.shared.get(.launchesUpcoming)
            upcomingLaunches = response.data?.results ?? []
            WatchDataCache.upcomingLaunches = response
        } catch {
            // Keep cached data
        }
    }

    private func loadWorkHours() async {
        let year = Calendar.current.component(.year, from: Date())
        do {
            let summary: WorkHoursSummary = try await WatchAPIClient.shared.get(.workHoursYear(year: year))
            workHours = summary
            WatchDataCache.workHours = summary
        } catch {
            // Keep cached data
        }
    }

    private func loadFromCache() {
        if let cached = WatchDataCache.fleetStatus { fleetStatus = cached }
        if let cached = WatchDataCache.fuelStats { fuelStats = cached }
        if let cached = WatchDataCache.vehicles { vehicles = cached }
        if let cached = WatchDataCache.nextLaunch { nextLaunch = cached }
        if let cached = WatchDataCache.workHours { workHours = cached }
        if let cached = WatchDataCache.upcomingLaunches {
            upcomingLaunches = cached.data?.results ?? []
        }
    }

    private func alertPriority(_ status: String) -> Int {
        switch status {
        case "overdue": return 0
        case "due": return 1
        case "due_soon": return 2
        default: return 3
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/ViewModels/
git commit -m "feat(watch): add WatchViewModel with data loading, caching, and actions"
```

---

### Task 5: Build ContentView (Command Hub root)

**Files:**
- Create: `DatacoreWatch/ContentView.swift`

**Step 1: Create the Command Hub**

Create `DatacoreWatch/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    @Environment(WatchViewModel.self) private var viewModel

    var body: some View {
        NavigationStack {
            List {
                // Vehicle Status Row
                NavigationLink(destination: VehicleDetailView()) {
                    VehicleStatusRow(
                        vehicleName: viewModel.primaryVehicle?.displayName ?? "No Vehicle",
                        status: viewModel.primaryVehicle?.worstStatus ?? "unknown"
                    )
                }

                // Fuel Row
                NavigationLink(destination: FuelDetailView()) {
                    FuelRow(
                        lastMpg: viewModel.primaryVehicle?.lastMpg,
                        avgMpg: viewModel.primaryVehicle?.avgMpg
                    )
                }

                // Launch Row
                NavigationLink(destination: LaunchDetailView()) {
                    LaunchRow(launch: viewModel.nextLaunch?.data)
                }

                // Work Hours Row
                NavigationLink(destination: WorkHoursDetailView()) {
                    WorkHoursRow(
                        currentMonth: viewModel.currentMonthHours,
                        ytd: viewModel.ytdHours
                    )
                }

                // Staleness indicator
                if let updated = viewModel.lastUpdatedString {
                    Section {
                        Text("Updated \(updated)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                    }
                }
            }
            .navigationTitle("Datacore")
            .task {
                await viewModel.loadAll()
            }
            .refreshable {
                await viewModel.refreshFromAPI()
            }
        }
    }
}

// MARK: - Row Components

private struct VehicleStatusRow: View {
    let vehicleName: String
    let status: String

    var body: some View {
        HStack {
            Image(systemName: "car.fill")
                .foregroundStyle(statusColor)
            VStack(alignment: .leading) {
                Text(vehicleName)
                    .font(.headline)
                Text(status.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)
        }
    }

    private var statusColor: Color {
        switch status {
        case "overdue": return .red
        case "due": return .orange
        case "due_soon": return .yellow
        case "ok": return .green
        default: return .gray
        }
    }
}

private struct FuelRow: View {
    let lastMpg: Double?
    let avgMpg: Double?

    var body: some View {
        HStack {
            Image(systemName: "fuelpump.fill")
                .foregroundStyle(.blue)
            VStack(alignment: .leading) {
                Text("Fuel Economy")
                    .font(.headline)
                if let last = lastMpg {
                    Text(String(format: "Last: %.1f MPG", last))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let avg = avgMpg {
                Text(String(format: "%.1f", avg))
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(.blue)
            }
        }
    }
}

private struct LaunchRow: View {
    let launch: AstroLaunch?

    var body: some View {
        HStack {
            Image(systemName: "airplane.departure")
                .foregroundStyle(.orange)
            VStack(alignment: .leading) {
                Text("Next Launch")
                    .font(.headline)
                if let name = launch?.name {
                    Text(name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }
}

private struct WorkHoursRow: View {
    let currentMonth: Double?
    let ytd: Double?

    var body: some View {
        HStack {
            Image(systemName: "clock.fill")
                .foregroundStyle(.green)
            VStack(alignment: .leading) {
                Text("Work Hours")
                    .font(.headline)
                if let ytd {
                    Text(String(format: "YTD: %.0f hrs", ytd))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let hours = currentMonth {
                Text(String(format: "%.0f", hours))
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(.green)
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/ContentView.swift
git commit -m "feat(watch): add ContentView command hub with module rows"
```

---

### Task 6: Build VehicleDetailView

**Files:**
- Create: `DatacoreWatch/Views/VehicleDetailView.swift`

**Step 1: Create the view**

Create `DatacoreWatch/Views/VehicleDetailView.swift`:

```swift
import SwiftUI

struct VehicleDetailView: View {
    @Environment(WatchViewModel.self) private var viewModel
    @State private var confirmingInterval: IntervalAlert?

    var body: some View {
        List {
            // Quick Stats
            if let vehicle = viewModel.primaryVehicle {
                Section("Status") {
                    LabeledContent("Mileage") {
                        if let mi = vehicle.currentMileage {
                            Text("\(mi.formatted()) mi")
                        } else {
                            Text("--")
                        }
                    }
                    LabeledContent("Last MPG") {
                        if let mpg = vehicle.lastMpg {
                            Text(String(format: "%.1f", mpg))
                        } else {
                            Text("--")
                        }
                    }
                }
            }

            // Maintenance Alerts
            Section("Service Intervals") {
                if viewModel.urgentAlerts.isEmpty {
                    Text("All services OK")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.urgentAlerts) { alert in
                        Button {
                            confirmingInterval = alert
                        } label: {
                            IntervalAlertRow(alert: alert)
                        }
                    }
                }
            }
        }
        .navigationTitle(viewModel.primaryVehicle?.displayName ?? "Vehicle")
        .confirmationDialog(
            "Mark Service Done?",
            isPresented: .init(
                get: { confirmingInterval != nil },
                set: { if !$0 { confirmingInterval = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let alert = confirmingInterval {
                Button("Mark \(alert.itemName) Done") {
                    Task {
                        _ = await viewModel.markServiceDone(intervalId: alert.intervalId)
                        confirmingInterval = nil
                    }
                }
                Button("Cancel", role: .cancel) {
                    confirmingInterval = nil
                }
            }
        } message: {
            if let alert = confirmingInterval {
                Text("This will update \(alert.itemName) to today's date and current mileage.")
            }
        }
    }
}

private struct IntervalAlertRow: View {
    let alert: IntervalAlert

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.itemName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                HStack(spacing: 8) {
                    if let miles = alert.milesRemaining {
                        Text("\(miles.formatted()) mi")
                            .font(.caption2)
                    }
                    if let days = alert.daysRemaining {
                        Text("\(days)d")
                            .font(.caption2)
                    }
                }
                .foregroundStyle(.secondary)
            }
        }
    }

    private var statusColor: Color {
        switch alert.status {
        case "overdue": return .red
        case "due": return .orange
        case "due_soon": return .yellow
        default: return .green
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Views/VehicleDetailView.swift
git commit -m "feat(watch): add VehicleDetailView with maintenance alerts and mark-done action"
```

---

### Task 7: Build FuelDetailView and FuelLogFormView

**Files:**
- Create: `DatacoreWatch/Views/FuelDetailView.swift`
- Create: `DatacoreWatch/Views/FuelLogFormView.swift`

**Step 1: Create FuelDetailView**

Create `DatacoreWatch/Views/FuelDetailView.swift`:

```swift
import SwiftUI

struct FuelDetailView: View {
    @Environment(WatchViewModel.self) private var viewModel
    @State private var showingLogForm = false

    var body: some View {
        List {
            // Stats Header
            if let stats = viewModel.fuelStats {
                Section("Stats") {
                    LabeledContent("Avg MPG (Last 5)") {
                        Text(String(format: "%.1f", stats.avgMpgLast5 ?? 0))
                    }
                    LabeledContent("Avg MPG (All)") {
                        Text(String(format: "%.1f", stats.avgMpg ?? 0))
                    }
                    LabeledContent("Total Spent") {
                        Text(String(format: "$%.0f", stats.totalSpent))
                    }
                    LabeledContent("Cost/Gallon") {
                        Text(String(format: "$%.2f", stats.avgCostPerGallon ?? 0))
                    }
                }
            }

            // Recent Logs
            if let fleet = viewModel.fleetStatus {
                let fuelActivities = fleet.activityTimeline.filter {
                    $0.type == "fuel"
                }.prefix(5)

                if !fuelActivities.isEmpty {
                    Section("Recent") {
                        ForEach(Array(fuelActivities), id: \.id) { item in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.description ?? "Fuel entry")
                                    .font(.subheadline)
                                    .lineLimit(2)
                                Text(item.date ?? "")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            // Log Fuel Button
            Section {
                Button {
                    showingLogForm = true
                } label: {
                    Label("Log Fuel", systemImage: "fuelpump.fill")
                }
            }
        }
        .navigationTitle("Fuel")
        .sheet(isPresented: $showingLogForm) {
            FuelLogFormView()
        }
    }
}
```

**Step 2: Create FuelLogFormView**

Create `DatacoreWatch/Views/FuelLogFormView.swift`:

```swift
import SwiftUI

struct FuelLogFormView: View {
    @Environment(WatchViewModel.self) private var viewModel
    @Environment(\.dismiss) private var dismiss

    @State private var gallons = ""
    @State private var totalCost = ""
    @State private var odometer = ""
    @State private var selectedVehicleId: Int?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                if viewModel.vehicles.count > 1 {
                    Picker("Vehicle", selection: $selectedVehicleId) {
                        ForEach(viewModel.vehicles) { vehicle in
                            Text(vehicle.displayName)
                                .tag(vehicle.id as Int?)
                        }
                    }
                    .pickerStyle(.menu)
                }

                TextField("Gallons", text: $gallons)

                TextField("Total Cost", text: $totalCost)

                TextField("Odometer", text: $odometer)

                Button {
                    Task { await save() }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save")
                    }
                }
                .disabled(!isValid || isSaving)
            }
            .navigationTitle("Log Fuel")
            .onAppear {
                selectedVehicleId = viewModel.vehicles.first?.id
            }
        }
    }

    private var isValid: Bool {
        guard let _ = Double(gallons),
              let _ = Double(totalCost),
              let _ = Int(odometer),
              selectedVehicleId != nil else {
            return false
        }
        return true
    }

    private func save() async {
        guard let gal = Double(gallons),
              let cost = Double(totalCost),
              let odo = Int(odometer),
              let vehicleId = selectedVehicleId else { return }

        isSaving = true
        let success = await viewModel.logFuel(
            vehicleId: vehicleId,
            gallons: gal,
            totalCost: cost,
            odometer: odo
        )
        isSaving = false

        if success {
            dismiss()
        }
    }
}
```

**Step 3: Commit**

```bash
git add DatacoreWatch/Views/FuelDetailView.swift DatacoreWatch/Views/FuelLogFormView.swift
git commit -m "feat(watch): add FuelDetailView with stats and FuelLogFormView"
```

---

### Task 8: Build LaunchDetailView

**Files:**
- Create: `DatacoreWatch/Views/LaunchDetailView.swift`

**Step 1: Create the view**

Create `DatacoreWatch/Views/LaunchDetailView.swift`:

```swift
import SwiftUI

struct LaunchDetailView: View {
    @Environment(WatchViewModel.self) private var viewModel

    var body: some View {
        List {
            // Next Launch Card
            if let launch = viewModel.nextLaunch?.data {
                Section("Next Launch") {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(launch.name ?? "Unknown Mission")
                            .font(.headline)

                        if let provider = launch.launchServiceProvider {
                            if let name = provider.value(forKey: "name") {
                                Text(name)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if let rocket = launch.rocket {
                            if let config = rocket.value(forKey: "configuration"),
                               let name = config.value(forKey: "name") {
                                Label(name, systemImage: "airplane")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if let pad = launch.pad {
                            if let name = pad.value(forKey: "name") {
                                Label(name, systemImage: "mappin")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }

                        // Countdown
                        if let netString = launch.net, let launchDate = parseISO(netString) {
                            Divider()
                            TimelineView(.periodic(from: .now, by: 1)) { context in
                                let remaining = launchDate.timeIntervalSince(context.date)
                                if remaining > 0 {
                                    Text("T- \(formatCountdown(remaining))")
                                        .font(.title3)
                                        .fontWeight(.bold)
                                        .foregroundStyle(.orange)
                                        .monospacedDigit()
                                } else {
                                    Text("LAUNCHED")
                                        .font(.title3)
                                        .fontWeight(.bold)
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            // Upcoming Launches
            if !viewModel.upcomingLaunches.isEmpty {
                Section("Upcoming") {
                    ForEach(Array(viewModel.upcomingLaunches.prefix(5))) { launch in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(launch.name ?? "Unknown")
                                .font(.subheadline)
                                .lineLimit(2)
                            if let net = launch.net {
                                Text(formatLaunchDate(net))
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Launches")
    }

    // MARK: - Helpers

    private func parseISO(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }

    private func formatCountdown(_ interval: TimeInterval) -> String {
        let days = Int(interval) / 86400
        let hours = (Int(interval) % 86400) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60

        if days > 0 {
            return String(format: "%dd %02d:%02d:%02d", days, hours, minutes, seconds)
        }
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    private func formatLaunchDate(_ iso: String) -> String {
        guard let date = parseISO(iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - AnyCodable helper for accessing nested dictionary values

private extension AnyCodable? {
    func value(forKey key: String) -> String? {
        guard let dict = self?.value as? [String: Any] else { return nil }
        return dict[key] as? String
    }

    func value(forKey key: String) -> AnyCodable? {
        guard let dict = self?.value as? [String: Any] else { return nil }
        guard let val = dict[key] else { return nil }
        return AnyCodable(val)
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Views/LaunchDetailView.swift
git commit -m "feat(watch): add LaunchDetailView with live countdown and upcoming list"
```

---

### Task 9: Build WorkHoursDetailView and WorkHoursFormView

**Files:**
- Create: `DatacoreWatch/Views/WorkHoursDetailView.swift`
- Create: `DatacoreWatch/Views/WorkHoursFormView.swift`

**Step 1: Create WorkHoursDetailView**

Create `DatacoreWatch/Views/WorkHoursDetailView.swift`:

```swift
import SwiftUI

struct WorkHoursDetailView: View {
    @Environment(WatchViewModel.self) private var viewModel
    @State private var showingLogForm = false

    var body: some View {
        List {
            // Current Month
            if let hours = viewModel.currentMonthHours {
                Section("This Month") {
                    VStack(alignment: .center, spacing: 4) {
                        Text(String(format: "%.1f", hours))
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(.green)
                        Text("hours logged")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                }
            }

            // Recent Months
            if let summary = viewModel.workHours {
                let recentMonths = summary.months
                    .sorted { $0.month > $1.month }
                    .prefix(3)

                if !recentMonths.isEmpty {
                    Section("Recent") {
                        ForEach(Array(recentMonths)) { month in
                            LabeledContent(month.monthName) {
                                Text(String(format: "%.1f hrs", month.hoursWorked ?? 0))
                            }
                        }
                    }
                }

                // YTD
                Section("Year to Date") {
                    LabeledContent("Total Hours") {
                        Text(String(format: "%.0f", summary.totalHours))
                    }
                    LabeledContent("Months Entered") {
                        Text("\(summary.monthsEntered)")
                    }
                    if summary.totalOvertime != 0 {
                        LabeledContent("Overtime") {
                            Text(String(format: "%.1f hrs", summary.totalOvertime))
                        }
                    }
                }
            }

            // Log Hours Button
            Section {
                Button {
                    showingLogForm = true
                } label: {
                    Label("Log Hours", systemImage: "clock.badge.checkmark")
                }
            }
        }
        .navigationTitle("Work Hours")
        .sheet(isPresented: $showingLogForm) {
            WorkHoursFormView()
        }
    }
}
```

**Step 2: Create WorkHoursFormView**

Create `DatacoreWatch/Views/WorkHoursFormView.swift`:

```swift
import SwiftUI

struct WorkHoursFormView: View {
    @Environment(WatchViewModel.self) private var viewModel
    @Environment(\.dismiss) private var dismiss

    @State private var hours = ""
    @State private var isSaving = false

    private var currentMonthName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM"
        return formatter.string(from: Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(currentMonthName) {
                    TextField("Hours", text: $hours)

                    if let existing = viewModel.currentMonthHours, existing > 0 {
                        Text("Currently: \(String(format: "%.1f", existing)) hrs")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Button {
                    Task { await save() }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save")
                    }
                }
                .disabled(Double(hours) == nil || isSaving)
            }
            .navigationTitle("Log Hours")
            .onAppear {
                // Pre-fill with existing value if any
                if let existing = viewModel.currentMonthHours, existing > 0 {
                    hours = String(format: "%.1f", existing)
                }
            }
        }
    }

    private func save() async {
        guard let value = Double(hours) else { return }
        isSaving = true
        let success = await viewModel.logWorkHours(hours: value)
        isSaving = false
        if success {
            dismiss()
        }
    }
}
```

**Step 3: Commit**

```bash
git add DatacoreWatch/Views/WorkHoursDetailView.swift DatacoreWatch/Views/WorkHoursFormView.swift
git commit -m "feat(watch): add WorkHoursDetailView with monthly breakdown and log form"
```

---

### Task 10: Build and verify Phase 1

**Step 1: Run xcodegen and build**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
xcodebuild -project Datacore.xcodeproj -scheme DatacoreWatch -destination 'platform=watchOS Simulator,name=Apple Watch Ultra 2 (49mm)' build 2>&1 | tail -20
```

Expected: Build succeeds. If there are compilation errors, fix them before proceeding.

**Step 2: Address any type mismatches**

Common issues to look for:
- `Vehicle` model may need a `displayName` computed property accessible from the watchOS target. If `displayName` is computed in the iOS ViewModel (not the model), add it to the model or compute it in `WatchViewModel`.
- `ActivityItem` fields (`type`, `description`, `date`, `id`) — verify these match the actual `ActivityItem` struct in `DashboardStats.swift`.
- `AnyCodable` — verify it's included in the shared sources in `project.yml`.

**Step 3: Fix and recommit if needed**

```bash
git add -A
git commit -m "fix(watch): resolve Phase 1 compilation issues"
```

---

## Phase 2: Complications

### Task 11: Build VehicleHealthComplication

**Files:**
- Create: `DatacoreWatch/Complications/VehicleHealthComplication.swift`

**Step 1: Create the complication**

Create `DatacoreWatch/Complications/VehicleHealthComplication.swift`:

```swift
import SwiftUI
import WidgetKit

struct VehicleHealthEntry: TimelineEntry {
    let date: Date
    let vehicleName: String
    let worstStatus: String
    let milesRemaining: Int?
    let alerts: [WidgetAlert]
    let costTrend: [Double]  // Last 6 months maintenance costs for sparkline
    let isPlaceholder: Bool

    static let placeholder = VehicleHealthEntry(
        date: .now,
        vehicleName: "Vehicle",
        worstStatus: "ok",
        milesRemaining: nil,
        alerts: [],
        costTrend: [],
        isPlaceholder: true
    )
}

struct VehicleHealthProvider: TimelineProvider {
    func placeholder(in context: Context) -> VehicleHealthEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (VehicleHealthEntry) -> Void) {
        completion(entryFromCache() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<VehicleHealthEntry>) -> Void) {
        Task {
            var entry = entryFromCache() ?? .placeholder

            // Try fresh API data
            do {
                let fleet: FleetStatus = try await WatchAPIClient.shared.get(.fleetStatus())
                WatchDataCache.fleetStatus = fleet

                if let vehicle = fleet.vehicleSummaries.first {
                    let topAlerts = fleet.intervalAlerts
                        .filter { $0.vehicleId == vehicle.id }
                        .sorted { alertPriority($0.status) < alertPriority($1.status) }
                        .prefix(3)
                        .map { WidgetAlert(itemName: $0.itemName, status: $0.status, milesRemaining: $0.milesRemaining, daysRemaining: $0.daysRemaining) }

                    let worstMiles = fleet.intervalAlerts
                        .filter { $0.vehicleId == vehicle.id }
                        .compactMap(\.milesRemaining)
                        .min()

                    entry = VehicleHealthEntry(
                        date: .now,
                        vehicleName: vehicle.displayName,
                        worstStatus: vehicle.worstStatus,
                        milesRemaining: worstMiles,
                        alerts: topAlerts,
                        costTrend: extractCostTrend(from: fleet),
                        isPlaceholder: false
                    )
                }
            } catch {
                // Use cached entry
            }

            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func entryFromCache() -> VehicleHealthEntry? {
        guard let fleet = WatchDataCache.fleetStatus,
              let vehicle = fleet.vehicleSummaries.first else { return nil }

        let topAlerts = fleet.intervalAlerts
            .filter { $0.vehicleId == vehicle.id }
            .sorted { alertPriority($0.status) < alertPriority($1.status) }
            .prefix(3)
            .map { WidgetAlert(itemName: $0.itemName, status: $0.status, milesRemaining: $0.milesRemaining, daysRemaining: $0.daysRemaining) }

        let worstMiles = fleet.intervalAlerts
            .filter { $0.vehicleId == vehicle.id }
            .compactMap(\.milesRemaining)
            .min()

        return VehicleHealthEntry(
            date: .now,
            vehicleName: vehicle.displayName,
            worstStatus: vehicle.worstStatus,
            milesRemaining: worstMiles,
            alerts: topAlerts,
            costTrend: extractCostTrend(from: fleet),
            isPlaceholder: false
        )
    }

    private func extractCostTrend(from fleet: FleetStatus) -> [Double] {
        // Extract monthly costs from cost analysis if available
        // The fleet status costAnalysis has 30d and YTD totals but not monthly breakdown
        // For now, return empty — will be populated when API supports monthly cost history
        return []
    }

    private func alertPriority(_ status: String) -> Int {
        switch status {
        case "overdue": return 0
        case "due": return 1
        case "due_soon": return 2
        default: return 3
        }
    }
}

// MARK: - Views

struct VehicleHealthWidget: Widget {
    let kind = "VehicleHealthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: VehicleHealthProvider()) { entry in
            VehicleHealthWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Vehicle Health")
        .description("Maintenance status for your primary vehicle.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

struct VehicleHealthWidgetView: View {
    let entry: VehicleHealthEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryCorner:
            cornerView
        case .accessoryRectangular:
            rectangularView
        case .accessoryInline:
            inlineView
        default:
            circularView
        }
    }

    private var circularView: some View {
        Gauge(value: gaugeValue, in: 0...1) {
            Image(systemName: "car.fill")
        } currentValueLabel: {
            if let miles = entry.milesRemaining {
                Text("\(miles)")
                    .font(.caption)
            } else {
                Text(entry.worstStatus == "ok" ? "OK" : "DUE")
                    .font(.caption2)
            }
        }
        .gaugeStyle(.accessoryCircular)
        .tint(statusGradient)
    }

    private var cornerView: some View {
        Image(systemName: "car.fill")
            .font(.title3)
            .foregroundStyle(statusColor)
            .widgetLabel {
                Gauge(value: gaugeValue, in: 0...1) {
                    Text("")
                }
                .gaugeStyle(.accessoryLinear)
                .tint(statusGradient)
            }
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(entry.vehicleName)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
            }
            ForEach(entry.alerts.prefix(2), id: \.itemName) { alert in
                HStack(spacing: 4) {
                    Circle()
                        .fill(alertColor(alert.status))
                        .frame(width: 5, height: 5)
                    Text(alert.itemName)
                        .font(.caption2)
                        .lineLimit(1)
                    Spacer()
                    if let mi = alert.milesRemaining {
                        Text("\(mi) mi")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var inlineView: some View {
        HStack {
            Image(systemName: "car.fill")
            if let miles = entry.milesRemaining {
                Text("\(entry.vehicleName): \(miles) mi")
            } else {
                Text("\(entry.vehicleName): \(entry.worstStatus.uppercased())")
            }
        }
    }

    // MARK: - Helpers

    private var gaugeValue: Double {
        switch entry.worstStatus {
        case "overdue": return 0.0
        case "due": return 0.15
        case "due_soon": return 0.45
        case "ok": return 0.9
        default: return 0.5
        }
    }

    private var statusColor: Color {
        switch entry.worstStatus {
        case "overdue": return .red
        case "due": return .orange
        case "due_soon": return .yellow
        case "ok": return .green
        default: return .gray
        }
    }

    private var statusGradient: Gradient {
        Gradient(colors: [.red, .orange, .yellow, .green])
    }

    private func alertColor(_ status: String) -> Color {
        switch status {
        case "overdue": return .red
        case "due": return .orange
        case "due_soon": return .yellow
        default: return .green
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Complications/VehicleHealthComplication.swift
git commit -m "feat(watch): add VehicleHealth complication with circular, corner, rectangular views"
```

---

### Task 12: Build FuelEconomyComplication

**Files:**
- Create: `DatacoreWatch/Complications/FuelEconomyComplication.swift`

**Step 1: Create the complication**

Create `DatacoreWatch/Complications/FuelEconomyComplication.swift`:

```swift
import SwiftUI
import WidgetKit
import Charts

struct FuelEconomyEntry: TimelineEntry {
    let date: Date
    let vehicleName: String
    let lastMpg: Double?
    let avgMpg: Double?
    let totalSpent30d: Double?
    let mpgHistory: [Double]  // Last 10-15 MPG entries for sparkline
    let isPlaceholder: Bool

    static let placeholder = FuelEconomyEntry(
        date: .now,
        vehicleName: "Vehicle",
        lastMpg: nil,
        avgMpg: nil,
        totalSpent30d: nil,
        mpgHistory: [],
        isPlaceholder: true
    )
}

struct FuelEconomyProvider: TimelineProvider {
    func placeholder(in context: Context) -> FuelEconomyEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (FuelEconomyEntry) -> Void) {
        completion(entryFromCache() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<FuelEconomyEntry>) -> Void) {
        Task {
            var entry = entryFromCache() ?? .placeholder

            do {
                let fleet: FleetStatus = try await WatchAPIClient.shared.get(.fleetStatus())
                WatchDataCache.fleetStatus = fleet

                if let vehicle = fleet.vehicleSummaries.first {
                    let vehicleId = vehicle.id
                    let stats: FuelStats = try await WatchAPIClient.shared.get(.fuelStats(vehicleId: vehicleId))
                    WatchDataCache.fuelStats = stats

                    entry = FuelEconomyEntry(
                        date: .now,
                        vehicleName: vehicle.displayName,
                        lastMpg: vehicle.lastMpg,
                        avgMpg: stats.avgMpg,
                        totalSpent30d: fleet.fuelStats.totalSpent30d,
                        mpgHistory: fleet.fuelStats.sparklineData ?? [],
                        isPlaceholder: false
                    )
                }
            } catch {
                // Use cached entry
            }

            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }

    private func entryFromCache() -> FuelEconomyEntry? {
        guard let fleet = WatchDataCache.fleetStatus,
              let vehicle = fleet.vehicleSummaries.first else { return nil }
        let stats = WatchDataCache.fuelStats

        return FuelEconomyEntry(
            date: .now,
            vehicleName: vehicle.displayName,
            lastMpg: vehicle.lastMpg,
            avgMpg: stats?.avgMpg,
            totalSpent30d: fleet.fuelStats.totalSpent30d,
            mpgHistory: fleet.fuelStats.sparklineData ?? [],
            isPlaceholder: false
        )
    }
}

// MARK: - Widget

struct FuelEconomyWidget: Widget {
    let kind = "FuelEconomyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FuelEconomyProvider()) { entry in
            FuelEconomyWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Fuel Economy")
        .description("MPG trends and fuel spending.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

struct FuelEconomyWidgetView: View {
    let entry: FuelEconomyEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryCorner:
            cornerView
        case .accessoryRectangular:
            rectangularView
        case .accessoryInline:
            inlineView
        default:
            circularView
        }
    }

    private var circularView: some View {
        VStack(spacing: 1) {
            Image(systemName: "fuelpump.fill")
                .font(.caption)
            if let mpg = entry.lastMpg {
                Text(String(format: "%.0f", mpg))
                    .font(.title2)
                    .fontWeight(.bold)
            } else {
                Text("--")
                    .font(.title2)
            }
            Text("MPG")
                .font(.system(size: 8))
                .foregroundStyle(.secondary)
        }
    }

    private var cornerView: some View {
        Image(systemName: "fuelpump.fill")
            .font(.title3)
            .foregroundStyle(.blue)
            .widgetLabel {
                if let mpg = entry.lastMpg {
                    Text(String(format: "%.1f MPG", mpg))
                } else {
                    Text("-- MPG")
                }
            }
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(entry.vehicleName)
                    .font(.caption)
                    .lineLimit(1)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let mpg = entry.lastMpg {
                    Text(String(format: "%.1f", mpg))
                        .font(.title2)
                        .fontWeight(.bold)
                }
                VStack(alignment: .leading) {
                    if let avg = entry.avgMpg {
                        Text(String(format: "Avg %.1f", avg))
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                    if let spent = entry.totalSpent30d {
                        Text(String(format: "$%.0f/30d", spent))
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }

            // Sparkline
            if !entry.mpgHistory.isEmpty {
                Chart {
                    ForEach(Array(entry.mpgHistory.enumerated()), id: \.offset) { index, value in
                        LineMark(
                            x: .value("Entry", index),
                            y: .value("MPG", value)
                        )
                        .foregroundStyle(.blue)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 16)
            }
        }
    }

    private var inlineView: some View {
        HStack {
            Image(systemName: "fuelpump.fill")
            if let mpg = entry.lastMpg {
                Text(String(format: "%.1f MPG", mpg))
            } else {
                Text("-- MPG")
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Complications/FuelEconomyComplication.swift
git commit -m "feat(watch): add FuelEconomy complication with sparkline chart in rectangular view"
```

---

### Task 13: Build LaunchCountdownComplication

**Files:**
- Create: `DatacoreWatch/Complications/LaunchCountdownComplication.swift`

**Step 1: Create the complication**

Create `DatacoreWatch/Complications/LaunchCountdownComplication.swift`:

```swift
import SwiftUI
import WidgetKit

struct LaunchCountdownEntry: TimelineEntry {
    let date: Date
    let missionName: String
    let rocketName: String?
    let launchDate: Date?
    let isPlaceholder: Bool

    static let placeholder = LaunchCountdownEntry(
        date: .now,
        missionName: "Next Launch",
        rocketName: nil,
        launchDate: nil,
        isPlaceholder: true
    )
}

struct LaunchCountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> LaunchCountdownEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (LaunchCountdownEntry) -> Void) {
        completion(entryFromCache() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<LaunchCountdownEntry>) -> Void) {
        Task {
            var entry = entryFromCache() ?? .placeholder

            do {
                let response: AstroNextLaunchResponse = try await WatchAPIClient.shared.get(.launchesNext)
                WatchDataCache.nextLaunch = response

                if let launch = response.data {
                    entry = makeEntry(from: launch)
                }
            } catch {
                // Use cached
            }

            // For countdown, create timeline entries at key intervals for updating the display
            var entries: [LaunchCountdownEntry] = [entry]

            if let launchDate = entry.launchDate, launchDate > .now {
                // Add an entry at launch time so it flips to "LAUNCHED"
                let launchEntry = LaunchCountdownEntry(
                    date: launchDate,
                    missionName: entry.missionName,
                    rocketName: entry.rocketName,
                    launchDate: entry.launchDate,
                    isPlaceholder: false
                )
                entries.append(launchEntry)
            }

            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
            completion(Timeline(entries: entries, policy: .after(nextUpdate)))
        }
    }

    private func entryFromCache() -> LaunchCountdownEntry? {
        guard let response = WatchDataCache.nextLaunch,
              let launch = response.data else { return nil }
        return makeEntry(from: launch)
    }

    private func makeEntry(from launch: AstroLaunch) -> LaunchCountdownEntry {
        var launchDate: Date?
        if let net = launch.net {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            launchDate = formatter.date(from: net) ?? ISO8601DateFormatter().date(from: net)
        }

        var rocketName: String?
        if let rocket = launch.rocket,
           let config = rocket.value as? [String: Any],
           let configInner = config["configuration"] as? [String: Any],
           let name = configInner["name"] as? String {
            rocketName = name
        }

        return LaunchCountdownEntry(
            date: .now,
            missionName: launch.name ?? "Unknown Mission",
            rocketName: rocketName,
            launchDate: launchDate,
            isPlaceholder: false
        )
    }
}

// MARK: - Widget

struct LaunchCountdownWidget: Widget {
    let kind = "LaunchCountdownWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LaunchCountdownProvider()) { entry in
            LaunchCountdownWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Launch Countdown")
        .description("Countdown to the next space launch.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

struct LaunchCountdownWidgetView: View {
    let entry: LaunchCountdownEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryRectangular:
            rectangularView
        case .accessoryInline:
            inlineView
        default:
            circularView
        }
    }

    private var circularView: some View {
        VStack(spacing: 1) {
            Image(systemName: "airplane.departure")
                .font(.caption)
            if let launchDate = entry.launchDate, launchDate > .now {
                Text(launchDate, style: .timer)
                    .font(.caption)
                    .monospacedDigit()
                    .multilineTextAlignment(.center)
            } else {
                Text("--")
                    .font(.caption)
            }
        }
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Image(systemName: "airplane.departure")
                    .font(.caption)
                Text(entry.missionName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)
            }
            if let rocket = entry.rocketName {
                Text(rocket)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let launchDate = entry.launchDate, launchDate > .now {
                Text(launchDate, style: .relative)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(.orange)
                    .monospacedDigit()
            } else {
                Text("No upcoming launch")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var inlineView: some View {
        HStack {
            Image(systemName: "airplane.departure")
            if let launchDate = entry.launchDate, launchDate > .now {
                Text(launchDate, style: .relative)
            } else {
                Text("No launch")
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Complications/LaunchCountdownComplication.swift
git commit -m "feat(watch): add LaunchCountdown complication with timer-based countdown"
```

---

### Task 14: Build WorkHoursComplication

**Files:**
- Create: `DatacoreWatch/Complications/WorkHoursComplication.swift`

**Step 1: Create the complication**

Create `DatacoreWatch/Complications/WorkHoursComplication.swift`:

```swift
import SwiftUI
import WidgetKit

struct WorkHoursEntry: TimelineEntry {
    let date: Date
    let hoursLogged: Double?
    let targetHours: Double
    let monthName: String
    let isPlaceholder: Bool

    static let placeholder: WorkHoursEntry = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return WorkHoursEntry(
            date: .now,
            hoursLogged: nil,
            targetHours: 160,
            monthName: formatter.string(from: .now),
            isPlaceholder: true
        )
    }()
}

struct WorkHoursProvider: TimelineProvider {
    func placeholder(in context: Context) -> WorkHoursEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (WorkHoursEntry) -> Void) {
        completion(entryFromCache() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<WorkHoursEntry>) -> Void) {
        Task {
            var entry = entryFromCache() ?? .placeholder

            let year = Calendar.current.component(.year, from: Date())
            do {
                let summary: WorkHoursSummary = try await WatchAPIClient.shared.get(.workHoursYear(year: year))
                WatchDataCache.workHours = summary

                let month = Calendar.current.component(.month, from: Date())
                let currentMonth = summary.months.first(where: { $0.month == month })

                let formatter = DateFormatter()
                formatter.dateFormat = "MMM"

                entry = WorkHoursEntry(
                    date: .now,
                    hoursLogged: currentMonth?.hoursWorked,
                    targetHours: Double(currentMonth?.requiredHours ?? 160),
                    monthName: formatter.string(from: .now),
                    isPlaceholder: false
                )
            } catch {
                // Use cached
            }

            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }

    private func entryFromCache() -> WorkHoursEntry? {
        guard let summary = WatchDataCache.workHours else { return nil }
        let month = Calendar.current.component(.month, from: Date())
        let currentMonth = summary.months.first(where: { $0.month == month })

        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"

        return WorkHoursEntry(
            date: .now,
            hoursLogged: currentMonth?.hoursWorked,
            targetHours: Double(currentMonth?.requiredHours ?? 160),
            monthName: formatter.string(from: .now),
            isPlaceholder: false
        )
    }
}

// MARK: - Widget

struct WorkHoursWidget: Widget {
    let kind = "WorkHoursWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WorkHoursProvider()) { entry in
            WorkHoursWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Work Hours")
        .description("Monthly work hours progress.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryInline
        ])
    }
}

struct WorkHoursWidgetView: View {
    let entry: WorkHoursEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryCorner:
            cornerView
        case .accessoryInline:
            inlineView
        default:
            circularView
        }
    }

    private var circularView: some View {
        Gauge(value: gaugeValue, in: 0...1) {
            Image(systemName: "clock.fill")
        } currentValueLabel: {
            if let hours = entry.hoursLogged {
                Text(String(format: "%.0f", hours))
                    .font(.caption)
            } else {
                Text("--")
                    .font(.caption)
            }
        }
        .gaugeStyle(.accessoryCircular)
        .tint(.green)
    }

    private var cornerView: some View {
        Image(systemName: "clock.fill")
            .font(.title3)
            .foregroundStyle(.green)
            .widgetLabel {
                if let hours = entry.hoursLogged {
                    Gauge(value: gaugeValue, in: 0...1) {
                        Text("")
                    }
                    .gaugeStyle(.accessoryLinear)
                    .tint(.green)
                } else {
                    Text("-- hrs")
                }
            }
    }

    private var inlineView: some View {
        HStack {
            Image(systemName: "clock.fill")
            if let hours = entry.hoursLogged {
                Text(String(format: "%.0f hrs MTD", hours))
            } else {
                Text("-- hrs MTD")
            }
        }
    }

    private var gaugeValue: Double {
        guard let hours = entry.hoursLogged, entry.targetHours > 0 else { return 0 }
        return min(hours / entry.targetHours, 1.0)
    }
}
```

**Step 2: Commit**

```bash
git add DatacoreWatch/Complications/WorkHoursComplication.swift
git commit -m "feat(watch): add WorkHours complication with progress gauge"
```

---

### Task 15: Register all complications in the WidgetBundle and add background refresh

**Files:**
- Create: `DatacoreWatch/Complications/DatacoreWatchWidgets.swift`
- Modify: `DatacoreWatch/DatacoreWatchApp.swift`

**Step 1: Create the WidgetBundle**

Create `DatacoreWatch/Complications/DatacoreWatchWidgets.swift`:

```swift
import SwiftUI
import WidgetKit

@main
struct DatacoreWatchWidgets: WidgetBundle {
    var body: some Widget {
        VehicleHealthWidget()
        FuelEconomyWidget()
        LaunchCountdownWidget()
        WorkHoursWidget()
    }
}
```

**Important:** This creates a conflict — both `DatacoreWatchApp.swift` and `DatacoreWatchWidgets.swift` have `@main`. The complications should be bundled as a **widget extension target**, not in the main watch app. We need to decide: either the complications live in the watch app itself (possible in watchOS 10+ using `WidgetKit` directly in the app target), or they get their own extension target.

**Approach:** Keep complications in the watch app target. Remove `@main` from `DatacoreWatchWidgets.swift` and instead register the `WidgetBundle` inside the watch app's `body` using `supplementaryScene`:

Update `DatacoreWatch/DatacoreWatchApp.swift` to:

```swift
import SwiftUI
import WidgetKit

@main
struct DatacoreWatchApp: App {
    @State private var viewModel = WatchViewModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(viewModel)
        }

        // Register complications
        WKSupplementaryScene(kind: "VehicleHealthWidget") {
            VehicleHealthWidgetView(entry: .placeholder)
        }
        WKSupplementaryScene(kind: "FuelEconomyWidget") {
            FuelEconomyWidgetView(entry: .placeholder)
        }
        WKSupplementaryScene(kind: "LaunchCountdownWidget") {
            LaunchCountdownWidgetView(entry: .placeholder)
        }
        WKSupplementaryScene(kind: "WorkHoursWidget") {
            WorkHoursWidgetView(entry: .placeholder)
        }
    }
}
```

**Note:** The exact API for registering watchOS complications in-app vs as a widget extension may vary depending on the final watchOS 12 SDK. The complication code (TimelineProvider, Widget, Views) is correct regardless — if it needs to move to a separate widget extension target, only the registration changes. During implementation, check whether `StaticConfiguration` compiles in the watch app target or requires a separate `DatacoreWatchComplications` widget extension target in `project.yml`.

**Step 2: Update DatacoreWatchWidgets.swift to be a non-main WidgetBundle**

Replace the `@main` approach — make it a plain file that just defines the bundle for reference:

```swift
import SwiftUI
import WidgetKit

struct DatacoreWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        VehicleHealthWidget()
        FuelEconomyWidget()
        LaunchCountdownWidget()
        WorkHoursWidget()
    }
}
```

**Step 3: Commit**

```bash
git add DatacoreWatch/Complications/DatacoreWatchWidgets.swift DatacoreWatch/DatacoreWatchApp.swift
git commit -m "feat(watch): register complications and add background refresh scheduling"
```

---

### Task 16: Build and verify Phase 2

**Step 1: Run xcodegen and build**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
xcodebuild -project Datacore.xcodeproj -scheme DatacoreWatch -destination 'platform=watchOS Simulator,name=Apple Watch Ultra 2 (49mm)' build 2>&1 | tail -20
```

Expected: Build succeeds.

**Step 2: Address issues**

Common issues:
- `FleetFuelStats` may not have `totalSpent30d` or `sparklineData` fields — check the actual struct in `DashboardStats.swift`. If these fields don't exist, use available alternatives or set to `nil`.
- `VehicleSummary.displayName` — may be a computed property or may need to be constructed from `year`/`make`/`model`.
- WidgetKit registration pattern — may need to create a separate widget extension target if in-app registration doesn't work on watchOS 12.

**Step 3: Fix and recommit**

```bash
git add -A
git commit -m "fix(watch): resolve Phase 2 compilation issues"
```

---

## Phase 3: WatchConnectivity

### Task 17: Build watch-side WatchConnectivityManager

**Files:**
- Create: `DatacoreWatch/Network/WatchConnectivityManager.swift`
- Modify: `DatacoreWatch/DatacoreWatchApp.swift`
- Modify: `DatacoreWatch/ViewModels/WatchViewModel.swift`

**Step 1: Create the watch-side connectivity manager**

Create `DatacoreWatch/Network/WatchConnectivityManager.swift`:

```swift
import Foundation
import WatchConnectivity

final class WatchConnectivityManager: NSObject, ObservableObject, @unchecked Sendable {
    static let shared = WatchConnectivityManager()

    private let session: WCSession
    private var pendingCallbacks: [String: (Data?) -> Void] = []
    private let lock = NSLock()

    private override init() {
        session = WCSession.default
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    /// Request data from the iPhone app via WatchConnectivity.
    /// Returns the raw JSON data if successful, nil if failed.
    func requestData(_ requestType: String) async -> Data? {
        guard session.isReachable else { return nil }

        return await withCheckedContinuation { continuation in
            let message: [String: Any] = ["request": requestType]

            session.sendMessage(message, replyHandler: { reply in
                let data = reply["data"] as? Data
                continuation.resume(returning: data)
            }, errorHandler: { _ in
                continuation.resume(returning: nil)
            })
        }
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Activation complete
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        // Receive server config from iPhone
        if let address = userInfo["serverAddress"] as? String {
            SharedDefaults.serverAddress = address
        }
    }
}
```

**Step 2: Update DatacoreWatchApp.swift to activate WCSession**

Add to the `DatacoreWatchApp` init or task:

In `DatacoreWatchApp.swift`, add after the `.environment(viewModel)` line inside the `WindowGroup`:

```swift
.task {
    WatchConnectivityManager.shared.activate()
}
```

**Step 3: Update WatchViewModel to use connectivity fallback**

Add a fallback method to `WatchViewModel`. After each `loadXxx()` method's catch block, try the WC fallback. Add this helper method to `WatchViewModel`:

```swift
    // MARK: - WatchConnectivity Fallback

    private func fetchViaConnectivity<T: Decodable>(_ requestType: String) async -> T? {
        guard let data = await WatchConnectivityManager.shared.requestData(requestType) else { return nil }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try? decoder.decode(T.self, from: data)
    }
```

Then update each `loadXxx()` method's catch block to try the fallback. For example, `loadFleetStatus()` becomes:

```swift
    private func loadFleetStatus() async {
        do {
            let status: FleetStatus = try await WatchAPIClient.shared.get(.fleetStatus())
            fleetStatus = status
            WatchDataCache.fleetStatus = status
        } catch {
            // Try WatchConnectivity fallback
            if let status: FleetStatus = await fetchViaConnectivity("fleet-status") {
                fleetStatus = status
                WatchDataCache.fleetStatus = status
            }
        }
    }
```

Apply the same pattern to all other `loadXxx()` methods:
- `loadFuelStats()` → fallback request type: `"fuel-stats"`
- `loadVehicles()` → fallback request type: `"vehicles"`
- `loadNextLaunch()` → fallback request type: `"launches-next"`
- `loadUpcomingLaunches()` → fallback request type: `"launches-upcoming"`
- `loadWorkHours()` → fallback request type: `"work-hours"`

**Step 4: Commit**

```bash
git add DatacoreWatch/Network/WatchConnectivityManager.swift DatacoreWatch/DatacoreWatchApp.swift DatacoreWatch/ViewModels/WatchViewModel.swift
git commit -m "feat(watch): add WatchConnectivity fallback for data requests and config sync"
```

---

### Task 18: Build iPhone-side WatchConnectivity delegate

**Files:**
- Create: `Datacore/Network/PhoneConnectivityManager.swift`
- Modify: `Datacore/DatacoreApp.swift`
- Modify: `Datacore/ViewModels/SettingsViewModel.swift`

**Step 1: Create the iPhone-side connectivity manager**

Create `Datacore/Network/PhoneConnectivityManager.swift`:

```swift
import Foundation
import WatchConnectivity

final class PhoneConnectivityManager: NSObject, ObservableObject, @unchecked Sendable {
    static let shared = PhoneConnectivityManager()

    private let session: WCSession

    private override init() {
        session = WCSession.default
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        session.delegate = self
        session.activate()
    }

    /// Push current server config to the watch
    func syncServerConfig() {
        guard session.activationState == .activated else { return }
        let userInfo: [String: Any] = [
            "serverAddress": ServerConfig.serverAddress ?? ""
        ]
        try? session.transferUserInfo(userInfo)
    }
}

// MARK: - WCSessionDelegate

extension PhoneConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Sync config on activation
        if activationState == .activated {
            syncServerConfig()
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        guard let requestType = message["request"] as? String else {
            replyHandler(["error": "unknown request"])
            return
        }

        Task {
            do {
                let data = try await handleRequest(requestType)
                replyHandler(["data": data])
            } catch {
                replyHandler(["error": error.localizedDescription])
            }
        }
    }

    private func handleRequest(_ type: String) async throws -> Data {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase

        switch type {
        case "fleet-status":
            let result: FleetStatus = try await APIClient.shared.get(.fleetStatus())
            return try encoder.encode(result)
        case "fuel-stats":
            let result: FuelStats = try await APIClient.shared.get(.fuelStats(vehicleId: nil))
            return try encoder.encode(result)
        case "vehicles":
            let result: [Vehicle] = try await APIClient.shared.get(.vehicles)
            return try encoder.encode(result)
        case "launches-next":
            let result: AstroNextLaunchResponse = try await APIClient.shared.get(.astroLaunchesNext)
            return try encoder.encode(result)
        case "launches-upcoming":
            let result: AstroLaunchListResponse = try await APIClient.shared.get(.astroLaunchesUpcoming)
            return try encoder.encode(result)
        case "work-hours":
            let year = Calendar.current.component(.year, from: Date())
            let result: WorkHoursSummary = try await APIClient.shared.get(.workHoursYear(year: year))
            return try encoder.encode(result)
        default:
            throw WatchAPIError.invalidURL
        }
    }
}
```

**Step 2: Activate in DatacoreApp.swift**

In `Datacore/DatacoreApp.swift`, add one line inside the `.task` block (after `ServerConfig.migrateToSharedDefaults()`):

```swift
PhoneConnectivityManager.shared.activate()
```

**Step 3: Sync config from SettingsViewModel**

In `Datacore/ViewModels/SettingsViewModel.swift`, find where `ServerConfig.serverAddress` is set (likely in a `saveServer()` or similar method). After the address is saved, add:

```swift
PhoneConnectivityManager.shared.syncServerConfig()
```

**Step 4: Commit**

```bash
git add Datacore/Network/PhoneConnectivityManager.swift Datacore/DatacoreApp.swift Datacore/ViewModels/SettingsViewModel.swift
git commit -m "feat(watch): add iPhone-side WatchConnectivity delegate for data relay and config sync"
```

---

### Task 19: Final build and verify all phases

**Step 1: Run xcodegen and build both targets**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
```

Build the watch app:
```bash
xcodebuild -project Datacore.xcodeproj -scheme DatacoreWatch -destination 'platform=watchOS Simulator,name=Apple Watch Ultra 2 (49mm)' build 2>&1 | tail -20
```

Build the iOS app (to verify PhoneConnectivityManager compiles):
```bash
xcodebuild -project Datacore.xcodeproj -scheme Datacore -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -20
```

Expected: Both build successfully.

**Step 2: Fix any remaining issues and commit**

```bash
git add -A
git commit -m "fix(watch): resolve final compilation issues across all phases"
```

**Step 3: Run on simulator**

Open Xcode, select the `DatacoreWatch` scheme, pick a watch simulator paired with an iPhone simulator. Run the app. Verify:
- Command Hub shows 4 rows
- Tapping each row navigates to the detail view
- If server is configured, data loads
- If server is not configured, cached/placeholder data shows
- Pull to refresh works

---

## Implementation Notes

### Fields to verify during implementation

These model fields are referenced in the plan but may not exist exactly as named. Check during build:

1. **`VehicleSummary.displayName`** — may need to be computed from `"\(year) \(make) \(model)"` if not a stored property
2. **`FleetFuelStats.totalSpent30d`** — check actual field name in `DashboardStats.swift`
3. **`FleetFuelStats.sparklineData`** — may not exist yet. If not available, leave sparkline empty in fuel complication
4. **`ActivityItem.type`**, `.description`, `.date`, `.id` — verify exact field names
5. **`Vehicle.displayName`** — same as VehicleSummary concern
6. **`AstroNextLaunchResponse`** and **`AstroLaunchListResponse`** — verify these match the actual response types in `Astrometrics.swift`
7. **`WorkHoursSummary`** vs **`WorkHoursYear`** — verify the response type name for `GET /api/work-hours/<year>`

### Complication widget extension considerations

If the watchOS 12 SDK requires complications to live in a separate widget extension target (not the main app), you'll need to:
1. Add a `DatacoreWatchComplications` target in `project.yml` (type: `app-extension`, platform: `watchOS`)
2. Move the complication files to `DatacoreWatchComplications/`
3. Share the same model files + `WatchAPIClient` + `WatchDataCache` via path includes
4. Re-run `xcodegen generate`

### Testing on real hardware

The watch app requires network access to the Flask server. Options:
- Same WiFi network as the server
- Tailscale/VPN if the server is remote
- WatchConnectivity fallback via the paired iPhone (Phase 3)
