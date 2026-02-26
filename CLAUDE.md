# Datacore - CLAUDE.md

## Multi-Project Setup: Web App + Native iOS App

Datacore has TWO codebases that share the same Flask backend API:

| Project | Path | Tech | Purpose |
|---------|------|------|---------|
| **Web App** | `/Users/chaseburrell/Documents/VisualStudioCode/Personal_Database/` | React + Flask + PostgreSQL | The main web dashboard (this repo) |
| **iOS App** | `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/` | SwiftUI (iOS 26+, Swift 6, MVVM) | Native Apple client consuming the same Flask API |

**How to direct Claude to the right project:**
- Default context is the **web app** (this repo). Web app work follows the triple-theme requirement below.
- To work on the **iOS app**, say "work on the Apple app" or "switch to the Xcode project" or reference the `Datacore-Apple` path. iOS work does NOT follow the triple-theme requirement — it uses native iOS 26 Liquid Glass via SwiftUI.
- The iOS app is a **read-only API client** — it consumes the Flask REST API as-is. No backend changes are needed for iOS features.
- When exploring iOS code, read files from `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/`.
- The iOS project uses `xcodegen` to generate the `.xcodeproj` from `project.yml`. After adding/removing Swift files, run `xcodegen generate` from the `Datacore-Apple` directory.
- To type-check iOS code without a simulator: use `swiftc -typecheck -sdk ...iPhoneSimulator.sdk -target arm64-apple-ios26.0-simulator`.

**iOS App Architecture (quick reference):**
- `Datacore/Network/` — `APIClient` (actor, async/await), `Endpoint` enum (all API routes), `APIError`
- `Datacore/Models/` — Codable structs matching Flask `to_dict()` output (snake_case auto-converted)
- `Datacore/ViewModels/` — `@Observable @MainActor` classes, one per module
- `Datacore/Views/` — SwiftUI views organized by module (Dashboard, Vehicles, Notes, etc.)
- `Datacore/Views/Shared/` — Reusable components: `GlassCard`, `StatCard`, `LoadingView`, `ErrorView`, `EmptyStateView`
- `Datacore/Config/ServerConfig.swift` — UserDefaults-backed server address
- Navigation: `TabView` (iPhone) / `NavigationSplitView` (iPad), both get native Liquid Glass on iOS 26

**iOS SwiftUI Coding Standards:**

- **Picker style:** Always use `.pickerStyle(.menu)` on `Picker` controls (unless you explicitly want `.segmented`). SwiftUI's default `List` row picker style hijacks row taps — tapping anywhere in a `List` row activates the first unstyled `Picker`, which causes controls to open unexpectedly. `.menu` style makes each picker handle its own taps via an inline dropdown, preventing this.
- **UserDefaults + @Observable:** Never use computed properties that read/write UserDefaults directly on an `@Observable` class. The observation system can't track computed getters. Instead, use a stored property initialized from UserDefaults with a `didSet` that syncs back: `var myPref: Int? = { UserDefaults.standard... }() { didSet { UserDefaults.standard.set(...) } }`.
- **Tap isolation in List rows:** When embedding interactive controls (Toggles, Pickers, TextFields) inside expandable `List` rows, add `.contentShape(Rectangle())` and `.onTapGesture {}` to non-interactive container VStacks. This prevents stray taps from propagating up to the `List` row and accidentally activating controls.
- **No Steppers:** Never use `Stepper` for numeric inputs. Use a `TextField` with `.keyboardType(.numberPad)` and a trailing unit label instead. Steppers require tedious +/- tapping — a text field lets the user type the value directly. Pattern: `HStack { Text("Label"); Spacer(); TextField("0", text: $value).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 60); Text("unit").foregroundStyle(.secondary).font(.subheadline) }`

---

## Important Notes for Agents

**IMPORTANT: Triple-Theme Requirement (ALL THREE themes must have parity)**
Every new feature, page, or component MUST be implemented in ALL THREE themes:

1. **Catppuccin Mocha** (default, may be deprecated) — the standard dark theme using CSS variables and `.card`/`.btn` classes. Located in `frontend/src/pages/`.
2. **LCARS** (Star Trek) — a fully custom theme that mimics the LCARS operating system aesthetic. LCARS versions are NOT simple reskins. They must be purpose-built components in `frontend/src/themes/lcars/` that use LCARS panels, color variables (`--lcars-*`), the Antonio font, pill-shaped buttons, and the distinctive LCARS layout language (elbows, cascades, horizontal rule segments). Study existing LCARS components before building new ones to match the visual language.
3. **Liquid Glass** (Apple WWDC 2025) — a fully custom theme implementing Apple's Liquid Glass design language. Glass versions are NOT CSS reskins of Catppuccin. They must be purpose-built components in `frontend/src/themes/glass/` with unique layouts, bento grids, capsule-shaped controls, floating inset sidebar, and glass material effects (`backdrop-filter`, inner glow, material illumination). Study existing Glass components and the design principles below before building new ones.

Never ship a feature in only one or two themes. If you build `pages/NewFeature.jsx`, you must also build:
- `themes/lcars/LCARSNewFeature.jsx` (LCARS version)
- `themes/glass/GlassNewFeature.jsx` (Glass version)
And wire both up in `App.jsx` (GlassAppShell and LCARSAppShell routes).

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

Datacore is a self-hosted personal dashboard and database application. It's a modular web app where each "module" is a self-contained feature area (vehicles, notes, fuel economy, notifications, etc.) with its own database models, API endpoints, and frontend pages. The user accesses it via a web browser. The app supports three switchable themes: Catppuccin Mocha (default, may be deprecated), LCARS (Star Trek computer interface), and Liquid Glass (Apple WWDC 2025 design language).

**Owner:** Chase — has minimal Python experience, learning React. Explain things clearly and comment code well.

## Architecture

- **Backend:** Python 3.12, Flask, SQLAlchemy ORM, PostgreSQL
- **Frontend:** React 19 (Vite), React Router v7, Tailwind CSS v4, Lucide icons
- **Theming:** Triple-theme system via `ThemeProvider.jsx` — Catppuccin Mocha + LCARS + Liquid Glass
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
│           │   ├── ThemeProvider.jsx    # Theme switcher (manages all 3 themes)
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
│           └── glass/              # Liquid Glass theme (Apple WWDC 2025)
│               ├── glass-variables.css  # Apple system colors, glass effects
│               ├── glass-components.css # Component overrides + HIG patterns
│               ├── glass-animations.css # Spring physics, material illumination
│               ├── GlassLayout.jsx/css  # Floating inset sidebar shell
│               ├── GlassSidebar.jsx     # Floating glass nav sidebar
│               ├── GlassHeader.jsx      # Minimal floating header controls
│               ├── GlassMobileNav.jsx   # iOS 26 capsule tab bar
│               ├── GlassPanel.jsx       # Three-layer glass card
│               ├── GlassModal.jsx       # Spring-animated glass modal
│               ├── GlassIcon.jsx        # Squircle icon wrapper
│               ├── GlassDashboard.jsx   # Bento grid dashboard
│               ├── Glass<Page>.jsx      # Per-page Glass implementations
│               └── settings/            # Glass settings sub-pages
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

### 4. Create frontend pages (ALL THREE themes)

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

**Liquid Glass version (required):**

- Create `frontend/src/themes/glass/Glass<ModuleName>.jsx`
- Must be a UNIQUE implementation — NOT a wrapper around the Catppuccin component
- Use `GlassPanel` for content sections, Apple system colors, capsule-shaped controls
- Use bento grid layouts, `GlassSegmentControl` for tabs, `GlassListRow` for lists
- Register the component in `App.jsx` (GlassAppShell routes)
- Add a summary tile on `GlassDashboard.jsx`

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

### Liquid Glass Theme (Apple WWDC 2025)

Glass variables defined in `frontend/src/themes/glass/glass-variables.css`:

- Colors: Apple system palette — `--glass-system-blue` (#0A84FF), `--glass-system-green` (#30D158), `--glass-system-orange` (#FF9F0A), `--glass-system-red` (#FF453A), `--glass-system-purple` (#BF5AF2), etc.
- Font: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter'` — Apple system font stack
- Layout: Floating inset sidebar (12px margin from viewport edges), content flows behind it
- Components: `GlassPanel` for content sections, `GlassModal` for dialogs, capsule-shaped buttons (border-radius: 980px)
- Visual language: Three-layer glass (base + inner glow + elevation), material illumination on hover, bento grids, capsule segment controls

**Key Design Principles:**
- **Lensing**: Glass bends/concentrates light dynamically — not just blur
- **Material responds to interaction**: Elements illuminate from within on hover/touch
- **Spatial hierarchy through depth**: Glass floats above content, not beside it
- **Content-first**: UI chrome recedes; glass controls defer to content
- **Concentric shapes**: Inner radius = outer radius - padding
- **Capsule shapes** for all interactive elements (radius = half height / 980px)

**Glass Component Patterns:**
- `GlassPanel` — Three-layer glass card (backdrop-filter blur + inner glow pseudo + optional elevation)
- `GlassModal` — Spring-animated modal with heavy blur
- `GlassIcon` — Squircle icon wrapper (22% border-radius) with gradient fill and glow
- `GlassSegmentControl` — Apple-style capsule tab switcher
- `GlassStatCard` — Large metric display (2rem+ number, label, trend indicator)
- `GlassBentoGrid` — Responsive asymmetric grid
- `GlassSearchBar` — Floating capsule-shaped search input
- `GlassChip` — Filter/tag capsule chip
- `GlassListRow` — Apple Settings-style list row (icon + label + chevron)
- `GlassSheet` — Bottom sheet / action sheet for mobile

**Glass File Structure:**
```
themes/glass/
├── glass-variables.css       # Apple system colors, glass effects, layout vars
├── glass-components.css      # Component overrides + Apple HIG patterns
├── glass-animations.css      # Spring physics, material illumination
├── GlassLayout.jsx/css       # Floating inset sidebar app shell
├── GlassSidebar.jsx          # Floating glass nav sidebar
├── GlassHeader.jsx           # Minimal floating header controls
├── GlassMobileNav.jsx        # iOS 26 capsule tab bar (mobile)
├── GlassPanel.jsx            # Reusable glass card component
├── GlassModal.jsx            # Glass modal dialog
├── GlassIcon.jsx             # Squircle icon wrapper
├── GlassSegmentControl.jsx   # Capsule tab switcher
├── GlassStatCard.jsx         # Large metric card
├── GlassBentoGrid.jsx        # Asymmetric grid helper
├── Glass<PageName>.jsx       # Per-page implementations (NOT wrappers)
└── settings/                 # Settings sub-pages
```

### Responsive Utilities (all themes)

Defined in `index.css`, collapse to single column at 768px:

- `.form-grid-2col` — 2-column form grid
- `.form-grid-3col` — 3-column form grid
- `.card-grid` — auto-fit card grid (`minmax(280px, 1fr)`)

Mobile navigation:

- Catppuccin: Hamburger icon in header opens a slide-out drawer overlay
- LCARS: Bottom pill-button nav bar (`LCARSMobileNav.jsx`)
- Liquid Glass: Floating capsule bottom nav bar (`GlassMobileNav.jsx`) + slide-in drawer

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

**When adding new npm dependencies:**

1. Edit `frontend/package.json` to add the dependency
2. Tell the user to run: `docker compose exec frontend npm install` (or rebuild with `docker compose up --build`)
3. The Vite dev server will then have access to the new package

**When adding new Python (pip) dependencies:**

1. Edit `backend/requirements.txt` to add the dependency
2. Tell the user to rebuild: `docker compose up --build` (pip install runs during the Docker build step, so `exec pip install` won't persist — a rebuild is required)

**Never assume that editing a dependency manifest file is sufficient.** Always remind the user to install/rebuild after dependency changes.

## Key Technical Decisions

- **Weather:** Uses Open-Meteo API (free, no key). Proxied through Flask so frontend doesn't make external calls directly.
- **Tags on notes:** Stored as comma-separated string for simplicity. Can migrate to many-to-many table later if needed.
- **Database:** Tables auto-created on Flask startup via `db.create_all()`. For production schema changes, use Flask-Migrate (alembic).
- **No auth yet:** This is a personal, local-network-only app. Authentication can be added later if needed.
- **Theming:** `ThemeProvider.jsx` wraps the app and manages three themes: Catppuccin, LCARS, and Liquid Glass. `App.jsx` renders the appropriate AppShell (AppShell, LCARSAppShell, or GlassAppShell) based on the active theme. Theme preference is stored in localStorage as `'datacore-theme'`. The `.glass-theme` or `.lcars-theme` class is added to `<html>` to enable CSS overrides.
- **Mobile viewport:** Uses `100dvh` (not `100vh`) to account for mobile browser chrome (Safari toolbar).
- **Responsive grids:** CSS utility classes (`.form-grid-2col`, `.form-grid-3col`) instead of inline styles, so `@media` queries can collapse columns on mobile.

## Running Locally

```bash
# First time setup
cp .env.example .env
docker compose up --build

# After code changes (hot-reload handles most, but if you change dependencies):
docker compose up --build

# Just start/stop
docker compose up -d
docker compose down
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health
- Database: localhost:5432 (user: lifehub, db: lifehub)

## Deployment to HexOS

1. Push to `main` branch -> GitHub Actions builds images -> pushed to GHCR
2. In Dockge on HexOS, create a stack using `docker-compose.prod.yml` contents
3. Replace `YOUR_GITHUB_USERNAME` with actual username
4. Set `DB_PASSWORD` and `SECRET_KEY` in Dockge environment variables
5. Deploy the stack

## Current Status

### What's built:

- Dashboard with weather widget (5-day forecast) and module summary cards
- Vehicles module: add/edit vehicles, full maintenance log CRUD, fuel logging, tire set management, component tracking, service intervals
- Notes module: create/edit/delete, search, category filter, pin to top
- Fuel Economy module: fleet-wide analytics with charts (MPG trends, cost analysis), per-vehicle breakdowns, standalone fuel entry page
- Notifications module: configurable rules, channels, history, quiet hours, in-app bell with dropdown
- LCARS theme: full Star Trek computer interface with boot sequence, 8-panel dashboard, elbows/cascade/sidebar frame, all vehicle pages, fuel economy, service intervals
- Liquid Glass theme: Apple WWDC 2025 design language with floating inset sidebar, bento grid dashboard, capsule controls, glass material effects, iOS 26 mobile nav
- Triple-theme system with localStorage preference and seamless switching
- Mobile-responsive: hamburger nav (Catppuccin), bottom nav (LCARS), capsule bottom nav (Glass), collapsing form grids, card views for tables, viewport-safe modals
- Sidebar navigation with collapsible toggle
- Docker Compose for dev and prod
- GitHub Actions CI/CD pipeline

### Planned future modules/features:

- Finance/expense tracking
- Project/task management
- Inventory/collections tracking
- Dashboard activity feed (recent actions across all modules)
- Data export/backup functionality
- Inline editing on vehicle details (currently need to use API directly to edit vehicle info)
