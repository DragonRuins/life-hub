# OBD2 Module Decommission — Design Document

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Full removal of OBD2/BLE code from Flask backend + iOS/Mac Apple app. No web frontend impact.

---

## Overview

Complete decommission of the OBD2 Bluetooth BLE module. The custom ELM327-based Bluetooth scanner integration is being replaced by a cloud-connected OBD2 scanner (to be purchased). This document covers the full removal of all OBD code — backend models/routes, iOS BLE services, views, ViewModels, and all integration touchpoints. When the new cloud scanner arrives, a fresh module will be designed from scratch based on its actual API and data format.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database tables | Leave orphaned | No risk of data loss. 3 tables sit inert. Can be queried manually via psql if ever needed. |
| Backend API routes | Remove entirely | New cloud scanner will have a completely different data model. Fresh endpoints will be designed later. |
| Module navigation slot | Remove entirely | No placeholder or "Coming Soon" view. New module case added when cloud scanner integration is built. |
| Bluetooth capability | Remove | No other module uses BLE. Can be re-added to project.yml if a future feature needs it. |
| OBD BGTask identifier | Remove | Background sync task only existed for OBD upload queue. |

---

## Deletion Inventory

### Files to Delete (16 files, ~7,025 lines)

#### Backend (642 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `backend/app/models/obd.py` | 132 | SQLAlchemy models (OBDSnapshot, OBDDTCEvent, OBDTrip) |
| `backend/app/routes/obd.py` | 510 | 9 REST endpoints (ingest, query, manage) |

#### iOS Services (3,025 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `Datacore/Services/OBD/ELM327Session.swift` | 1152 | AT command protocol + PID polling |
| `Datacore/Services/OBD/OBDBluetoothManager.swift` | 686 | CoreBluetooth BLE wrapper |
| `Datacore/Services/OBD/OBDDataProvider.swift` | 693 | Trip detection + DTC tracking |
| `Datacore/Services/OBD/OBDTypes.swift` | 425 | Connection states, PIDs, readings |
| `Datacore/Services/OBD/OBDDebugLog.swift` | 69 | Debug logging |

#### iOS Views (1,427 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `Datacore/Views/OBD/OBDDashboardView.swift` | 319 | Main hub/navigation |
| `Datacore/Views/OBD/OBDConnectionView.swift` | 218 | BLE device discovery + connection |
| `Datacore/Views/OBD/OBDGaugesView.swift` | 186 | Live PID sensor readings |
| `Datacore/Views/OBD/OBDDTCView.swift` | 100 | Diagnostic trouble codes |
| `Datacore/Views/OBD/OBDTripHistoryView.swift` | 123 | Trip records |
| `Datacore/Views/OBD/OBDSensorHistoryView.swift` | 231 | Time-series charting |
| `Datacore/Views/OBD/OBDConsoleView.swift` | 105 | Raw ELM327 command passthrough |
| `Datacore/Views/OBD/OBDDebugLogView.swift` | 145 | Operation log viewer |

#### iOS ViewModel + Model (1,176 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `Datacore/ViewModels/OBDViewModel.swift` | 916 | BLE + backend orchestration |
| `Datacore/Models/OBD.swift` | 260 | Codable response types + batch payloads |

### Files to Edit (13 integration touchpoints)

| File | Change |
|------|--------|
| `backend/app/__init__.py` | Remove OBD blueprint registration + model import + safe migrations |
| `Datacore/Models/AppModule.swift` | Remove `.obd` case + display label |
| `Datacore/ContentView.swift` | Remove `.obd` case from tab switch |
| `Datacore/DatacoreApp.swift` | Remove `obdVM` state + environment injection + setup call |
| `Datacore/MacApp/MacDatacoreApp.swift` | Remove `obdVM` state + environment injection |
| `Datacore/MacApp/MacSidebar.swift` | Remove OBD sidebar row |
| `Datacore/Views/Shared/iPadSidebar.swift` | Remove OBD sidebar row |
| `Datacore/Views/Shared/ModuleLauncherSheet.swift` | Remove OBD module card + fix stagger indices |
| `Datacore/Views/Shared/EnvironmentInjector.swift` | Remove `obdVM` storage + injection |
| `Datacore/Views/Shared/DatacoreNotifications.swift` | Remove 2 OBD notification names |
| `Datacore/Network/Endpoint.swift` | Remove 9 OBD endpoint cases + path mappings + method routing |
| `Datacore/Sync/OfflineSyncManager.swift` | Remove 2 OBD operation types |
| `Datacore/Sync/BackgroundTaskManager.swift` | Remove OBD sync task scheduling + handler |
| `project.yml` | Remove Bluetooth usage description + OBD BGTask identifier |

### Preserved (no action)

- `obd_snapshots` PostgreSQL table — orphaned, data intact
- `obd_dtc_events` PostgreSQL table — orphaned, data intact
- `obd_trips` PostgreSQL table — orphaned, data intact

---

## Approach

1. Delete all 16 OBD-specific files (services, views, ViewModel, model, backend)
2. Edit 13-14 integration files to remove OBD references
3. Update project.yml to remove Bluetooth + BGTask capabilities
4. Run `xcodegen generate`
5. Build iOS + macOS targets — verify zero errors
6. Commit and push
