# AutoPi TMU CM4 Integration Design

## Overview

Integrate an AutoPi TMU CM4 OBD-II unit into Datacore to provide CAN bus telemetry, decoded OBD-II snapshots, and position tracking for a 2021 RAM 1500. The AutoPi is permanently installed in one vehicle and connected to AutoPi Cloud.

## Architecture

AutoPi is its own backend module that cross-writes into existing modules:

```
AutoPi Module (owns raw telemetry data)
  ├── autopi_obd_snapshots (decoded PID readings, full history)
  │
  ├──→ GPS Module: autopi_devices + autopi_position_reports (position data)
  ├──→ GPS Module: geofences (refactored to vehicle-scoped, device-agnostic)
  ├──→ Vehicles Module: auto-updates Vehicle.current_mileage from odometer PID
  │
  └── Sync Engine: polling + webhook + backfill (Trak-4 pattern)
```

## Phase 0: API Discovery

Before writing production code, build a discovery script that probes the AutoPi API with the real device and documents response structures.

**Discovery script:** `backend/app/services/autopi_discovery.py`

Functions to probe:
- `discover_device_info()` — GET /dongle/devices/ (confirm device ID, HW version, status)
- `discover_position_data()` — position/trip endpoints (field shapes for lat/lng/speed/heading)
- `discover_obd_pids()` — GET /can_logging/pids/ (what PIDs are configured)
- `discover_can_loggers()` — GET /can_logging/loggers/ (logging configuration)
- `discover_recent_data()` — logged data endpoint (how decoded readings are structured)
- `discover_webhook_config()` — output handler format for push setup

Process: write function → user runs it → paste back relevant output → iterate until shapes are documented. OBD/CAN endpoints will mostly return empty data until the vehicle has been driven.

## Phase 1: Backend

### Database Schema

#### GPS Module Tables (new, alongside Trak-4 tables)

**`autopi_devices`**

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Internal |
| device_id | String (unique) | AutoPi's device UUID |
| vehicle_id | Integer FK → vehicles | 1:1 assignment |
| unit_id | String | AutoPi unit identifier |
| label | String | User-friendly name |
| hw_version | String | Hardware board version |
| firmware | String | Current firmware/release |
| last_latitude | Float | Latest known position |
| last_longitude | Float | Latest known position |
| last_report_time | DateTime | Last data received |
| created_at | DateTime | |
| updated_at | DateTime | |

**`autopi_position_reports`**

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| device_id | Integer FK → autopi_devices | |
| latitude | Float | |
| longitude | Float | |
| speed | Float | km/h, if provided |
| heading | Float | Degrees, if provided |
| altitude | Float | If provided |
| recorded_at | DateTime | When AutoPi recorded it |
| received_at | DateTime | When Datacore ingested it |

*Exact fields refined after API discovery.*

#### Geofences (refactored from Trak-4-specific)

Existing `trak4_geofences` refactored to a vehicle-scoped `geofences` table:
- Replace `device_id` FK with `vehicle_id` FK
- Geofence evaluation runs on position ingestion from either device type
- Existing geofence designer UI works for both Trak-4 and AutoPi vehicles
- Notifications fire through existing notification system

#### AutoPi Module Table

**`autopi_obd_snapshots`**

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| device_id | Integer FK → autopi_devices | |
| recorded_at | DateTime | When the reading was taken |
| pid_name | String | e.g. "odometer", "coolant_temp", "rpm" |
| pid_code | String | e.g. "01 0C" for RPM |
| value | Float | Decoded numeric value |
| unit | String | e.g. "miles", "F", "RPM" |
| raw_value | String | Original value from API (debugging) |

Tall/narrow table (one row per PID per reading). New PIDs appear without schema changes. Trend queries: `WHERE pid_name = 'coolant_temp' ORDER BY recorded_at`.

#### Cross-Module Update

When `pid_name = 'odometer'` arrives → update `Vehicle.current_mileage` on the linked vehicle.

### Sync Engine

**`backend/app/services/autopi_sync.py`** — follows Trak-4 pattern:

- **Polling:** configurable interval (default 5 min), pulls position + OBD data since last sync, deduplicates, updates device fields, triggers mileage update
- **Webhook:** `POST /api/autopi/webhook` — AutoPi output handlers push data here, same ingestion logic as polling
- **Backfill:** `POST /api/autopi/sync/backfill?days=7` — walks backward in chunks for initial import

### API Client

**`backend/app/services/autopi_client.py`** — wraps AutoPi REST API with token auth. Methods map to discovered endpoints.

### API Routes

**`backend/app/routes/autopi.py`** — Blueprint with:
- Device management (list, detail, assign to vehicle)
- OBD snapshot queries (by PID, date range, vehicle)
- Sync controls (trigger sync, backfill, status)
- Webhook endpoint

### Environment Variables

- `AUTOPI_API_TOKEN` — API token
- `AUTOPI_DEVICE_ID` — device UUID (single unit, hardcoded initially)
- `AUTOPI_SYNC_INTERVAL` — polling interval in seconds (default 300)

## Phase 2: Apple App — GPS Module Updates

### Vehicle Selector

- Vehicle picker at top of GPS tracking view (Mac, iPad, iPhone)
- Shows all vehicles with a tracking device assigned (Trak-4 or AutoPi)
- Selecting a vehicle centers map on latest position

### Device-Aware Detail Drawer

**Trak-4 vehicle selected:** current drawer unchanged (position, speed, heading, temp, voltage, signal quality, geofences)

**AutoPi vehicle selected:** adapted drawer showing:
- Position, speed, heading (from position reports)
- Latest OBD snapshot summary (odometer, coolant temp, fuel level, etc.)
- Link to full telemetry tab on vehicle detail page

### Map

- All tracked vehicles shown simultaneously with different pin icons/colors per device type
- Route history polylines sourced from `autopi_position_reports`
- Geofence designer works for AutoPi vehicles (vehicle-scoped geofences)

## Phase 3: Apple App — Vehicle Detail Telemetry Tab

New "Telemetry" tab on the vehicle detail page (alongside Maintenance, Fuel, Tires, Components, Service Intervals).

### Components:
- **Live Stats Panel** — `PremiumStatCard` for latest PID readings (odometer, coolant temp, fuel level, battery voltage, RPM)
- **Trend Charts** — Select any PID, view history over selectable time ranges (1 day, 1 week, 1 month, all time)
- **Drive Sessions** — Group snapshots into drives (where RPM > 0) for browsing, if feasible
- **Device Status** — AutoPi connection health, last sync time, firmware version

## Not In Scope

- Web app frontend (no React/LCARS — Apple apps are the primary frontend)
- Raw CAN frame archival (future consideration after driving data is available)
- AutoPi automation/trigger config from Datacore (use AutoPi dashboard)
- watchOS (evaluate later)
