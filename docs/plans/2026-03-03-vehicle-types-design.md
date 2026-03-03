# Vehicle Types & Motorcycle Mode — Design Document

**Date:** 2026-03-03
**Status:** Approved

## Summary

Expand the vehicles module to support multiple vehicle types (Car, Truck, SUV, Motorcycle) with type-specific default components, tire set configurations, maintenance intervals, and drivetrain tracking. Motorcycle mode is the primary new capability, introducing 2-wheel tire sets, drivetrain components (chain/belt/shaft), and motorcycle-specific maintenance intervals.

## Decisions

- **Vehicle type is locked at creation** — cannot be changed after the vehicle is added
- **Approach A (string field)** — simple `vehicle_type` column with branching logic in code
- **Types:** Car, Truck, SUV, Motorcycle
- **Cylinder count for ALL vehicle types** — replaces the hardcoded 8-spark-plug assumption
- **Dual spark plug option** for motorcycles — checkbox doubles spark plug count
- **Final drive type** (chain/belt/shaft) — motorcycle-only, selectable at creation, determines drivetrain components
- **Car/Truck/SUV share 4-wheel defaults** — no differentiation between them for components
- **Motorcycle-specific maintenance items** added to the global catalog
- **Existing vehicles auto-migrate to `vehicle_type='car'`**
- **Both Catppuccin and LCARS themes** must be updated

## Database Changes

### Vehicle Model — New Columns

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `vehicle_type` | `String(20)` | `'car'` | Allowed: `car`, `truck`, `suv`, `motorcycle` |
| `cylinder_count` | `Integer` | `NULL` | Spark plug count. NULL = legacy default (8 for cars) |
| `dual_spark` | `Boolean` | `False` | Motorcycle-only: doubles spark plug count |
| `final_drive_type` | `String(20)` | `NULL` | Motorcycle-only: `chain`, `belt`, `shaft` |

Migration: existing vehicles get `vehicle_type='car'`, other fields NULL/False.

### MaintenanceItem — New Column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `vehicle_types` | `String(100)` | `NULL` | Comma-separated applicable types. NULL = all types |

### New Motorcycle Maintenance Items (presets)

| Name | Category | Miles | Months | vehicle_types |
|------|----------|-------|--------|---------------|
| Chain Lubrication | Drivetrain | 500 | 1 | motorcycle |
| Chain Adjustment | Drivetrain | 3,000 | 6 | motorcycle |
| Chain Replacement | Drivetrain | 20,000 | 48 | motorcycle |
| Belt Inspection | Drivetrain | 5,000 | 12 | motorcycle |
| Belt Replacement | Drivetrain | 50,000 | 60 | motorcycle |
| Valve Clearance Check | Engine | 15,000 | 24 | motorcycle |
| Fork Oil Change | Suspension | 15,000 | 24 | motorcycle |
| Tire Replacement | Tires | 10,000 | 36 | motorcycle |

## Component Changes

### Default Components by Vehicle Type

**4-Wheel Types (Car/Truck/SUV):**
- 4 brake pads (FL, FR, RL, RR)
- 4 brake rotors (FL, FR, RL, RR)
- `cylinder_count` spark plugs (default 8 if null)
- 2 wiper blades (Driver, Passenger)
- 1 each: battery, oil filter, air filter, fuel filter, alternator, water pump, fuel pump

**Motorcycle:**
- 2 brake pads (Front, Rear)
- 2 brake rotors (Front, Rear)
- `cylinder_count * (2 if dual_spark else 1)` spark plugs
- 1 battery, 1 oil filter, 1 air filter
- Chain drive: drive chain, front sprocket, rear sprocket
- Belt drive: drive belt, front pulley, rear pulley
- Shaft drive: no additional drivetrain components
- No wipers, fuel pump, alternator, water pump

### New Component Types

| Type Key | Label | Vehicle Types |
|----------|-------|---------------|
| `drive_chain` | Drive Chain | motorcycle |
| `drive_belt` | Drive Belt | motorcycle |
| `front_sprocket` | Front Sprocket | motorcycle |
| `rear_sprocket` | Rear Sprocket | motorcycle |
| `front_pulley` | Front Pulley | motorcycle |
| `rear_pulley` | Rear Pulley | motorcycle |
| `stator` | Stator | motorcycle |

### Tire Sets for Motorcycles

- 4 components per set: 2 tires (Front, Rear) + 2 rims (Front, Rear)
- Positions: `['Front', 'Rear']` instead of 4-corner positions
- Backend `create_tire_set()` checks `vehicle_type` to determine position set
- Swap/mileage tracking logic unchanged

## Frontend Changes

### Vehicle Creation Form (both themes)

New fields:
1. **Vehicle Type** — dropdown (Car/Truck/SUV/Motorcycle), default Car
2. **Cylinder Count** — number input, all types, placeholder "e.g. 4, 6, 8"
3. **Final Drive Type** — dropdown (Chain/Belt/Shaft), visible only for Motorcycle
4. **Dual Spark Plugs** — checkbox, visible only for Motorcycle

### Vehicle Detail Page

- Type badge shown in vehicle header
- Components tab: type dropdown filtered by vehicle type
- Service Intervals: setup-defaults filtered by vehicle type

### Vehicle Cards/List

- Subtle type indicator (icon or label) on vehicle cards

### API Changes

- `POST /api/vehicles/` — accepts `vehicle_type`, `cylinder_count`, `dual_spark`, `final_drive_type`
- `GET /api/vehicles/{id}` — returns new fields via `to_dict()`
- `PUT /api/vehicles/{id}` — allows editing `cylinder_count`, `dual_spark` (NOT `vehicle_type` or `final_drive_type`)
- `POST /api/vehicles/{id}/tire-sets` — tire count based on vehicle type
- `POST /api/vehicles/{id}/intervals/setup-defaults` — filters by vehicle type

### Apple App Changes

- `Vehicle.swift` — add optional fields: `vehicleType`, `cylinderCount`, `dualSpark`, `finalDriveType`
- Vehicle creation/edit forms get conditional motorcycle fields
- Component type filtering in iOS component picker
