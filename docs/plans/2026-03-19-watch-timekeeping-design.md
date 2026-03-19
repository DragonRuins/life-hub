# Watch Timekeeping Accuracy Module — Design Document

**Date:** 2026-03-19
**Platforms:** iPhone, iPad, Mac (iOS-only, no web frontend)
**Architecture:** Approach A — Three-table hierarchy (Watch > Period > Reading)

---

## Overview

A module for tracking mechanical watch accuracy over time. Users add watches with metadata and photos, then take periodic time readings to measure how much their watches gain or lose. Readings are grouped into "timekeeping periods" that can be reset when a watch stops (e.g., not worn for days). Historical periods accumulate to provide long-term accuracy statistics. A simple service log tracks when watches are sent for maintenance.

---

## Data Model

### Watch
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| name | String(100), required | User label, e.g. "Daily Seiko" |
| brand | String(100), required | e.g. "Seiko" |
| model | String(100) | e.g. "Presage Cocktail Time" |
| reference_number | String(100) | e.g. "SRPB41" |
| serial_number | String(100) | |
| movement_type | String(50) | "automatic", "manual", "quartz" |
| movement_caliber | String(100) | e.g. "4R35" |
| purchase_date | Date | |
| purchase_price | Float | |
| crystal_type | String(50) | "sapphire", "mineral", "acrylic" |
| case_size_mm | Float | |
| water_resistance | String(50) | e.g. "100m", "10ATM" |
| notes | Text | |
| image_filename | String(255) | UUID filename, same pattern as vehicles |
| created_at | DateTime | UTC default |

Relationships: `periods`, `service_logs` (cascade delete-orphan)

### TimekeepingPeriod
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| watch_id | FK -> watches | |
| started_at | DateTime, required | When the first reading was taken |
| ended_at | DateTime | Null while active, set on reset |
| avg_rate | Float | Cached on close: avg sec/day |
| total_readings | Integer | Cached on close |
| best_rate | Float | Cached: closest to 0 |
| worst_rate | Float | Cached: furthest from 0 |
| notes | Text | Optional note when closing |
| created_at | DateTime | |

Relationships: `readings` (cascade delete-orphan)

### TimekeepingReading
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| period_id | FK -> timekeeping_periods | |
| watch_time | DateTime, required | What the user entered (time shown on watch face) |
| reference_time | DateTime, required | Phone's actual time at moment of save/photo capture |
| offset_seconds | Float | watch_time - reference_time (positive = running fast) |
| rate | Float | sec/day since previous reading (null for first in period) |
| note | Text | |
| created_at | DateTime | |

### WatchServiceLog
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| watch_id | FK -> watches | |
| service_date | Date, required | |
| return_date | Date | When you got it back |
| service_type | String(100) | "Full service", "Regulation", etc. |
| cost | Float | |
| watchmaker | String(200) | |
| notes | Text | |
| rate_before | Float | sec/day before service |
| rate_after | Float | sec/day after service |
| created_at | DateTime | |

### Key Computations
- `offset_seconds` = `watch_time - reference_time` in seconds. Positive = watch running fast.
- `rate` = `(this.offset_seconds - prev.offset_seconds) / elapsed_days` between readings.
- On period close, `avg_rate` = mean of all non-null `rate` values.
- Editing/deleting a reading triggers recalculation of rates for all subsequent readings in that period.

---

## API Endpoints

All routes under `/api/watches/`.

### Watch CRUD
| Method | Path | Description |
|---|---|---|
| GET | `/` | List all watches (with latest period stats + last service date) |
| POST | `/` | Create a watch |
| GET | `/<id>` | Get watch detail (includes active period, periods list, service logs) |
| PUT | `/<id>` | Update watch metadata |
| DELETE | `/<id>` | Delete watch (cascades everything) |
| POST | `/<id>/image` | Upload watch photo |
| GET | `/<id>/image/file` | Serve watch photo |
| DELETE | `/<id>/image` | Delete watch photo |

### Timekeeping Periods
| Method | Path | Description |
|---|---|---|
| GET | `/<id>/periods` | List all periods for a watch (with cached stats) |
| GET | `/<id>/periods/active` | Get active period with all readings |
| POST | `/<id>/periods` | Start a new period (auto-closes active) |
| POST | `/<id>/periods/reset` | Close the active period (compute & cache stats) |
| DELETE | `/periods/<period_id>` | Delete a period and its readings |

### Timekeeping Readings
| Method | Path | Description |
|---|---|---|
| POST | `/<id>/readings` | Add reading to active period (auto-creates period if none). Computes offset/rate server-side. |
| PUT | `/readings/<reading_id>` | Edit a reading (recalculates cascading rates) |
| DELETE | `/readings/<reading_id>` | Delete a reading (recalculates cascading rates) |

### Service Log
| Method | Path | Description |
|---|---|---|
| GET | `/<id>/services` | List service logs |
| POST | `/<id>/services` | Add service record |
| PUT | `/services/<service_id>` | Edit service record |
| DELETE | `/services/<service_id>` | Delete service record |

### Statistics
| Method | Path | Description |
|---|---|---|
| GET | `/<id>/stats` | Aggregated lifetime stats: overall avg rate, total periods, total tracking days, trend data, per-period averages for charting |

---

## iOS App UI Design

### Module Accent Color
`.watches` added to `ModuleAccent` with **indigo**.

### Collection View (Landing Page)

**iPhone:** Vertical list of watch cards with `.staggerReveal()`. Each card (`.buttonStyle(.datacoreCard)`) contains:
- Watch photo (left, rounded rectangle)
- Name + Brand/Model
- 3 inline stats: Current Rate (sec/day, `CountingNumber`), Current Offset, Last Service
- Status dot (green = active period, gray = none)

**iPad/Mac:** 2-column `LazyVGrid` via `AdaptiveGrid`.

**Loading:** Shimmer skeletons (iPhone), `StatCardSkeleton` grid (iPad).
**Empty:** `EmptyStateView` with clock icon.

### Watch Detail View (4 Tabs)

Segmented `Picker`. `.platformFeedback(.selection)` on tab change.

#### Tab 1: Overview
- Hero photo (rounded rectangle, `.parallax()`, tap to change)
- Specs grouped list (brand, model, reference, serial, movement, caliber, crystal, case size, water resistance, purchase date/price)
- 2x2 `PremiumStatCard` grid: Current Rate (with `TrendBadge` + `MiniSparkline`), Current Offset, Total Tracking Days, Periods Completed
- Last Service card

#### Tab 2: Accuracy (Active Period)
- Period header with duration + "Reset Period" button (confirmation alert)
- "New Reading" button with two capture modes:
  - **Manual:** Hour (1-12), Minute (0-59), Second (0/15/30/45) pickers + AM/PM. "Capture" button records `Date()`.
  - **Photo:** Camera capture records `Date()` at shutter -> show preview -> enter time from photo -> save -> discard photo immediately
- Readings list (reverse-chronological, `.staggerReveal()`, swipe-to-delete, tap-to-edit)
  - Each row: watch time, reference time, offset (color-coded), rate (sec/day with `TrendBadge`)
- Charts: Offset over time (line), Rate over time (line with avg overlay). `ModuleAccent.watches.areaGradient`, `.scrollReveal()`.

#### Tab 3: History
- Expandable period cards: date range, duration, avg rate (`TrendBadge`), reading count
- Cross-period charts: Avg rate per period (bar), Rate trend over time (line connecting period averages), Consistency (best/worst spread per period)

#### Tab 4: Service Log
- Reverse-chronological list (`.staggerReveal()`, swipe-to-delete, tap-to-edit)
- Service form: date, return date, type, cost, watchmaker, notes, rate before/after

### Platform Adaptations
| Aspect | iPhone | iPad/Mac |
|---|---|---|
| Collection | Single-column list | 2-column card grid |
| Tabs | Icon-only segmented | Labeled segmented |
| Title | `.large` | `.inline` |
| Charts | Full-width stacked | Side-by-side where appropriate |
| Forms | Sheet | Sheet |
| Navigation | Push | `iPadSplitLayout` list + detail |

### Animations & Polish
- `DatacoreSpring.snappy` — tap interactions, form saves
- `DatacoreSpring.smooth` — tab transitions, stagger reveals
- `.staggerReveal()` — all list/grid items
- `.scrollReveal()` — chart sections
- `CountingNumber` — all numeric stat displays
- `PremiumStatCard` — all stat tiles
- `.platformFeedback(.selection)` — tab changes
- `.platformFeedback(.success)` — reading capture, period reset
- Shimmer skeletons — all iPhone loading states
- `.buttonStyle(.datacoreCard)` — watch collection cards
- `.buttonStyle(.datacore)` — action buttons
- Liquid Glass `.glassEffect(.regular)` on non-interactive surfaces; `.ultraThinMaterial` for cards with NavigationLink
- Rounded rectangles throughout, no bubbles

---

## File Structure

### Backend (new)
```
backend/app/models/watch.py         — Watch, TimekeepingPeriod, TimekeepingReading, WatchServiceLog
backend/app/routes/watches.py       — All /api/watches/ endpoints
```

### iOS (new)
```
Datacore/Models/Watch.swift                     — Codable structs
Datacore/ViewModels/WatchesViewModel.swift       — @Observable @MainActor
Datacore/Views/Watches/WatchesListView.swift     — Collection grid/list
Datacore/Views/Watches/WatchCardView.swift       — Card component
Datacore/Views/Watches/WatchDetailView.swift     — 4-tab detail
Datacore/Views/Watches/WatchFormView.swift       — Create/edit watch
Datacore/Views/Watches/WatchOverviewTab.swift    — Hero, specs, stats
Datacore/Views/Watches/WatchAccuracyTab.swift    — Active period + charts
Datacore/Views/Watches/WatchHistoryTab.swift     — Past periods + charts
Datacore/Views/Watches/WatchServiceTab.swift     — Service log list
Datacore/Views/Watches/WatchServiceFormView.swift — Service form
Datacore/Views/Watches/ReadingCaptureView.swift  — Manual + photo capture
Datacore/Views/Watches/ReadingEditView.swift     — Edit reading
```

### Modified files
- `Datacore/Design/DatacoreColors.swift` — Add `.watches` (indigo)
- `Datacore/Network/Endpoint.swift` — Add watch endpoint cases
- `Datacore/Views/Dashboard/` — Add watch summary card
- `project.yml` — Verify glob includes new files
- `backend/app/__init__.py` — Register watches_bp
- `backend/app/models/__init__.py` — Import watch models

### Excluded (by design)
- No watchOS module (iPhone + iPad + Mac only)
- No web frontend (iOS-only feature)
- No notification integration
