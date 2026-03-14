# GPS Tracking Notifications — Battery Alerts & Geofence Zones

**Date:** 2026-03-14
**Status:** Approved

## Overview

Integrate GPS tracking with the existing notification system. Two alert types:
1. **Battery level alerts** — predefined tiers (20%, 10%, 5%) checked during every sync/webhook
2. **Geofence zone alerts** — user-defined circles and rectangles on the map, entry/exit detection

Alerts fire immediately via the existing event bus → rule evaluator → dispatcher → APNs push pipeline. iOS push notifications with `push_delay_minutes = 0`.

## Data Model

### Trak4Geofence table

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | Auto-increment |
| device_id | FK → Trak4Device | Which tracker this zone applies to |
| name | String(100) | User-given name (e.g., "Home", "Work") |
| shape | String(10) | "circle" or "rectangle" |
| center_lat | Float | Center latitude |
| center_lng | Float | Center longitude |
| radius_meters | Float, nullable | For circles |
| width_meters | Float, nullable | For rectangles (east-west span) |
| height_meters | Float, nullable | For rectangles (north-south span) |
| rotation_degrees | Float, default 0 | Rectangle rotation (reserved, 0 for now) |
| alert_on_entry | Boolean, default True | Fire event on entry |
| alert_on_exit | Boolean, default True | Fire event on exit |
| enabled | Boolean, default True | Quick on/off toggle |
| last_state | String(10), nullable | "inside" or "outside" — tracks transitions |
| created_at | DateTime | UTC |
| updated_at | DateTime | UTC |

### Battery alert tiers (hardcoded, no table)

| Tier | Threshold | Event | Priority |
|------|-----------|-------|----------|
| Low | <= 20% | gps.battery_low | normal |
| Critical | <= 10% | gps.battery_critical | high |
| Dead | <= 5% | gps.battery_dead | urgent |

6-hour cooldown per tier per device.

### New event types

- `gps.battery_low`, `gps.battery_critical`, `gps.battery_dead`
- `gps.geofence_enter`, `gps.geofence_exit`

Registered in AVAILABLE_EVENTS in notifications.py.

## Backend Logic

### Geofence checking

Runs in `trak4_sync.py` after every position update (polling and webhook):

```
check_geofences(device, new_lat, new_lng):
    For each enabled zone on this device:
        Compute inside/outside (haversine for circles, bounding box for rectangles)
        Compare to last_state
        If transition detected and alert enabled → emit event
        Update last_state
```

- Circle: haversine distance <= radius_meters
- Rectangle: center + width/height → bounding box (min/max lat/lng via meter-to-degree at center latitude)
- last_state initialized to None on creation — first position sets it without alerting

### Battery checking

```
check_battery_alerts(device, battery_percent):
    Check tiers 5% → 10% → 20% (lowest first)
    Emit matching event with 6-hour cooldown
```

### Event payloads

Geofence: device_name, device_id, vehicle_name, zone_name, zone_id, latitude, longitude, position_source, direction
Battery: device_name, device_id, vehicle_name, battery_percent, voltage, tier

## API Endpoints

All under `/api/gps/devices/<device_id>/geofences`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | /geofences | List all zones for device |
| POST | /geofences | Create zone |
| PUT | /geofences/<id> | Update zone |
| DELETE | /geofences/<id> | Delete zone |

No new battery endpoints — tiers are hardcoded.

## iOS UI

### Map overlays

- Circles → MapCircle with semi-transparent fill + stroke
- Rectangles → MapPolygon with 4 corners
- Color: green (inside) / orange (outside) based on last_state

### Zone creation mode

1. Tap "Add Zone" button in GPSDetailPanel
2. Main sheet minimizes, bottom toolbar appears (shape toggle: circle/rectangle, Cancel/Save)
3. Tap map to place center pin
4. Drag handles to set radius (circle) or width/height (rectangle)
5. Save → sheet with name, entry/exit toggles, enabled toggle
6. Confirm → POST to API, overlay appears

### Zone management

New "Geofences" section in GPSDetailPanel:
- List of zones with name, shape icon, inside/outside badge
- Tap to zoom, swipe to delete, edit name/toggles

### Push notification

New `gps_alert` category in PushNotificationManager.swift with "View Map" action.

## Scope

### In scope
- Trak4Geofence model + CRUD API
- Geofence + battery checks in trak4_sync.py
- 5 new event types in notification system
- iOS geofence overlays, creation mode, management UI
- iOS push notification category

### Out of scope
- Web dashboard UI (iOS only)
- Custom battery thresholds
- Rectangle rotation
- Polygon shapes
- Dwell time alerts
- watchOS geofence UI
