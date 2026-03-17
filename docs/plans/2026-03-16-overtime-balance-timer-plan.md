# Overtime Balance Timer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live overtime balance display (month-to-date surplus/deficit) to the Timecard module across backend, iOS, and watchOS.

**Architecture:** New Flask endpoint computes the balance server-side. iOS and watchOS fetch once, then tick locally when clocked in. watchOS complication uses `Text(date, style: .timer)` for native ticking without app wakes.

**Tech Stack:** Python/Flask (backend), SwiftUI/Swift 6 (iOS + watchOS), WidgetKit (complications)

---

### Task 1: Backend — Add `GET /api/timecard/overtime-balance` endpoint

**Files:**
- Modify: `backend/app/routes/timecard.py` (append new route after line 577)

**Step 1: Add the helper function and route**

Add this after the `delete_monthly_total` function (line 577) in `timecard.py`:

```python
# ═══════════════════════════════════════════════════════════════════
# Overtime Balance
# ═══════════════════════════════════════════════════════════════════

def _count_weekdays_through_today(year, month):
    """Count Monday-Friday days from the 1st through today (inclusive) in Chicago TZ."""
    today_chicago = datetime.now(CHICAGO_TZ).date()
    # If querying a different month/year, count the full month
    if year != today_chicago.year or month != today_chicago.month:
        return _count_weekdays(year, month)
    count = 0
    for day in range(1, today_chicago.day + 1):
        if date(year, month, day).weekday() < 5:
            count += 1
    return count


@timecard_bp.route('/overtime-balance', methods=['GET'])
def overtime_balance():
    """
    Return the live month-to-date overtime balance.

    Response:
      balance_seconds  — int, positive = ahead, negative = behind
      expected_hours   — float, weekdays_through_today * 8
      actual_hours     — float, completed entries + manual + active timer
      weekdays_elapsed — int, weekdays from 1st through today (inclusive)
      is_clocked_in    — bool
      clock_in_time    — ISO string or null
    """
    now_utc = datetime.now(timezone.utc)
    today_chicago = now_utc.astimezone(CHICAGO_TZ).date()
    year = today_chicago.year
    month = today_chicago.month

    # 1. Weekdays through today (inclusive)
    weekdays = _count_weekdays_through_today(year, month)
    expected_hours = weekdays * 8

    # 2. Sum completed entries this month (Chicago-local month boundaries)
    month_start_utc = CHICAGO_TZ.localize(
        datetime(year, month, 1)
    ).astimezone(timezone.utc)

    if month == 12:
        next_month_utc = CHICAGO_TZ.localize(
            datetime(year + 1, 1, 1)
        ).astimezone(timezone.utc)
    else:
        next_month_utc = CHICAGO_TZ.localize(
            datetime(year, month + 1, 1)
        ).astimezone(timezone.utc)

    completed_entries = TimeEntry.query.filter(
        TimeEntry.end_time.isnot(None),
        TimeEntry.start_time >= month_start_utc,
        TimeEntry.start_time < next_month_utc,
    ).all()

    tracked_seconds = sum(e.duration_seconds or 0 for e in completed_entries)
    tracked_hours = tracked_seconds / 3600

    # 3. Manual monthly total (if any)
    manual = MonthlyTotal.query.filter_by(year=year, month=month).first()
    manual_hours = manual.hours if manual else 0

    # 4. Active timer contribution
    active = _get_active_timer()
    is_clocked_in = active is not None
    clock_in_time = None
    active_hours = 0

    if is_clocked_in:
        clock_in_time = active.start_time.isoformat()
        active_seconds = (now_utc - active.start_time).total_seconds()
        active_hours = active_seconds / 3600

    actual_hours = round(tracked_hours + manual_hours + active_hours, 4)
    balance_seconds = int((actual_hours - expected_hours) * 3600)

    return jsonify({
        'balance_seconds': balance_seconds,
        'expected_hours': round(expected_hours, 2),
        'actual_hours': round(actual_hours, 2),
        'weekdays_elapsed': weekdays,
        'is_clocked_in': is_clocked_in,
        'clock_in_time': clock_in_time,
    })
```

**Step 2: Update the module docstring**

Add to the docstring at the top of `timecard.py` (after line 22):

```
  Overtime:
    GET    /api/timecard/overtime-balance -> Live month-to-date OT balance
```

**Step 3: Commit**

```bash
git add backend/app/routes/timecard.py
git commit -m "feat(timecard): add GET /api/timecard/overtime-balance endpoint"
```

---

### Task 2: iOS — Add `OvertimeBalance` model

**Files:**
- Create: `Datacore-Apple/Datacore/Models/OvertimeBalance.swift`

**Step 1: Create the model**

```swift
import Foundation

/// Server response from `GET /api/timecard/overtime-balance`.
struct OvertimeBalance: Codable, Sendable {
    let balanceSeconds: Int
    let expectedHours: Double
    let actualHours: Double
    let weekdaysElapsed: Int
    let isClockedIn: Bool
    let clockInTime: String?
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/OvertimeBalance.swift
git commit -m "feat(timecard): add OvertimeBalance model"
```

---

### Task 3: iOS — Add `Endpoint.timecardOvertimeBalance` case

**Files:**
- Modify: `Datacore-Apple/Datacore/Network/Endpoint.swift`

**Step 1: Add the endpoint case**

Add after `case timecardMonthlyTotal(id: Int)` (around line 139):

```swift
    case timecardOvertimeBalance            // GET /api/timecard/overtime-balance
```

**Step 2: Add the path mapping**

Add after the `timecardMonthlyTotal` path case (around line 353):

```swift
        case .timecardOvertimeBalance:                 return "/api/timecard/overtime-balance"
```

**Step 3: Commit**

```bash
git add Datacore/Network/Endpoint.swift
git commit -m "feat(timecard): add overtime-balance endpoint case"
```

---

### Task 4: iOS — Add `loadOvertimeBalance()` to `TimecardViewModel`

**Files:**
- Modify: `Datacore-Apple/Datacore/ViewModels/TimecardViewModel.swift`

**Step 1: Add state property**

Add after `var error: APIError?` (line 23):

```swift
    /// Live overtime balance snapshot from the server.
    var overtimeBalance: OvertimeBalance?
```

**Step 2: Add loader method**

Add after the `silentRefreshStatus()` method (after line 48):

```swift
    // MARK: - Overtime Balance

    func loadOvertimeBalance() async {
        do {
            overtimeBalance = try await APIClient.shared.get(.timecardOvertimeBalance)
        } catch {}
    }
```

**Step 3: Include in `loadAll()`**

Update `loadAll()` (line 236) to also load overtime balance. Add to the task group:

```swift
    func loadAll() async {
        isLoading = true
        error = nil
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadStatus() }
            group.addTask { await self.loadTodayEntries() }
            group.addTask { await self.loadOvertimeBalance() }
        }
        isLoading = false
    }
```

**Step 4: Reload balance after clock-in/out**

In `startTimer()` (around line 63), add to the task group:

```swift
            await withTaskGroup(of: Void.self) { group in
                group.addTask { await self.loadStatus() }
                group.addTask { await self.loadTodayEntries() }
                group.addTask { await self.loadOvertimeBalance() }
            }
```

Do the same in `stopTimer()` (around line 84):

```swift
            await withTaskGroup(of: Void.self) { group in
                group.addTask { await self.loadStatus() }
                group.addTask { await self.loadTodayEntries() }
                group.addTask { await self.loadOvertimeBalance() }
            }
```

**Step 5: Commit**

```bash
git add Datacore/ViewModels/TimecardViewModel.swift
git commit -m "feat(timecard): load overtime balance in TimecardViewModel"
```

---

### Task 5: iOS — Add overtime balance card to `TimecardDashboardTab`

**Files:**
- Modify: `Datacore-Apple/Datacore/Views/Timecard/TimecardDashboardTab.swift`

**Step 1: Add the overtime balance card to the dashboard VStack**

In the `body` ScrollView VStack (line 44), add `overtimeCard` between `timerCard` and `quickActions`:

```swift
            VStack(spacing: 16) {
                timerCard
                overtimeCard
                quickActions
                todaySummary
            }
```

**Step 2: Add the `overtimeCard` computed property**

Add this before the `// MARK: - Quick Actions` section (before line 151):

```swift
    // MARK: - Overtime Balance Card

    @ViewBuilder
    private var overtimeCard: some View {
        if let balance = vm.overtimeBalance {
            let isPositive = balance.balanceSeconds >= 0
            let color: Color = isPositive ? .green : .red
            let sign = isPositive ? "+" : "-"
            let absSeconds = abs(balance.balanceSeconds)

            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.title3)
                        .foregroundStyle(color)
                    Text("Overtime Balance")
                        .font(.headline)
                    Spacer()
                }

                if balance.isClockedIn {
                    // Live ticking balance
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let elapsed = Int(context.date.timeIntervalSinceNow)
                        // balance_seconds was computed at fetch time; add seconds since then
                        let liveBalance = balance.balanceSeconds + elapsed
                        let livePositive = liveBalance >= 0
                        let liveSign = livePositive ? "+" : "-"
                        let liveAbs = abs(liveBalance)
                        Text("\(liveSign)\(formatBalance(liveAbs))")
                            .font(.system(size: 36, weight: .light, design: .monospaced))
                            .foregroundStyle(livePositive ? .green : .red)
                    }
                } else {
                    Text("\(sign)\(formatBalance(absSeconds))")
                        .font(.system(size: 36, weight: .light, design: .monospaced))
                        .foregroundStyle(color)
                }

                Text("\(balance.weekdaysElapsed) weekdays × 8h = \(Int(balance.expectedHours))h expected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .padding()
            .background(.ultraThinMaterial, in: .rect(cornerRadius: 12))
        }
    }

    /// Format absolute seconds into "H:MM:SS".
    private func formatBalance(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%d:%02d:%02d", h, m, s)
    }
```

**Step 3: Reload overtime balance on foreground resume**

In `startAutoRefresh()` (line 293), add overtime balance refresh alongside the status refresh:

```swift
    private func startAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                guard !Task.isCancelled else { break }
                await vm.silentRefreshStatus()
                await vm.loadOvertimeBalance()
            }
        }
    }
```

**Step 4: Commit**

```bash
git add Datacore/Views/Timecard/TimecardDashboardTab.swift
git commit -m "feat(timecard): add live overtime balance card to dashboard"
```

---

### Task 6: watchOS — Add `WatchEndpoint.overtimeBalance` and model sharing

**Files:**
- Modify: `Datacore-Apple/DatacoreWatch/Network/WatchEndpoint.swift`

**Step 1: Add the endpoint case**

Add after `case timecardStop` (line 19):

```swift
    case timecardOvertimeBalance  // GET /api/timecard/overtime-balance
```

**Step 2: Add the path mapping**

Add after the `timecardStop` path case (around line 43):

```swift
        case .timecardOvertimeBalance:
            return "/api/timecard/overtime-balance"
```

**Step 3: Commit**

The `OvertimeBalance` model created in Task 2 needs to be shared with the watchOS target. Add the file path to `project.yml` under the `DatacoreWatch` target's sources (same pattern used for `TimecardStatus.swift`). The model is already `Codable` and `Sendable`.

```bash
git add DatacoreWatch/Network/WatchEndpoint.swift
# Also update project.yml to share OvertimeBalance.swift with watchOS target
git commit -m "feat(timecard): add watchOS overtime-balance endpoint"
```

---

### Task 7: watchOS — Add overtime balance to `WatchDataCache` and `WatchViewModel`

**Files:**
- Modify: `Datacore-Apple/DatacoreWatch/Cache/WatchDataCache.swift`
- Modify: `Datacore-Apple/DatacoreWatch/ViewModels/WatchViewModel.swift`

**Step 1: Add cache key and accessor to `WatchDataCache`**

Add a new cache key after `timecardStatus` (line 16):

```swift
        case overtimeBalance = "watch_overtime_balance"
```

Add a typed accessor after `timecardStatus` accessor (after line 118):

```swift
    static var overtimeBalance: OvertimeBalance? {
        get { decode(Key.overtimeBalance) }
        set { encode(newValue, key: Key.overtimeBalance) }
    }
```

**Step 2: Add state and loader to `WatchViewModel`**

Add state property after `var timecardStatus: TimecardStatus?` (line 16):

```swift
    var overtimeBalance: OvertimeBalance?
```

Add loader method after `loadTimecardStatus()` (after line 359):

```swift
    func loadOvertimeBalance() async {
        do {
            let balance: OvertimeBalance = try await WatchAPIClient.shared.get(.timecardOvertimeBalance)
            overtimeBalance = balance
            WatchDataCache.overtimeBalance = balance
        } catch {
            if let balance: OvertimeBalance = await fetchViaConnectivity("overtime-balance") {
                overtimeBalance = balance
                WatchDataCache.overtimeBalance = balance
            } else if overtimeBalance == nil {
                overtimeBalance = WatchDataCache.overtimeBalance
            }
        }
    }
```

**Step 3: Include in `refreshFromAPI()` task group**

Add to the task group in `refreshFromAPI()` (around line 121):

```swift
            group.addTask { await self.loadOvertimeBalance() }
```

**Step 4: Include in `loadFromCache()`**

Add after the `timecardStatus` cache load (around line 384):

```swift
        if let cached = WatchDataCache.overtimeBalance { overtimeBalance = cached }
```

**Step 5: Commit**

```bash
git add DatacoreWatch/Cache/WatchDataCache.swift DatacoreWatch/ViewModels/WatchViewModel.swift
git commit -m "feat(timecard): add overtime balance to watch cache and view model"
```

---

### Task 8: watchOS — Add overtime balance to `TimecardDetailView`

**Files:**
- Modify: `Datacore-Apple/DatacoreWatch/Views/TimecardDetailView.swift`

**Step 1: Add overtime section to the VStack**

In the body VStack (line 8), add `overtimeSection` between `statusCard` and the clockout button:

```swift
            VStack(spacing: 12) {
                statusCard
                overtimeSection
                if vm.timecardStatus?.active == true {
                    clockOutButton
                }
            }
```

**Step 2: Add the `overtimeSection` view**

Add before `// MARK: - Clock Out Button` (before line 68):

```swift
    // MARK: - Overtime Balance

    @ViewBuilder
    private var overtimeSection: some View {
        if let balance = vm.overtimeBalance {
            let isPositive = balance.balanceSeconds >= 0

            VStack(spacing: 4) {
                Text("OT Balance")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if balance.isClockedIn {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let elapsed = Int(context.date.timeIntervalSinceNow)
                        let live = balance.balanceSeconds + elapsed
                        let positive = live >= 0
                        Text(formatOT(live))
                            .font(.system(.title3, design: .monospaced))
                            .foregroundStyle(positive ? .green : .red)
                    }
                } else {
                    Text(formatOT(balance.balanceSeconds))
                        .font(.system(.title3, design: .monospaced))
                        .foregroundStyle(isPositive ? .green : .red)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal)
            .background(.ultraThinMaterial, in: .rect(cornerRadius: 12))
        }
    }

    private func formatOT(_ seconds: Int) -> String {
        let sign = seconds >= 0 ? "+" : "-"
        let abs = abs(seconds)
        let h = abs / 3600
        let m = (abs % 3600) / 60
        let s = abs % 60
        return "\(sign)\(h):\(String(format: "%02d", m)):\(String(format: "%02d", s))"
    }
```

**Step 3: Load overtime balance on appear**

Update the `.task` modifier (line 17) to also load overtime balance:

```swift
        .task {
            await vm.loadTimecardStatus()
            await vm.loadOvertimeBalance()
        }
```

**Step 4: Commit**

```bash
git add DatacoreWatch/Views/TimecardDetailView.swift
git commit -m "feat(timecard): add overtime balance to watch detail view"
```

---

### Task 9: watchOS — Add overtime balance to `TimecardComplication`

**Files:**
- Modify: `Datacore-Apple/DatacoreWatchComplications/TimecardComplication.swift`

**Step 1: Add overtime fields to `TimecardTimelineEntry`**

Add after `let startTime: Date?` (line 12):

```swift
    let overtimeBalanceSeconds: Int?
    let overtimeIsClockedIn: Bool
```

Update `placeholder` static (line 15):

```swift
    static var placeholder: TimecardTimelineEntry {
        TimecardTimelineEntry(
            date: .now,
            isActive: false,
            workType: "",
            workTypeAbbrev: "",
            workTypeLabel: "",
            startTime: nil,
            overtimeBalanceSeconds: nil,
            overtimeIsClockedIn: false,
            isPlaceholder: true
        )
    }

    static var notClockedIn: TimecardTimelineEntry {
        TimecardTimelineEntry(
            date: .now,
            isActive: false,
            workType: "",
            workTypeAbbrev: "",
            workTypeLabel: "",
            startTime: nil,
            overtimeBalanceSeconds: nil,
            overtimeIsClockedIn: false,
            isPlaceholder: false
        )
    }
```

**Step 2: Fetch overtime balance in `getTimeline()`**

In the `getTimeline` Task block (around line 66), after fetching timecard status, also fetch overtime balance:

```swift
            // Fetch overtime balance
            var otBalance: OvertimeBalance?
            do {
                otBalance = try await WatchAPIClient.shared.get(.timecardOvertimeBalance)
                WatchDataCache.overtimeBalance = otBalance
            } catch {
                otBalance = WatchDataCache.overtimeBalance
            }
```

Update the timeline entry construction loop (around line 84) to include overtime data:

```swift
            for offset in stride(from: 0, through: 240, by: 30) {
                let entryDate = Calendar.current.date(byAdding: .minute, value: offset, to: .now)!
                entries.append(TimecardTimelineEntry(
                    date: entryDate,
                    isActive: currentEntry.isActive,
                    workType: currentEntry.workType,
                    workTypeAbbrev: currentEntry.workTypeAbbrev,
                    workTypeLabel: currentEntry.workTypeLabel,
                    startTime: currentEntry.startTime,
                    overtimeBalanceSeconds: otBalance?.balanceSeconds,
                    overtimeIsClockedIn: otBalance?.isClockedIn ?? false,
                    isPlaceholder: false
                ))
            }
```

Also update the `getSnapshot` method to include the overtime fields. In the cache hit path (around line 56):

```swift
        if let cached = WatchDataCache.timecardStatus {
            let otBalance = WatchDataCache.overtimeBalance
            var e = entry(from: cached)
            e = TimecardTimelineEntry(
                date: e.date,
                isActive: e.isActive,
                workType: e.workType,
                workTypeAbbrev: e.workTypeAbbrev,
                workTypeLabel: e.workTypeLabel,
                startTime: e.startTime,
                overtimeBalanceSeconds: otBalance?.balanceSeconds,
                overtimeIsClockedIn: otBalance?.isClockedIn ?? false,
                isPlaceholder: false
            )
            completion(e)
            return
        }
```

Update the `entry(from:)` helper (around line 100) to include default overtime values:

```swift
    private func entry(from status: TimecardStatus) -> TimecardTimelineEntry {
        if status.active, let e = status.entry {
            let startTime = parseISO(e.startTime)
            return TimecardTimelineEntry(
                date: .now,
                isActive: true,
                workType: e.workType,
                workTypeAbbrev: abbreviation(for: e.workType),
                workTypeLabel: e.workTypeLabel,
                startTime: startTime,
                overtimeBalanceSeconds: nil,
                overtimeIsClockedIn: false,
                isPlaceholder: false
            )
        }
        return .notClockedIn
    }
```

**Step 3: Add overtime line to the rectangular complication view**

In the `rectangularView` (line 179), in the active timer branch (around line 196), add a third row for overtime below the existing Row 2:

```swift
            } else if entry.isActive, let startTime = entry.startTime {
                VStack(alignment: .leading, spacing: 1) {
                    // Row 1: green arrow + running timer
                    HStack(spacing: 4) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.green)
                        Text(startTime, style: .timer)
                            .font(.system(size: 32, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.green)
                            .minimumScaleFactor(0.7)
                            .frame(maxWidth: 140, alignment: .leading)
                    }

                    // Row 2: work type + OT balance
                    HStack {
                        Text(entry.workTypeLabel)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(1)
                        Spacer()
                        if let otSeconds = entry.overtimeBalanceSeconds {
                            Text("OT: \(formatOT(otSeconds))")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundStyle(otSeconds >= 0 ? .green : .red)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
```

Also add OT display to the not-clocked-in state (around line 224), showing the static balance:

```swift
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Timecard")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text("Off")
                        .font(.system(size: 24, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                    if let otSeconds = entry.overtimeBalanceSeconds {
                        Text("OT: \(formatOT(otSeconds))")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(otSeconds >= 0 ? .green : .red)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
```

**Step 4: Add the `formatOT` helper**

Add to `TimecardComplicationView` (before the closing brace):

```swift
    private func formatOT(_ seconds: Int) -> String {
        let sign = seconds >= 0 ? "+" : "-"
        let abs = abs(seconds)
        let h = abs / 3600
        let m = (abs % 3600) / 60
        let s = abs % 60
        return "\(sign)\(h):\(String(format: "%02d", m)):\(String(format: "%02d", s))"
    }
```

**Step 5: Commit**

```bash
git add DatacoreWatchComplications/TimecardComplication.swift
git commit -m "feat(timecard): add overtime balance to watch complication"
```

---

### Task 10: iPhone — Add WatchConnectivity relay for overtime balance

**Files:**
- Modify: `Datacore-Apple/Datacore/Network/PhoneConnectivityManager.swift`

**Step 1: Add the overtime-balance case to `handleRequest()`**

Add after the `"timecard-status"` case (around line 157):

```swift
        case "overtime-balance":
            let result: OvertimeBalance = try await APIClient.shared.get(.timecardOvertimeBalance)
            return try encoder.encode(result)
```

**Step 2: Commit**

```bash
git add Datacore/Network/PhoneConnectivityManager.swift
git commit -m "feat(timecard): add WatchConnectivity relay for overtime balance"
```

---

### Task 11: Update `project.yml` and verify builds

**Files:**
- Modify: `Datacore-Apple/project.yml` (share `OvertimeBalance.swift` with watchOS + complications targets)

**Step 1: Add `OvertimeBalance.swift` to shared model paths**

In `project.yml`, find the `DatacoreWatch` target sources section and add:

```yaml
      - path: ../Datacore/Models/OvertimeBalance.swift
```

Do the same for the `DatacoreWatchComplications` target sources.

**Step 2: Regenerate and build**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate

# Build iOS
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20

# Build macOS
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Fix any build errors until both targets produce zero errors**

**Step 4: Ask about version bump before committing**

**Step 5: Commit**

```bash
git add project.yml Datacore/Models/OvertimeBalance.swift
git commit -m "feat(timecard): share OvertimeBalance model with watchOS targets"
```
