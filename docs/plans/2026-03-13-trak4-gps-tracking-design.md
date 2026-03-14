# Trak-4 GPS Tracking Module — Design Document

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Backend (Flask + PostgreSQL) + iOS/iPad/Mac Apple app. No web frontend.

---

## Overview

Full integration of the Trak-4 GPS Tracking REST API (v3.0.1) into Datacore. A FindMy-inspired Apple Maps experience for real-time vehicle location tracking, historical route replay, and device management. The Flask backend proxies all Trak-4 API calls (API key stays server-side), caches every GPS report permanently in PostgreSQL, and receives real-time webhook pushes from Trak-4.

---

## Architecture & Data Flow

### API Key Storage
- `TRAK4_API_KEY` environment variable on the backend container
- Flask proxies all Trak-4 calls — the key never touches the iOS app

### Data Flow (dual ingestion)

**Primary — Webhook push (real-time):**
1. Trak-4 device reports GPS position
2. Trak-4 server processes and pushes to our webhook endpoint
3. `POST /api/gps/webhook/gps_report` receives, deduplicates on `report_id`, stores in PostgreSQL
4. iOS app queries our Flask API for latest data

**Secondary — Adaptive polling (backup/backfill):**
1. Backend polls Trak-4 `/device_list` + `/gps_report_list` on an adaptive interval
2. Interval matches the device's reporting frequency + small buffer (e.g., 10m reporting → 11m polling)
3. Floor: 1 minute. Ceiling: 60 minutes.
4. Adjusts automatically when reporting frequency is changed via the app

**Backfill (manual, one-time):**
- Triggered via `POST /api/gps/sync`
- Walks backward through time in 24-hour chunks until Trak-4 returns 404
- Builds complete historical record

### Device-Vehicle Mapping
- 1:1 assignment: one Trak-4 device assigned to one Vehicle
- `vehicle_id` FK on `trak4_devices` table (nullable, unique)
- Assignment managed through the app's device management UI

---

## Backend: PostgreSQL Models

### `trak4_devices`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Auto-increment |
| device_id | Integer, unique, NOT NULL | Trak-4's DeviceID |
| vehicle_id | FK → vehicles.id, nullable, unique | 1:1 assignment |
| key_code | String(10) | Human-friendly ID, e.g. "VQA-493" |
| label | String(64), nullable | User-customizable name |
| note | String(500), nullable | User-customizable note |
| imei | String(50) | Device IMEI |
| firmware | String(50) | Current firmware version |
| generation | Integer | Hardware generation |
| product_id | Integer | Product type ID |
| product_name | String(255) | Product type name |
| image_url | String(500), nullable | Device photo URL |
| reporting_frequency_id | Integer, nullable | Current frequency ID |
| reporting_frequency_name | String(255), nullable | Current frequency name |
| pending_frequency_id | Integer, nullable | Queued frequency change |
| pending_frequency_name | String(255), nullable | Queued frequency name |
| last_latitude | Float, nullable | Latest known lat |
| last_longitude | Float, nullable | Latest known lng |
| last_position_source | String(10), nullable | gps/wifi/cell/bluetooth/none |
| last_voltage | Float, nullable | Battery voltage |
| last_voltage_percent | Integer, nullable | Battery percentage |
| last_report_time | DateTime, nullable | Device-side CreateTime |
| last_received_time | DateTime, nullable | Server-side ReceivedTime |
| last_synced_at | DateTime | When we last pulled from Trak-4 |
| created_at | DateTime | Row creation |
| updated_at | DateTime | Row update |

### `trak4_gps_reports`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Auto-increment |
| device_id | Integer, NOT NULL | Trak-4's DeviceID |
| report_id | String(20), unique | Trak-4's ReportID (dedup key) |
| latitude | Float | Position lat |
| longitude | Float | Position lng |
| heading | Integer, nullable | Degrees (GPS only) |
| speed | Integer, nullable | km/h (GPS only) |
| temperature | Integer, nullable | Celsius |
| voltage | Float, nullable | Battery voltage |
| voltage_percent | Integer, nullable | Battery percentage |
| hdop | Float, nullable | GPS signal quality |
| rssi | Integer, nullable | Cell signal strength |
| accuracy | Integer, nullable | Meters (non-GPS sources) |
| position_source | String(10) | gps/wifi/cell/bluetooth/none |
| device_state | String(100), nullable | Moving_Charging, etc. |
| report_reason | String(50), nullable | PeriodicReport, MovementChange, etc. |
| reporting_frequency | String(255), nullable | Active frequency at report time |
| create_time | DateTime | Device-side timestamp |
| received_time | DateTime | Server-side timestamp |

**Index:** `(device_id, received_time DESC)` for fast history queries.

---

## Backend: Flask API Endpoints

All under `/api/gps/`.

### Read Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/devices` | List all Trak-4 devices with vehicle names |
| GET | `/devices/<id>` | Single device with latest position |
| GET | `/devices/<id>/reports` | GPS report history (date range, paginated) |
| GET | `/devices/<id>/route` | Optimized route polyline (lat/lng/timestamp only) |
| GET | `/devices/<id>/frequencies` | Available reporting frequencies |
| GET | `/sync/status` | Sync status: last synced, report count, polling interval |

### Write Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/devices/<id>/assign` | Assign device to a vehicle_id |
| POST | `/devices/<id>/ping` | Force immediate GPS update (proxy to Trak-4) |
| PUT | `/devices/<id>/frequency` | Set reporting frequency + adjust poll interval |
| PUT | `/devices/<id>/label` | Set device label (Trak-4 + local DB) |
| PUT | `/devices/<id>/note` | Set device note (Trak-4 + local DB) |
| POST | `/sync` | Trigger manual sync/backfill |

### Webhook Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhook/gps_report` | Receives Trak-4 GPS report pushes. Deduplicates on report_id. |

---

## iOS/Mac App: FindMy-Style Experience

### Module Identity
- **Name:** GPS Tracking
- **Accent color:** Orange (`ModuleAccent.gpsTracking`)
- **Icon:** `location.fill` (or `mappin.and.ellipse`)
- **AppModule case:** `.gpsTracking`

### Navigation Structure

**iPhone:** Full-screen Apple Map + resizable bottom sheet (3 detents)
**iPad/Mac:** Full-screen map + right sidebar panel (like FindMy on iPad)

### Map Features

**Map style toggle** (overlay button, 4 options):
- Standard — street map
- Hybrid — satellite + labels
- Satellite — pure imagery
- 3D Flyover — `.hybrid(elevation: .realistic)` + 45-degree pitched camera

**Map overlays:**
- Vehicle annotation pin (custom icon based on vehicle type)
- Accuracy circle when position source is wifi/cell/bluetooth
- Heading arrow on pin showing direction of travel
- Route polyline (history mode) — speed-gradient colored (green→yellow→red)

### Vehicle Annotation Pin

**Icon selection (layered):**
1. **Default:** SF Symbol based on vehicle type field on Vehicle model
   - `truck` → `pickup.side.fill`
   - `motorcycle` → `motorcycle`
   - `sedan` → `car.side.fill`
   - `suv` → `suv.side.fill`
   - `van` → `van.side.fill`
   - `other` → `car.side.fill`
2. **Override:** If vehicle has a custom photo, user can opt to use it as a circular avatar pin (like FindMy people)

**Pin states:**
- Pulsing blue ring — just located (< 2 min old)
- Solid — normal (2–30 min old)
- Grey tint — stale (> 30 min since last report)

**Battery dot** on pin: green (>50%), yellow (20–50%), red (<20%)

### Bottom Sheet / Sidebar Panel

**Collapsed (small detent):**
- Vehicle name + "Last seen 3m ago"
- Battery pill (icon + %)
- Moving/Parked status badge

**Medium detent:**
- Reverse-geocoded address
- Stats row: Speed | Heading | Temperature | Signal (PremiumStatCards)
- "Locate" button (force ping) with haptic confirmation
- Quick actions: Directions (opens Apple Maps), Share Location

**Expanded (large detent):**
- Device info section (KeyCode, Firmware, Product, Reporting Frequency)
- History date picker → route polyline renders on map
- Route timeline scrubber (drag to replay movement through time)
- Report reason badges (why each ping happened)
- Device management: label edit, note edit, frequency picker

### Multi-Device List
If multiple devices are assigned to vehicles, the collapsed state shows a scrollable list of all tracked vehicles (like FindMy's Items list). Tapping one zooms the map and expands detail.

### Design System Usage
- `PremiumStatCard` — speed, temperature, battery, signal quality
- `CountingNumber` — speed (converted to mph), temperature (converted to F), battery %
- `.staggerReveal()` — device list items, detail info rows
- `.scrollReveal()` — sections within expanded detail
- `ShimmerView` / `PanelSkeleton` — initial load states
- `.platformFeedback(.success)` — after locate ping succeeds
- `.platformFeedback(.selection)` — map style toggle, device selection
- Haptic confirmation before force ping (costs device battery)

### iOS Codable Models

```
Trak4Device — mirrors trak4_devices.to_dict()
Trak4GPSReport — mirrors trak4_gps_reports.to_dict()
Trak4ReportingFrequency — from /frequencies endpoint
Trak4SyncStatus — lastSyncedAt, totalReports, deviceCount, pollingInterval
```

---

## Scope Boundaries

### In Scope (v1)
- Full backend: models, routes, sync engine, webhook receiver
- Full iOS/iPad/Mac views with FindMy-style map
- Map styles: standard, hybrid, satellite, 3D flyover
- Custom vehicle annotations (SF Symbols + optional photo override)
- Vehicle type field on Vehicle model
- Live location + route history replay + device management
- Adaptive polling interval matching device reporting frequency
- Permanent GPS report storage in PostgreSQL

### Out of Scope (future)
- Geofencing / arrival+departure alerts
- watchOS companion view
- Web frontend (Catppuccin + LCARS pages)
- CAN/serial/extended/binary reports (standard Trak-4, not CAN-enabled)
- VMS fields (vessel monitoring)
- Organization/user/device-group management (consumer account)
- 2D indoor maps
- Push notifications for movement/battery events
- 3D vehicle model annotations (would require RealityKit)

### Assumptions
- Consumer Trak-4 account (not business)
- Standard USB/solar model (not CAN-enabled)
- Speed displayed in mph (converted from km/h)
- Temperature displayed in Fahrenheit (converted from Celsius)
- Force ping requires user confirmation (costs device battery)
