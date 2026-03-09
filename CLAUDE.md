# Datacore - CLAUDE.md

## Multi-Project Setup: Web App + Native Apple Apps

Datacore has TWO codebases (three targets) that share the same Flask backend API:

| Project         | Path                                                                | Tech                             | Purpose                                          |
| --------------- | ------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| **Web App**     | `/Users/chaseburrell/Documents/VisualStudioCode/Personal_Database/` | React + Flask + PostgreSQL       | The main web dashboard (this repo)               |
| **iOS/Mac App** | `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/`    | SwiftUI (iOS 26+, Swift 6, MVVM) | Native Apple client consuming the same Flask API |
| **watchOS App** | `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/`    | SwiftUI (watchOS 26+, Swift 6)   | Apple Watch companion app (same Xcode project)   |

**How to direct Claude to the right project:**

- Default context is the **web app** (this repo). Web app work follows the dual-theme requirement below.
- To work on the **iOS app**, say "work on the Apple app" or "switch to the Xcode project" or reference the `Datacore-Apple` path. iOS work does NOT follow the dual-theme requirement — it uses native iOS 26 Liquid Glass via SwiftUI.
- The iOS/watchOS app is a **read-only API client** — it consumes the Flask REST API as-is. No backend changes are needed for Apple app features.
- When exploring iOS code, read files from `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/`.
- When exploring watchOS code, read files from `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/DatacoreWatch/`.
- The project uses `xcodegen` to generate the `.xcodeproj` from `project.yml`. After adding/removing Swift files, run `xcodegen generate` from the `Datacore-Apple` directory.

**Building and verifying Apple app changes:**

After modifying Swift files, always regenerate and build to catch compile errors:

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple

# 1. Regenerate Xcode project (required after adding/removing files)
xcodegen generate

# 2. Build iOS target (catches all Swift errors)
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20

# 3. Build macOS target (catches #if os(macOS) compilation issues)
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

The iOS build also compiles the watchOS and widget extension targets. If no `error:` lines appear, the build is clean. Warnings are expected (unused variables, deprecations) and can be ignored unless they indicate real issues.

**Available simulator destinations:** iPhone 17 Pro, iPhone 17 Pro Max, iPhone Air, iPad Air 11-inch (M3), iPad Pro 13-inch (M5). Use `xcodebuild -project Datacore.xcodeproj -scheme Datacore -showdestinations` for the full list.

**iOS App Architecture (quick reference):**

- `Datacore/Network/` — `APIClient` (actor, async/await), `Endpoint` enum (all API routes), `APIError`, `PhoneConnectivityManager` (WatchConnectivity relay, `#if os(iOS)` only)
- `Datacore/Models/` — Codable structs matching Flask `to_dict()` output (snake_case auto-converted)
- `Datacore/ViewModels/` — `@Observable @MainActor` classes, one per module
- `Datacore/Views/` — SwiftUI views organized by module (Dashboard, Vehicles, Notes, etc.)
- `Datacore/Views/Shared/` — Reusable components: `GlassCard`, `StatCard`, `LoadingView`, `ErrorView`, `EmptyStateView`, `CommandRail`, `LiveStatusBar`, `AdaptiveGrid`, `iPadSplitLayout`
- `Datacore/Config/ServerConfig.swift` — UserDefaults-backed server address
- Navigation: `TabView` (iPhone) / Command Center with `CommandRail` + `LiveStatusBar` (iPad)

**watchOS App Architecture (quick reference):**

- `DatacoreWatch/Network/` — `WatchAPIClient` (actor, shorter 10s/20s timeouts), `WatchEndpoint` enum, `WatchConnectivityManager` (fallback data relay from iPhone)
- `DatacoreWatch/Cache/` — `WatchDataCache` (App Group UserDefaults persistence for offline access)
- `DatacoreWatch/ViewModels/` — Single `WatchViewModel` managing all 4 modules (Vehicles, Fuel, Launches, Work Hours) with cache-first loading and concurrent API refresh via `withTaskGroup`
- `DatacoreWatch/Views/` — Compact watch views: `VehicleDetailView`, `FuelDetailView`, `FuelLogFormView`, `LaunchDetailView`, `WorkHoursDetailView`, `WorkHoursFormView`
- `DatacoreWatch/Complications/` — WidgetKit complications: `VehicleHealthComplication`, `FuelEconomyComplication`, `LaunchCountdownComplication`, `WorkHoursComplication`
- Navigation: Single `NavigationStack` with hub-and-spoke pattern (ContentView → detail views)
- Data flow: Direct API calls → WatchConnectivity fallback (iPhone relays API data to watch if direct connection fails)

**iOS iPad vs iPhone — Design Philosophy:**

The iOS app has two fundamentally different design philosophies based on device class, detected via `@Environment(\.horizontalSizeClass)` (`.regular` = iPad, `.compact` = iPhone). **No `UIDevice` checks** — only size class.

| Aspect                                 | iPhone (`.compact`)                                    | iPad (`.regular`)                                                         |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Philosophy**                         | Standard iOS mobile app                                | **Command Center** — dense, everything visible at a glance                |
| **Navigation**                         | `TabView` with tab bar                                 | `CommandRail` (60pt icon-only rail) + `LiveStatusBar` (36pt status strip) |
| **Dashboard**                          | Single-column scroll with hero card, weather, activity | **Bento grid** with 8-10 HUD-style panels covering every module           |
| **List modules** (Vehicles, Notes)     | `NavigationLink` push to detail                        | Persistent list + inline detail split (no push, detail updates in-place)  |
| **Data-heavy modules** (Fuel, Infra)   | Single-column stacked sections                         | Side-by-side panels, taller charts, all sections visible simultaneously   |
| **Grid modules** (Projects, Knowledge) | Single-column `List`                                   | 2-column `LazyVGrid` card grid                                            |
| **Astrometrics**                       | Segmented picker, one section at a time                | Full-width tabbed layout with labeled segments                            |
| **Title style**                        | `.navigationBarTitleDisplayMode(.large)`               | `.navigationBarTitleDisplayMode(.inline)` to save vertical space          |
| **Drill-down**                         | Standard push navigation                               | Inline detail panes or popovers                                           |
| **Data refresh**                       | Pull-to-refresh + silent 5-min auto-refresh            | Same, plus cross-module panel refresh (Astro, Trek, Infra)                |

**Key iPad architectural components:**

- **`CommandRail`** (`Views/Shared/CommandRail.swift`) — Narrow 60pt icon-only navigation rail replacing the sidebar. Badge dots for actionable states (red = overdue maintenance, etc.). Selection persisted via `@SceneStorage`.
- **`LiveStatusBar`** (`Views/Shared/LiveStatusBar.swift`) — Persistent 36pt bar showing weather, next launch countdown (`TimelineView`), infra health dot, notification count, clock.
- **`iPadSplitLayout`** (`Views/Shared/iPadSplitLayout.swift`) — Reusable left/right pane split helper for list+detail patterns.
- **`AdaptiveGrid`** (`Views/Shared/AdaptiveGrid.swift`) — Reusable 2-column/1-column grid helper + custom `isIPad` environment key.

**iPad implementation pattern for new modules:**
Every view that needs iPad adaptation should branch in the `body`:

```swift
@Environment(\.horizontalSizeClass) private var sizeClass

var body: some View {
    Group {
        if sizeClass == .regular {
            iPadLayout    // Dense, multi-panel
        } else {
            iPhoneLayout  // Standard single-column
        }
    }
    .navigationBarTitleDisplayMode(sizeClass == .regular ? .inline : .large)
}
```

iPhone layouts must remain completely unchanged when adding iPad layouts. Extract shared subviews and recompose them differently per device.

**iPad glass effect pitfalls:**

- `.glassEffect(.regular.interactive())` creates Liquid Glass bubbles that **intercept taps** — don't use on cards that contain `NavigationLink`. Use `.background(.ultraThinMaterial, in: .rect(cornerRadius: 12))` instead for tap-through cards.
- Separate `.glassEffect()` calls on adjacent views create **visible background seams**. Use `.ultraThinMaterial` for elements that need to look continuous (e.g., CommandRail + LiveStatusBar).

**Quad-Platform Requirement (Mac, iPad, iPhone, Apple Watch):**

The Apple app has FOUR first-class platforms that must stay in sync:

| Platform        | Shell                                                 | Navigation                                                        | Styling                             |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| **Mac**         | `NavigationSplitView` + `MacSidebar` + `MacToolbar`   | Sidebar with sections, HSplitView for list+detail modules         | Native AppKit materials             |
| **iPad**        | `NavigationSplitView` + `iPadSidebar` + `iPadToolbar` | Identical to Mac — same sidebar, same toolbar, same split layouts | Liquid Glass (automatic via iOS 26) |
| **iPhone**      | `TabView` (5 tabs + More)                             | Standard push navigation                                          | Liquid Glass (automatic via iOS 26) |
| **Apple Watch** | `NavigationStack` (hub-and-spoke)                     | ContentView hub → detail views                                    | Compact watchOS styling             |

**Key rules:**

- Mac and iPad share identical layout patterns (sidebar, toolbar, split panes, context menus). Any change to one must be applied to the other.
- iPhone is a separate mobile-first design and does NOT need to match Mac/iPad.
- Apple Watch is a minimal companion — only core data-at-a-glance modules (Vehicles, Fuel, Launches, Work Hours). Not every module needs a watch variant, but data-centric modules should be considered.
- When adding a new module, implement Mac, iPad, and iPhone variants. Evaluate whether the module warrants an Apple Watch view (quick-glance data or simple input actions are good candidates).
- The Mac uses `#if os(macOS)` wrappers; iPad uses `sizeClass == .regular` branching; watchOS code lives in the separate `DatacoreWatch/` target directory.
- Toolbar actions use `NotificationCenter` to communicate with module views (shared notification names in `DatacoreNotifications.swift`).
- Module views with list+detail patterns: use `HSplitView` on Mac, `HStack` on iPad (same visual result).

**Apple Watch implementation pattern for new modules:**

- Add a new `WatchEndpoint` case in `DatacoreWatch/Network/WatchEndpoint.swift`
- Add a loader method in `WatchViewModel` with WatchConnectivity fallback
- Add a cache accessor in `WatchDataCache` for offline persistence
- Create a compact detail view in `DatacoreWatch/Views/`
- If applicable, create a WidgetKit complication in `DatacoreWatch/Complications/`
- Add a corresponding handler in `PhoneConnectivityManager.handleRequest()` for iPhone relay fallback
- Shared model files are included via `project.yml` path references — no code duplication needed

**Auto-refresh:**
The dashboard silently refreshes all data every 5 minutes via `DashboardViewModel.silentRefresh()` (no loading indicators, no error overlays). Pauses when backgrounded, resumes with an immediate refresh when the app returns to foreground. Only applies to the Dashboard — other modules refresh on pull-down or navigation.

**iOS SwiftUI Coding Standards:**

- **Picker style:** Always use `.pickerStyle(.menu)` on `Picker` controls (unless you explicitly want `.segmented`). SwiftUI's default `List` row picker style hijacks row taps — tapping anywhere in a `List` row activates the first unstyled `Picker`, which causes controls to open unexpectedly. `.menu` style makes each picker handle its own taps via an inline dropdown, preventing this.
- **UserDefaults + @Observable:** Never use computed properties that read/write UserDefaults directly on an `@Observable` class. The observation system can't track computed getters. Instead, use a stored property initialized from UserDefaults with a `didSet` that syncs back: `var myPref: Int? = { UserDefaults.standard... }() { didSet { UserDefaults.standard.set(...) } }`.
- **Tap isolation in List rows:** When embedding interactive controls (Toggles, Pickers, TextFields) inside expandable `List` rows, add `.contentShape(Rectangle())` and `.onTapGesture {}` to non-interactive container VStacks. This prevents stray taps from propagating up to the `List` row and accidentally activating controls.
- **No Steppers:** Never use `Stepper` for numeric inputs. Use a `TextField` with `.keyboardType(.numberPad)` and a trailing unit label instead. Steppers require tedious +/- tapping — a text field lets the user type the value directly. Pattern: `HStack { Text("Label"); Spacer(); TextField("0", text: $value).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 60); Text("unit").foregroundStyle(.secondary).font(.subheadline) }`
- **iPad size class detection:** Always use `@Environment(\.horizontalSizeClass)` — never `UIDevice.current`. The size class changes dynamically in Split View / Slide Over multitasking.
- **iPad title style:** Use `.navigationBarTitleDisplayMode(sizeClass == .regular ? .inline : .large)` on all module root views to save vertical space on iPad.

**watchOS SwiftUI Coding Standards:**

- **Picker style:** Use `.pickerStyle(.navigationLink)` on watchOS — `.menu` is not available.
- **WatchConnectivity guards:** `WatchConnectivity` is only available on iOS and watchOS. Any code using `WCSession` must be guarded with `#if os(iOS)` or `#if os(watchOS)`. The Mac target includes all files under `Datacore/`, so unguarded WatchConnectivity imports will break the macOS build.
- **Swift 6 strict concurrency with WCSession:** `replyHandler` closures from `didReceiveMessage` cannot be directly captured in `Task` blocks (Swift 6 `sending` parameter error). Use a `SendableBox<T>: @unchecked Sendable` wrapper struct to safely capture the closure. See `PhoneConnectivityManager.swift` for the pattern.
- **UserDefaults concurrency:** `UserDefaults` is not `Sendable`. For static properties on watch cache types, use `nonisolated(unsafe) static let defaults` to satisfy Swift 6 strict concurrency.
- **Shared model files:** The watchOS target shares model files with the iOS target via `project.yml` include paths (e.g., `Vehicle.swift`, `DashboardStats.swift`, `Astrometrics.swift`). Don't duplicate model code — add the file path to the `DatacoreWatch` target sources in `project.yml`.
- **Timeout values:** Watch API calls use shorter timeouts (10s for normal requests, 20s for large payloads) since cellular/WiFi connections on watch are less reliable. See `WatchAPIClient`.
- **App Group:** Both the iOS app and watchOS app share the `group.com.chaseburrell.datacore` App Group for UserDefaults data sharing and WatchConnectivity.

---

## Important Notes for Agents

**IMPORTANT: Dual-Theme Requirement (BOTH themes must have parity)**
Every new feature, page, or component MUST be implemented in BOTH themes:

1. **Catppuccin Mocha** (default) — the standard dark theme using CSS variables and `.card`/`.btn` classes. Located in `frontend/src/pages/`.
2. **LCARS** (Star Trek) — a fully custom theme that mimics the LCARS operating system aesthetic. LCARS versions are NOT simple reskins. They must be purpose-built components in `frontend/src/themes/lcars/` that use LCARS panels, color variables (`--lcars-*`), the Antonio font, pill-shaped buttons, and the distinctive LCARS layout language (elbows, cascades, horizontal rule segments). Study existing LCARS components before building new ones to match the visual language.

Never ship a feature in only one theme. If you build `pages/NewFeature.jsx`, you must also build:

- `themes/lcars/LCARSNewFeature.jsx` (LCARS version)
  And wire it up in `App.jsx` (LCARSAppShell routes).

---

**IMPORTANT**: Interview-Driven Development
Before generating any plan or writing any code, conduct a minimum of 3-4 rounds of clarifying questions. Each round should focus on a different dimension:

Intent & Scope — What exactly are we building and what's explicitly out of scope?
Edge Cases & Constraints — What happens when things go wrong? What are the performance/compatibility requirements?
Integration & Dependencies — How does this connect to existing code, APIs, or infrastructure?
UX & Behavior — What should the user actually experience? What are the expected inputs/outputs?

Do not assume answers to any of these. Even if something seems obvious, ask — my answer may surprise you.

Assumption Surfacing
Whenever you're about to make a design decision or assumption, stop and state it explicitly before proceeding. Frame it as: "I'm about to assume X — is that correct, or do you want Y instead?" Never silently choose a default.

Plan Before Code
Never jump straight to implementation. Present a structured plan with the proposed file structure, key functions/components, and data flow. Wait for my explicit approval before writing any code. If the plan changes mid-implementation, pause and re-confirm.

Incremental Delivery
Break work into small, testable chunks. After each chunk, check in with me before continuing. Don't build the entire thing in one shot — I want to course-correct early, not after 500 lines.

Challenge My Ideas
If you see a better approach than what I'm describing, push back. Explain the tradeoff. Don't just comply — act as a senior engineer doing a design review. If my approach has footguns, call them out before implementing.

Error Anticipation
For every function or module, proactively think through: what fails here? Add error handling, input validation, and logging by default — don't wait for me to ask for it.

Token Efficiency — Delegate Verification to Me
Minimize unnecessary token consumption by defaulting to telling me what commands to run rather than running them yourself, especially for:

Build/compile steps
Test suites
Server startup and log monitoring
Database migrations or seed operations
Any command that produces verbose output

Tell me exactly what to run and what to look for in the output. I'll report back with only the relevant lines (errors, warnings, or confirmation of success). Only run commands directly when the output is short and essential for your next decision, or when I explicitly ask you to.
When you do need to run commands, prefer targeted checks (e.g., grep for a specific error, tail -n 20, checking a single value) over broad ones (e.g., cat-ing entire log files, running full test suites just to check one thing).
Similarly, when reading files for context, read only the relevant sections or line ranges — don't ingest entire files when you only need to understand one function or block.

## Project Overview

Datacore is a self-hosted personal dashboard and database application. It's a modular web app where each "module" is a self-contained feature area (vehicles, notes, fuel economy, notifications, etc.) with its own database models, API endpoints, and frontend pages. The user accesses it via a web browser. The app supports two switchable themes: Catppuccin Mocha (default) and LCARS (Star Trek computer interface).

**Owner:** Chase — has minimal Python experience, learning React. Explain things clearly and comment code well.

## Architecture

- **Backend:** Python 3.12, Flask, SQLAlchemy ORM, PostgreSQL
- **Frontend:** React 19 (Vite), React Router v7, Tailwind CSS v4, Lucide icons
- **Theming:** Dual-theme system via `ThemeProvider.jsx` — Catppuccin Mocha + LCARS
- **Mobile:** Responsive down to 375px via `useIsMobile()` hook + CSS utility classes
- **Infrastructure:** Docker Compose for local dev, GitHub Actions builds images to GHCR, deployed on HexOS (TrueNAS-based) via Dockge

## Project Structure

```
datacore/
├── docker-compose.yml              # Dev: builds from source with volume mounts
├── docker-compose.prod.yml         # Prod: uses pre-built GHCR images for Dockge
├── .env.example                    # Environment variable template
├── .github/workflows/
│   └── docker-build.yml            # Auto-builds Docker images on push to main
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── run.py                      # Entry point
│   └── app/
│       ├── __init__.py             # Flask app factory, registers all blueprints
│       ├── config.py               # Config from environment variables
│       ├── models/
│       │   ├── vehicle.py          # Vehicle, MaintenanceLog, FuelLog, TireSet, Component, ComponentLog
│       │   ├── note.py             # Note model
│       │   ├── notification.py     # NotificationRule, NotificationHistory, NotificationPreferences
│       │   └── maintenance_interval.py  # MaintenanceInterval (service intervals)
│       └── routes/
│           ├── dashboard.py        # Weather proxy + summary stats + fleet status
│           ├── vehicles.py         # Full CRUD for vehicles, maintenance, fuel, tires, components
│           ├── notes.py            # Full CRUD with search/filter/pin
│           ├── fuel.py             # Fuel log endpoints
│           └── notifications.py    # Notification rules, history, preferences, channels
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js              # Vite config with API proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── index.css               # Global styles, Catppuccin theme, responsive utilities
│       ├── App.jsx                 # Router, sidebar layout, mobile hamburger drawer
│       ├── api/
│       │   └── client.js           # API helper (all backend calls go through here)
│       ├── hooks/
│       │   └── useIsMobile.js      # Responsive breakpoint hook (768px)
│       ├── components/             # Shared components (used by BOTH themes)
│       │   ├── MaintenanceForm.jsx
│       │   ├── FuelForm.jsx
│       │   ├── TireSetForm.jsx
│       │   ├── TireSetCard.jsx
│       │   ├── ComponentForm.jsx
│       │   ├── ComponentCard.jsx
│       │   ├── ComponentLogForm.jsx
│       │   ├── ServiceIntervalsTab.jsx
│       │   ├── NotificationBell.jsx
│       │   ├── Tooltip.jsx
│       │   └── weatherCodes.js     # WMO weather code mapping
│       ├── pages/                  # Catppuccin theme pages
│       │   ├── Dashboard.jsx
│       │   ├── Vehicles.jsx
│       │   ├── VehicleDetail.jsx   # Tabs: maintenance, fuel, tires, components, service intervals
│       │   ├── Notes.jsx
│       │   ├── FuelEconomy.jsx     # Fleet-wide fuel analytics with charts
│       │   ├── FuelEntry.jsx       # Standalone fuel log entry page
│       │   ├── Notifications.jsx   # Notification settings parent page
│       │   └── notifications/      # Notification sub-pages
│       │       ├── GeneralTab.jsx
│       │       ├── RulesTab.jsx
│       │       ├── RuleForm.jsx
│       │       ├── ChannelsTab.jsx
│       │       ├── ChannelForm.jsx
│       │       ├── IntervalsTab.jsx
│       │       └── HistoryTab.jsx
│       └── themes/
│           ├── lcars/              # LCARS theme (Star Trek)
│           │   ├── ThemeProvider.jsx    # Theme switcher (manages both themes)
│           │   ├── LCARSLayout.jsx     # Grid frame: elbows, sidebar, header, footer
│           │   ├── LCARSLayout.css     # CSS Grid for LCARS frame + mobile overrides
│           │   ├── lcars-variables.css  # LCARS color palette (--lcars-*)
│           │   ├── lcars-components.css # Shared LCARS component styles
│           │   ├── lcars-animations.css # LCARS-specific animations
│           │   ├── LCARSElbow.jsx      # Corner elbow decorations
│           │   ├── LCARSHeader.jsx     # Top bar with notification dropdown
│           │   ├── LCARSFooter.jsx     # Bottom bar with stardate/UTC
│           │   ├── LCARSSidebar.jsx    # Left nav with pill buttons
│           │   ├── LCARSMobileNav.jsx  # Bottom nav bar (mobile only)
│           │   ├── LCARSDataCascade.jsx # Animated data stream decoration
│           │   ├── LCARSBootSequence.jsx # Startup animation
│           │   ├── LCARSPanel.jsx      # Reusable panel component
│           │   ├── LCARSModal.jsx      # Modal with LCARS styling
│           │   ├── LCARSDashboard.jsx  # 8-panel dashboard
│           │   ├── LCARS<Page>.jsx     # Per-page LCARS implementations
│           │   └── settings/           # LCARS settings sub-pages
```

## How to Add a New Module

This is the most common task. Follow this pattern:

### 1. Create the database model

Create `backend/app/models/<module_name>.py`:

- Define a SQLAlchemy model class with columns
- Add a `to_dict()` method for JSON serialization
- Import it in `backend/app/models/__init__.py`

### 2. Create API routes

Create `backend/app/routes/<module_name>.py`:

- Create a Flask Blueprint
- Add CRUD endpoints (GET list, GET single, POST create, PUT update, DELETE)
- Register the blueprint in `backend/app/__init__.py` under the "Register Modules" section

### 3. Add API client functions

Add a new section in `frontend/src/api/client.js`:

- Export an object with list/get/create/update/delete functions

### 4. Create frontend pages (BOTH themes)

**Catppuccin version:**

- Create page components in `frontend/src/pages/`
- Add routes in `frontend/src/App.jsx` (AppShell)
- Add sidebar nav link in `App.jsx`
- Add a summary card on `Dashboard.jsx`

**LCARS version (required):**

- Create `frontend/src/themes/lcars/LCARS<ModuleName>.jsx`
- Use `LCARSPanel` for content sections, LCARS color variables, Antonio font
- Register the component in `App.jsx` (LCARSAppShell routes)
- Add nav entry in `LCARSSidebar.jsx` and `LCARSMobileNav.jsx`
- Add a summary panel on `LCARSDashboard.jsx`

### 5. Ensure mobile responsiveness

- Use `className="form-grid-2col"` or `"form-grid-3col"` for form layouts (NOT inline grid styles)
- Use `min()` for modal max-widths: `maxWidth: 'min(500px, calc(100vw - 2rem))'`
- Use `100dvh` instead of `100vh` for full-height layouts
- For data-dense tables, provide a card-view alternative on mobile using `useIsMobile()`

## Design System

### Catppuccin Mocha Theme (default)

Key CSS variables defined in `frontend/src/index.css`:

- Backgrounds: `--color-crust`, `--color-mantle`, `--color-base`
- Text: `--color-text`, `--color-subtext-0`, `--color-subtext-1`
- Accents: `--color-blue`, `--color-green`, `--color-peach`, `--color-red`, `--color-mauve`, `--color-yellow`, `--color-teal`
- Surfaces: `--color-surface-0`, `--color-surface-1`, `--color-surface-2`

Fonts: **Outfit** for UI text, **JetBrains Mono** for code/monospace.
Reusable CSS classes: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`

### LCARS Theme (Star Trek)

LCARS variables defined in `frontend/src/themes/lcars/lcars-variables.css`:

- Colors: `--lcars-gold`, `--lcars-sunflower`, `--lcars-tanoi`, `--lcars-african-violet`, `--lcars-lilac`, `--lcars-rust`, `--lcars-red-alert`, etc.
- Font: **Antonio** (tall, narrow — the canonical LCARS typeface)
- Layout: CSS Grid frame with elbows, sidebar, header/footer bars, cascade column
- Components: `LCARSPanel` for content sections, `LCARSModal` for dialogs, pill-shaped buttons
- Visual language: Rounded rectangles, horizontal rule segments, data cascade animation, boot sequence

### Responsive Utilities (all themes)

Defined in `index.css`, collapse to single column at 768px:

- `.form-grid-2col` — 2-column form grid
- `.form-grid-3col` — 3-column form grid
- `.card-grid` — auto-fit card grid (`minmax(280px, 1fr)`)

Mobile navigation:

- Catppuccin: Hamburger icon in header opens a slide-out drawer overlay
- LCARS: Bottom pill-button nav bar (`LCARSMobileNav.jsx`)

## API Conventions

- All API routes are prefixed with `/api/<module_name>/`
- JSON request/response bodies
- `to_dict()` on models for serialization
- `get_or_404()` for single-item lookups
- Required fields return 400 with `{"error": "message"}`
- Vite proxies `/api/*` to Flask in dev mode

### Form Pattern (Important!)

When creating form components that appear in modals:

- **The form should NOT call the API directly**
- Pass form data to parent via `onSubmit(data)` callback
- The parent page (e.g., VehicleDetail) handles the API call
- This prevents double-submission bugs where both form and parent try to create the same resource

**Incorrect pattern (causes double-submit):**

```jsx
// Form calls API AND calls onSubmit()
async function handleSubmit() {
  await api.create(data); // First API call
  onSubmit(); // Parent also calls api.create()
}
```

**Correct pattern:**

```jsx
// Form just passes data to parent
function handleSubmit() {
  onSubmit(data); // Parent handles API call
}
```

### Docker + Dependencies (CRITICAL)

This project runs in Docker with volume mounts. The `node_modules` directory lives **inside the container**, protected by an anonymous volume (`/app/node_modules` in `docker-compose.yml`). This means:

- **Editing `package.json` on the host does NOT install packages inside the container.** The container's `node_modules` is isolated from the host filesystem.
- **Editing `requirements.txt` on the host does NOT install Python packages inside the container.** Same principle.

**When adding new npm or Python dependencies:**

1. Edit `frontend/package.json` (npm) or `backend/requirements.txt` (pip) to add the dependency
2. Commit and push to `main` — GitHub Actions will rebuild the Docker images with the new dependency
3. In Dockge, pull the updated images and restart the stack

**Never assume that editing a dependency manifest file is sufficient.** Dependencies are installed during the Docker image build, so the image must be rebuilt and redeployed. Remind the user to push, wait for the GitHub Actions build, and redeploy in Dockge.

**Important:** Verify pip package names carefully. The PyPI package name (what you `pip install`) is not always the same as the import name (what you `import` in Python). For example, the `apns2` module is installed via `pip install apns2`, NOT `pip install PyAPNs2` (which is a different package).

## Key Technical Decisions

- **Weather:** Uses Open-Meteo API (free, no key). Proxied through Flask so frontend doesn't make external calls directly.
- **Tags on notes:** Stored as comma-separated string for simplicity. Can migrate to many-to-many table later if needed.
- **Database:** Tables auto-created on Flask startup via `db.create_all()`. For production schema changes, use Flask-Migrate (alembic).
- **No auth yet:** This is a personal, local-network-only app. Authentication can be added later if needed.
- **Theming:** `ThemeProvider.jsx` wraps the app and manages two themes: Catppuccin and LCARS. `App.jsx` renders the appropriate AppShell (AppShell or LCARSAppShell) based on the active theme. Theme preference is stored in localStorage as `'datacore-theme'`. The `.lcars-theme` class is added to `<html>` to enable CSS overrides.
- **Mobile viewport:** Uses `100dvh` (not `100vh`) to account for mobile browser chrome (Safari toolbar).
- **Responsive grids:** CSS utility classes (`.form-grid-2col`, `.form-grid-3col`) instead of inline styles, so `@media` queries can collapse columns on mobile.

## Infrastructure & Deployment

**We do NOT test locally.** All testing and deployment happens on the live production server.

### Server Setup

- **Server:** HexOS (TrueNAS SCALE-based)
- **Container orchestration:** Dockge (installed as a HexOS app), running Docker Compose
- **Image registry:** GitHub Container Registry (GHCR) — images are built by GitHub Actions on push to `main`
- **Stack name in Dockge:** `life-hub-main`

### Container Names

| Container                | Name                       |
| ------------------------ | -------------------------- |
| Database (PostgreSQL)    | `life-hub-main-db-1`       |
| Backend (Flask/Gunicorn) | `life-hub-main-backend-1`  |
| Frontend (Vite/Nginx)    | `life-hub-main-frontend-1` |

### Deployment Workflow

1. Make code changes locally and push to `main`
2. GitHub Actions builds Docker images and pushes to GHCR
3. In Dockge, pull the latest images and restart the stack
4. Check backend logs for errors: `docker logs life-hub-main-backend-1 --tail 100`

### Useful Commands (run on the HexOS server or via Dockge terminal)

```bash
# View backend logs (most common for debugging)
docker logs life-hub-main-backend-1 --tail 100 -f

# View frontend logs
docker logs life-hub-main-frontend-1 --tail 50

# Check if all containers are healthy
docker ps --filter "name=life-hub-main"

# Execute a command inside the backend container
docker exec -it life-hub-main-backend-1 <command>

# Check database connectivity
docker exec life-hub-main-db-1 pg_isready -U lifehub
```

### Volume Mounts (Production)

The backend container has these host mounts configured in Dockge:

- `uploads:/app/uploads` — User-uploaded files (vehicle images, etc.)
- `/mnt/SSDs/datacore/apns-certs:/app/certs:ro` — APNs .p8 key file for push notifications
- `/var/run/docker.sock:/var/run/docker.sock` — Docker API access for infrastructure module
- `/proc:/host/proc:ro` — Host /proc for system stats
- `/sys:/host/sys:ro` — Host /sys for hardware detection

**Important:** When adding features that require host files (certificates, keys, data files), always ensure a volume mount exists in the Dockge compose config. Setting an env var pointing to a host path is not enough — the file must be mounted into the container.

## Watch Data Pipeline

The Watch Data Pipeline is a full-stack system for collecting health/sensor data from Apple Watch and displaying it across all platforms.

**Architecture:** Watch sensors → iPhone relay (WCSession) → Flask Backend API → React Frontend + Native SwiftUI views

**Database Tables (7):**

- `watch_health_samples` — HealthKit data (heart rate, SpO2, steps, etc.)
- `watch_barometer_readings` — Atmospheric pressure + altitude
- `watch_nfc_events` — NFC tag scan history
- `watch_nfc_action_definitions` — User-defined NFC tag → action mappings
- `watch_nfc_timers` — Active timers triggered by NFC scans
- `watch_spatial_readings` — UWB/NearbyInteraction proximity data
- `watch_sync_status` — Per-device sync tracking and diagnostics

**API Endpoints:** 14 endpoints under `/api/watch/` (see `backend/app/routes/watch.py`)

**React Routes (7):**

- `/watch` — Overview dashboard
- `/watch/health` — Health metrics list
- `/watch/health/:metricType` — Per-metric detail view
- `/watch/nfc` — NFC tag management
- `/watch/barometer` — Barometer readings
- `/watch/spatial` — Spatial proximity data
- `/watch/sync` — Sync status and diagnostics

**Key File Locations:**
| Layer | Path |
|-------|------|
| Backend models | `backend/app/models/watch.py` |
| Backend routes | `backend/app/routes/watch.py` |
| Migration | `backend/migrations/versions/add_watch_tables.py` |
| React API client | `frontend/src/api/watchApi.js` |
| Catppuccin pages | `frontend/src/pages/Watch*.jsx` |
| LCARS pages | `frontend/src/themes/lcars/LCARSWatch*.jsx` |
| iOS/iPad/Mac views | `Datacore-Apple/Datacore/Views/Watch/` |
| iOS ViewModel | `Datacore-Apple/Datacore/ViewModels/WatchPipelineViewModel.swift` |
| watchOS sensors | `Datacore-Apple/DatacoreWatch/Sensors/` |
| watchOS views | `Datacore-Apple/DatacoreWatch/Views/Watch*.swift` |
| Shared models | `Datacore-Apple/DatacoreShared/Models/` |
| Shared components | `Datacore-Apple/DatacoreShared/ViewComponents/` |
| Shared constants | `Datacore-Apple/DatacoreShared/Constants.swift` |
| iPhone sync engine | `Datacore-Apple/Datacore/Sync/PhoneSessionManager.swift` |
| Background tasks | `Datacore-Apple/Datacore/Sync/BackgroundTaskManager.swift` |
| HealthKit manager | `Datacore-Apple/Datacore/HealthKit/HealthKitManager.swift` |

**Key Design Decisions:**

- UUID-based deduplication — every sample has a UUID; backend uses upsert to prevent duplicates
- Batch sync — samples are buffered and sent in batches to reduce API calls
- No foreign keys to other modules — watch data is self-contained, no FK to vehicles/notes/etc.
- Idempotent upserts — all sync endpoints use INSERT ON CONFLICT UPDATE for safe retries
- WatchConnectivity relay — watch sends data to iPhone via WCSession, iPhone forwards to Flask API
- Offline queue — failed API calls are queued locally and retried on next sync cycle

## Current Status

### What's built:

- Dashboard with weather widget (5-day forecast) and module summary cards
- Vehicles module: add/edit vehicles, full maintenance log CRUD, fuel logging, tire set management, component tracking, service intervals
- Notes module: create/edit/delete, search, category filter, pin to top
- Fuel Economy module: fleet-wide analytics with charts (MPG trends, cost analysis), per-vehicle breakdowns, standalone fuel entry page
- Notifications module: configurable rules, channels, history, quiet hours, in-app bell with dropdown
- LCARS theme: full Star Trek computer interface with boot sequence, 8-panel dashboard, elbows/cascade/sidebar frame, all vehicle pages, fuel economy, service intervals
- Dual-theme system with localStorage preference and seamless switching
- Mobile-responsive: hamburger nav (Catppuccin), bottom nav (LCARS), collapsing form grids, card views for tables, viewport-safe modals
- Sidebar navigation with collapsible toggle
- Docker Compose for dev and prod
- GitHub Actions CI/CD pipeline
- **Apple Watch companion app:** 4 modules (Vehicle Health, Fuel Economy, Launch Countdown, Work Hours), WidgetKit complications (4 types), WatchConnectivity iPhone↔Watch data relay, offline caching via App Group UserDefaults, hub-and-spoke navigation, write actions (log fuel, mark service done, log work hours)
- **Watch Data Pipeline:** Full-stack health/sensor data system — HealthKit, barometer, NFC, UWB spatial — flowing from Watch → iPhone → Flask API → React + native SwiftUI views across all 4 Apple platforms

### Planned future modules/features:

- Finance/expense tracking
- Project/task management
- Inventory/collections tracking
- Dashboard activity feed (recent actions across all modules)
- Data export/backup functionality
- Inline editing on vehicle details (currently need to use API directly to edit vehicle info)
