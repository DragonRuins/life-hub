# Trak-4 GPS Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full Trak-4 GPS tracker integration with FindMy-style Apple Maps experience across iPhone, iPad, and Mac.

**Architecture:** Flask backend proxies all Trak-4 API calls (API key in env var), caches every GPS report permanently in PostgreSQL, receives real-time webhook pushes, and runs an adaptive-interval background poller as backup. iOS/Mac app shows a full-screen map with custom vehicle annotations, route replay, and device management.

**Tech Stack:** Python/Flask/SQLAlchemy/APScheduler (backend), SwiftUI/MapKit (iOS/Mac), Trak-4 REST API v3.0.1

**Design doc:** `docs/plans/2026-03-13-trak4-gps-tracking-design.md`

---

## Task 1: Backend — Database Models

**Files:**
- Create: `backend/app/models/gps_tracking.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the model file**

```python
"""
GPS Tracking Module - Database Models

Two tables:
  - trak4_devices: Mirrors Trak-4 device objects, linked 1:1 to vehicles
  - trak4_gps_reports: Every GPS report ever received, stored permanently

The backend proxies the Trak-4 REST API. The API key is stored as an
env var (TRAK4_API_KEY) and never exposed to the iOS app.
"""
from datetime import datetime, timezone
from app import db


class Trak4Device(db.Model):
    """A Trak-4 GPS tracker device, optionally linked to a vehicle."""
    __tablename__ = 'trak4_devices'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, unique=True, nullable=False)          # Trak-4's DeviceID
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='SET NULL'),
                           nullable=True, unique=True)                       # 1:1 assignment
    key_code = db.Column(db.String(10))                                      # e.g. "VQA-493"
    label = db.Column(db.String(64))                                         # user-customizable
    note = db.Column(db.String(500))                                         # user-customizable
    imei = db.Column(db.String(50))
    firmware = db.Column(db.String(50))
    generation = db.Column(db.Integer)
    product_id = db.Column(db.Integer)
    product_name = db.Column(db.String(255))
    image_url = db.Column(db.String(500))

    # Reporting frequency
    reporting_frequency_id = db.Column(db.Integer)
    reporting_frequency_name = db.Column(db.String(255))
    pending_frequency_id = db.Column(db.Integer)
    pending_frequency_name = db.Column(db.String(255))

    # Last known position (from latest device_list poll)
    last_latitude = db.Column(db.Float)
    last_longitude = db.Column(db.Float)
    last_position_source = db.Column(db.String(10))                          # gps/wifi/cell/bluetooth/none
    last_voltage = db.Column(db.Float)
    last_voltage_percent = db.Column(db.Integer)
    last_report_time = db.Column(db.DateTime)                                # device-side CreateTime
    last_received_time = db.Column(db.DateTime)                              # server-side ReceivedTime

    last_synced_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    vehicle = db.relationship('Vehicle', backref=db.backref('trak4_device', uselist=False))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'vehicle_id': self.vehicle_id,
            'vehicle_name': self.vehicle.to_dict().get('display_name') if self.vehicle else None,
            'vehicle_type': self.vehicle.vehicle_type if self.vehicle else None,
            'key_code': self.key_code,
            'label': self.label,
            'note': self.note,
            'imei': self.imei,
            'firmware': self.firmware,
            'generation': self.generation,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'image_url': self.image_url,
            'reporting_frequency_id': self.reporting_frequency_id,
            'reporting_frequency_name': self.reporting_frequency_name,
            'pending_frequency_id': self.pending_frequency_id,
            'pending_frequency_name': self.pending_frequency_name,
            'last_latitude': self.last_latitude,
            'last_longitude': self.last_longitude,
            'last_position_source': self.last_position_source,
            'last_voltage': self.last_voltage,
            'last_voltage_percent': self.last_voltage_percent,
            'last_report_time': self.last_report_time.isoformat() if self.last_report_time else None,
            'last_received_time': self.last_received_time.isoformat() if self.last_received_time else None,
            'last_synced_at': self.last_synced_at.isoformat() if self.last_synced_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Trak4GPSReport(db.Model):
    """A single GPS report from a Trak-4 device. Stored permanently."""
    __tablename__ = 'trak4_gps_reports'
    __table_args__ = (
        db.Index('idx_trak4_reports_device_received', 'device_id', 'received_time'),
    )

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, nullable=False)                        # Trak-4's DeviceID
    report_id = db.Column(db.String(20), unique=True, nullable=False)        # Trak-4's ReportID (dedup)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    heading = db.Column(db.Integer)                                          # degrees, GPS only
    speed = db.Column(db.Integer)                                            # km/h, GPS only
    temperature = db.Column(db.Integer)                                      # Celsius
    voltage = db.Column(db.Float)
    voltage_percent = db.Column(db.Integer)
    hdop = db.Column(db.Float)                                               # GPS signal quality
    rssi = db.Column(db.Integer)                                             # cell signal strength
    accuracy = db.Column(db.Integer)                                         # meters, non-GPS sources
    position_source = db.Column(db.String(10))                               # gps/wifi/cell/bluetooth/none
    device_state = db.Column(db.String(100))                                 # Moving_Charging, etc.
    report_reason = db.Column(db.String(50))                                 # PeriodicReport, etc.
    reporting_frequency = db.Column(db.String(255))
    create_time = db.Column(db.DateTime)                                     # device-side timestamp
    received_time = db.Column(db.DateTime)                                   # server-side timestamp

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'report_id': self.report_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'heading': self.heading,
            'speed': self.speed,
            'temperature': self.temperature,
            'voltage': self.voltage,
            'voltage_percent': self.voltage_percent,
            'hdop': self.hdop,
            'rssi': self.rssi,
            'accuracy': self.accuracy,
            'position_source': self.position_source,
            'device_state': self.device_state,
            'report_reason': self.report_reason,
            'reporting_frequency': self.reporting_frequency,
            'create_time': self.create_time.isoformat() if self.create_time else None,
            'received_time': self.received_time.isoformat() if self.received_time else None,
        }

    def to_route_point(self):
        """Lightweight dict for route polyline rendering (lat/lng/time/speed only)."""
        return {
            'lat': self.latitude,
            'lng': self.longitude,
            'time': self.create_time.isoformat() if self.create_time else None,
            'speed': self.speed,
            'heading': self.heading,
        }
```

**Step 2: Register in models/__init__.py**

Add to the end of `backend/app/models/__init__.py`:
```python
from .gps_tracking import Trak4Device, Trak4GPSReport
```

**Step 3: Register in app factory**

In `backend/app/__init__.py` line 100, add `gps_tracking` to the model import list:
```python
from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, obd, debt, timecard, gps_tracking  # noqa: F401
```

**Step 4: Commit**
```bash
git add backend/app/models/gps_tracking.py backend/app/models/__init__.py backend/app/__init__.py
git commit -m "feat(gps): add Trak4Device and Trak4GPSReport database models"
```

---

## Task 2: Backend — Trak-4 API Client Service

**Files:**
- Create: `backend/app/services/trak4_client.py`
- Modify: `backend/app/config.py`

**Step 1: Add config**

Add to `backend/app/config.py` at the end of the `Config` class:
```python
    # Trak-4 GPS Tracking API
    TRAK4_API_KEY = os.environ.get('TRAK4_API_KEY', '')
    TRAK4_API_BASE = 'https://api-v3.trak-4.com'
```

**Step 2: Create the Trak-4 API client**

```python
"""
Trak-4 API Client

Proxy layer for the Trak-4 GPS Tracking REST API v3.0.1.
All calls include the API key from the TRAK4_API_KEY env var.

API docs: https://api-v3.trak-4.com
All endpoints are POST with JSON bodies containing at minimum {"APIKey": "..."}.
Date range queries for GPS reports are clamped to 24-hour windows by the API.
"""
import logging
import re
from datetime import datetime, timedelta, timezone

import requests
from flask import current_app

logger = logging.getLogger(__name__)

# Timeout for Trak-4 API calls (seconds)
_TIMEOUT = 15


def _api_key():
    """Get the Trak-4 API key from Flask config."""
    return current_app.config.get('TRAK4_API_KEY', '')


def _base_url():
    return current_app.config.get('TRAK4_API_BASE', 'https://api-v3.trak-4.com')


def _post(path, payload=None):
    """Make a POST request to the Trak-4 API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    body = {'APIKey': _api_key()}
    if payload:
        body.update(payload)

    resp = requests.post(url, json=body, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# ── Device Endpoints ──────────────────────────────────────────

def get_device_list(page=1):
    """Fetch all devices visible to the API key. Returns list of device dicts."""
    data = _post('/device_list', {'Page': page})
    return data.get('Devices', []), data.get('TotalPages', 1)


def get_device(device_id):
    """Fetch a single device by DeviceID."""
    data = _post('/device', {'DeviceID': device_id})
    return data.get('Device')


def set_device_label(device_id, label):
    """Set a device's user-customizable label (max 64 chars)."""
    return _post('/set_device_label', {'DeviceID': device_id, 'Label': label[:64]})


def set_device_note(device_id, note):
    """Set a device's user-customizable note (max 500 chars)."""
    return _post('/set_device_note', {'DeviceID': device_id, 'Note': note[:500]})


# ── GPS Report Endpoints ─────────────────────────────────────

def get_gps_reports(device_id, start_dt, end_dt=None):
    """
    Fetch GPS reports for a device within a time range.
    The API clamps to 24-hour windows: if end_dt - start_dt > 24h,
    end_dt is clamped to start_dt + 24h.
    Returns list of GPS report dicts.
    """
    payload = {
        'DeviceID': device_id,
        'DateTime_Start': start_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'FilterByReceivedTime': True,
    }
    if end_dt:
        payload['DateTime_End'] = end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    data = _post('/gps_report_list', payload)
    return data.get('GPS_Reports', [])


# ── Reporting Frequency Endpoints ─────────────────────────────

def get_reporting_frequencies(device_id=None):
    """Fetch available reporting frequencies. Optionally filter by device."""
    payload = {}
    if device_id:
        payload['DeviceID'] = device_id
    data = _post('/reporting_frequency_list', payload)
    return data.get('Reporting_Frequencies', [])


def set_reporting_frequency(device_id, frequency_id):
    """Queue a reporting frequency change on the device."""
    return _post('/set_reporting_frequency', {
        'DeviceID': device_id,
        'ReportingFrequencyID': frequency_id,
    })


# ── Device Control Endpoints ─────────────────────────────────

def request_update(device_id):
    """Send a signal to the tracker requesting an immediate GPS report."""
    return _post('/request_update', {'DeviceID': device_id})


def test_connection():
    """Test API connectivity. Returns True if the API responds with 'Test Success'."""
    try:
        data = _post('/test')
        return data.get('Message') == 'Test Success'
    except Exception as e:
        logger.error(f"Trak-4 API test failed: {e}")
        return False


# ── Helpers ───────────────────────────────────────────────────

def parse_reporting_interval_seconds(frequency_name):
    """
    Parse a Trak-4 reporting frequency name into seconds.
    Examples: '1d|10m Premium' → 600, '1d|1m Elite' → 60, '4h Standard' → 14400
    Extracts the shortest interval component.
    Returns 600 (10 min) as a safe default if parsing fails.
    """
    if not frequency_name:
        return 600

    # Look for patterns like "10m", "1h", "4h", "30s", "1d"
    matches = re.findall(r'(\d+)\s*(s|m|h|d)', frequency_name.lower())
    if not matches:
        return 600

    multipliers = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}
    intervals = [int(val) * multipliers.get(unit, 60) for val, unit in matches]

    # Use the smallest interval (the reporting interval, not the sleep interval)
    return min(intervals) if intervals else 600
```

**Step 3: Commit**
```bash
git add backend/app/services/trak4_client.py backend/app/config.py
git commit -m "feat(gps): add Trak-4 API client service with all endpoint proxies"
```

---

## Task 3: Backend — Sync Engine & Webhook

**Files:**
- Create: `backend/app/services/trak4_sync.py`
- Modify: `backend/app/services/scheduler.py` (add GPS sync job)
- Modify: `backend/app/__init__.py` (start sync on boot)

**Step 1: Create the sync engine**

Create `backend/app/services/trak4_sync.py` — handles device syncing, report ingestion, backfill, and adaptive polling interval. Uses APScheduler to schedule the next poll based on the device's reporting frequency.

Key functions:
- `sync_devices()` — polls `/device_list`, upserts into `trak4_devices`
- `sync_reports()` — for each device, fetches new GPS reports since last sync, deduplicates on `report_id`, bulk inserts
- `backfill_reports(device_id)` — walks backward in 24h chunks until 404, async-safe
- `ingest_webhook_report(payload)` — processes a single GPS report from the webhook push
- `get_sync_status()` — returns last sync time, report count, polling interval
- `start_sync_scheduler(app)` — registers an APScheduler interval job, adaptive to reporting frequency

**Step 2: Wire into app factory**

In `backend/app/__init__.py`, after the scheduler init block (~line 190), add the GPS sync startup:
```python
        # Start Trak-4 GPS sync if API key is configured
        if app.config.get('TRAK4_API_KEY'):
            from app.services.trak4_sync import start_sync_scheduler
            start_sync_scheduler(app)
```

**Step 3: Commit**
```bash
git add backend/app/services/trak4_sync.py backend/app/__init__.py
git commit -m "feat(gps): add Trak-4 sync engine with adaptive polling and webhook ingestion"
```

---

## Task 4: Backend — Flask API Routes

**Files:**
- Create: `backend/app/routes/gps.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Create the GPS routes blueprint**

Create `backend/app/routes/gps.py` with all 13 endpoints:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/devices` | List all devices with vehicle info |
| GET | `/devices/<id>` | Single device detail |
| POST | `/devices/<id>/assign` | Assign device to vehicle_id |
| GET | `/devices/<id>/reports` | GPS report history (query: start, end, limit, offset) |
| GET | `/devices/<id>/route` | Optimized route polyline (uses `to_route_point()`) |
| POST | `/devices/<id>/ping` | Force GPS update via Trak-4 API |
| GET | `/devices/<id>/frequencies` | Available reporting frequencies |
| PUT | `/devices/<id>/frequency` | Set reporting frequency |
| PUT | `/devices/<id>/label` | Set device label |
| PUT | `/devices/<id>/note` | Set device note |
| POST | `/sync` | Trigger manual sync/backfill |
| GET | `/sync/status` | Current sync status |
| POST | `/webhook/gps_report` | Trak-4 webhook receiver |

Key implementation notes:
- `device_id` in URL paths refers to our DB `id`, not Trak-4's `DeviceID`
- The webhook endpoint accepts Trak-4's push format (array of GPS reports in a container)
- Report queries support `start` and `end` ISO datetime params, `limit` (default 500, max 5000), `offset`
- Route endpoint returns `to_route_point()` lightweight dicts for efficient map polyline rendering
- All write operations that proxy to Trak-4 also update local DB state

**Step 2: Register blueprint in app factory**

Add before the "Create database tables" section in `backend/app/__init__.py`:
```python
    from app.routes.gps import gps_bp
    app.register_blueprint(gps_bp, url_prefix='/api/gps')
```

**Step 3: Commit**
```bash
git add backend/app/routes/gps.py backend/app/__init__.py
git commit -m "feat(gps): add Flask API routes for GPS tracking (13 endpoints)"
```

---

## Task 5: iOS — Codable Models

**Files:**
- Create: `Datacore/Models/Trak4.swift`

**Step 1: Create Swift model file**

```swift
import Foundation

// MARK: - Trak4 Device

struct Trak4Device: Codable, Sendable, Identifiable {
    let id: Int
    let deviceId: Int
    let vehicleId: Int?
    let vehicleName: String?
    let vehicleType: String?
    let keyCode: String?
    let label: String?
    let note: String?
    let imei: String?
    let firmware: String?
    let generation: Int?
    let productId: Int?
    let productName: String?
    let imageUrl: String?
    let reportingFrequencyId: Int?
    let reportingFrequencyName: String?
    let pendingFrequencyId: Int?
    let pendingFrequencyName: String?
    let lastLatitude: Double?
    let lastLongitude: Double?
    let lastPositionSource: String?
    let lastVoltage: Double?
    let lastVoltagePercent: Int?
    let lastReportTime: String?
    let lastReceivedTime: String?
    let lastSyncedAt: String?
    let createdAt: String?
    let updatedAt: String?
}

// MARK: - GPS Report

struct Trak4GPSReport: Codable, Sendable, Identifiable {
    let id: Int
    let deviceId: Int
    let reportId: String
    let latitude: Double?
    let longitude: Double?
    let heading: Int?
    let speed: Int?        // km/h from API
    let temperature: Int?  // Celsius from API
    let voltage: Double?
    let voltagePercent: Int?
    let hdop: Double?
    let rssi: Int?
    let accuracy: Int?
    let positionSource: String?
    let deviceState: String?
    let reportReason: String?
    let reportingFrequency: String?
    let createTime: String?
    let receivedTime: String?
}

// MARK: - Route Point (lightweight, for polyline rendering)

struct Trak4RoutePoint: Codable, Sendable {
    let lat: Double
    let lng: Double
    let time: String?
    let speed: Int?
    let heading: Int?
}

// MARK: - Reporting Frequency

struct Trak4ReportingFrequency: Codable, Sendable, Identifiable {
    let id: Int                     // ReportingFrequencyID from Trak-4
    let name: String                // e.g. "1d|10m Premium"
    let productId: Int?

    enum CodingKeys: String, CodingKey {
        case id = "ReportingFrequencyID"
        case name = "Name"
        case productId = "ProductID"
    }
}

// MARK: - Sync Status

struct Trak4SyncStatus: Codable, Sendable {
    let lastSyncedAt: String?
    let totalReports: Int
    let deviceCount: Int
    let pollingIntervalSeconds: Int
}

// MARK: - API Response Envelopes

struct Trak4DeviceListResponse: Codable, Sendable {
    let devices: [Trak4Device]
}

struct Trak4DeviceResponse: Codable, Sendable {
    let device: Trak4Device
}

struct Trak4ReportListResponse: Codable, Sendable {
    let reports: [Trak4GPSReport]
    let total: Int
}

struct Trak4RouteResponse: Codable, Sendable {
    let points: [Trak4RoutePoint]
}

struct Trak4FrequencyListResponse: Codable, Sendable {
    let frequencies: [Trak4ReportingFrequency]
}
```

**Step 2: Commit**
```bash
git add Datacore/Models/Trak4.swift
git commit -m "feat(gps): add Trak-4 Codable model structs for iOS"
```

---

## Task 6: iOS — API Endpoints & ViewModel

**Files:**
- Modify: `Datacore/Network/Endpoint.swift` (add GPS tracking cases)
- Create: `Datacore/ViewModels/GPSTrackingViewModel.swift`

**Step 1: Add Endpoint cases**

Add a new `// MARK: - GPS Tracking` section to `Endpoint.swift`:

```swift
    // MARK: - GPS Tracking
    case gpsDevices
    case gpsDevice(id: Int)
    case gpsAssignDevice(id: Int)
    case gpsReports(deviceId: Int)
    case gpsRoute(deviceId: Int)
    case gpsPing(deviceId: Int)
    case gpsFrequencies(deviceId: Int)
    case gpsSetFrequency(deviceId: Int)
    case gpsSetLabel(deviceId: Int)
    case gpsSetNote(deviceId: Int)
    case gpsSync
    case gpsSyncStatus
```

Add corresponding `path` and `method` switch cases matching the Flask routes.

**Step 2: Create the ViewModel**

`GPSTrackingViewModel` — `@Observable @MainActor` class managing:
- `devices: [Trak4Device]` — all tracked devices
- `selectedDevice: Trak4Device?` — currently focused device
- `reports: [Trak4GPSReport]` — report history for selected device
- `routePoints: [Trak4RoutePoint]` — polyline data for selected device + date range
- `syncStatus: Trak4SyncStatus?`
- `isLoading`, `error` states
- Async methods: `loadDevices()`, `loadReports(deviceId:start:end:)`, `loadRoute(deviceId:start:end:)`, `pingDevice(id:)`, `assignVehicle(deviceId:vehicleId:)`, `setFrequency(deviceId:frequencyId:)`, `setLabel(deviceId:label:)`, `setNote(deviceId:note:)`, `triggerSync()`, `loadSyncStatus()`

**Step 3: Commit**
```bash
git add Datacore/Network/Endpoint.swift Datacore/ViewModels/GPSTrackingViewModel.swift
git commit -m "feat(gps): add GPS tracking API endpoints and ViewModel"
```

---

## Task 7: iOS — Navigation & Module Registration

**Files:**
- Modify: `Datacore/Models/AppModule.swift` (add `.gpsTracking` case)
- Modify: `Datacore/Design/DatacoreColors.swift` (add `ModuleAccent.gpsTracking`)
- Modify: `Datacore/Views/Shared/ModuleLauncherSheet.swift` (add GPS card to Vehicles section)
- Modify: Mac/iPad sidebar files (add GPS Tracking nav entry)

**Step 1: Add AppModule case**

```swift
case gpsTracking

// In title:
case .gpsTracking: "GPS Tracking"
```

**Step 2: Add ModuleAccent**

```swift
case gpsTracking

// In color:
case .gpsTracking: return .orange
```

**Step 3: Add to ModuleLauncherSheet**

Add to the "Vehicles" section alongside OBD:
```swift
moduleCard(.gpsTracking, icon: "location.fill", tint: .orange)
```

**Step 4: Wire into navigation destinations** in the iPhone TabView, iPad CommandRail/sidebar, and Mac sidebar.

**Step 5: Commit**
```bash
git add Datacore/Models/AppModule.swift Datacore/Design/DatacoreColors.swift \
       Datacore/Views/Shared/ModuleLauncherSheet.swift
git commit -m "feat(gps): register GPS Tracking module in navigation and design system"
```

---

## Task 8: iOS — Map View (Core FindMy Experience)

**Files:**
- Create: `Datacore/Views/GPSTracking/GPSTrackingView.swift`
- Create: `Datacore/Views/GPSTracking/GPSMapView.swift`
- Create: `Datacore/Views/GPSTracking/VehicleAnnotation.swift`

**Step 1: Create GPSTrackingView (main container)**

Root view for the module. Contains:
- Full-screen `Map` (MapKit)
- Map style toggle overlay (standard/hybrid/satellite/3D flyover)
- Bottom sheet (iPhone, `.sheet` with 3 detents) or right sidebar panel (iPad/Mac)
- Loads devices on appear, auto-selects if only one device

iPhone layout: map fills screen, detail in `.sheet` with `[.fraction(0.15), .fraction(0.4), .large]` detents.
iPad/Mac layout: `HStack` — map on left (flex), detail panel on right (350pt fixed width).

**Step 2: Create GPSMapView (map + overlays)**

Extracted map component managing:
- `@Binding var cameraPosition: MapCameraPosition`
- `@Binding var mapStyle: MapStyleOption` (enum: standard, hybrid, satellite, flyover)
- Vehicle annotation at current position
- Optional accuracy circle overlay (`MapCircle`) when position source is non-GPS
- Optional route polyline (`MapPolyline`) with speed-gradient coloring
- Map style toggle button (top-right, SF Symbol `map.fill`)
- 3D toggle button (pitches camera to 45 degrees with `.realistic` elevation)

Map style enum:
```swift
enum MapStyleOption: String, CaseIterable {
    case standard, hybrid, satellite, flyover

    var mapStyle: MapStyle {
        switch self {
        case .standard: .standard
        case .hybrid: .hybrid
        case .satellite: .imagery
        case .flyover: .hybrid(elevation: .realistic)
        }
    }
}
```

**Step 3: Create VehicleAnnotation**

Custom `Annotation` view for the vehicle pin:
- SF Symbol icon based on `vehicle_type`:
  - `truck` → `pickup.side.fill`
  - `motorcycle` → `motorcycle.fill`
  - `suv` → `suv.side.fill`
  - `car` → `car.side.fill`
  - fallback → `car.side.fill`
- Optional circular vehicle photo override (from vehicle image)
- Battery indicator dot (green >50%, yellow 20-50%, red <20%)
- Pulsing blue ring when last report < 2 min ago
- Grey tint when stale (> 30 min)
- Heading arrow extending from pin edge

**Step 4: Commit**
```bash
git add Datacore/Views/GPSTracking/
git commit -m "feat(gps): add FindMy-style map view with vehicle annotations"
```

---

## Task 9: iOS — Detail Sheet / Sidebar Panel

**Files:**
- Create: `Datacore/Views/GPSTracking/GPSDetailPanel.swift`
- Create: `Datacore/Views/GPSTracking/GPSDeviceListView.swift`
- Create: `Datacore/Views/GPSTracking/GPSRouteHistoryView.swift`
- Create: `Datacore/Views/GPSTracking/GPSDeviceManagementView.swift`

**Step 1: GPSDetailPanel**

The expandable detail view shown in the bottom sheet (iPhone) or sidebar (iPad/Mac):

Collapsed section:
- Vehicle name + relative "Last seen X ago" timestamp
- Battery pill (icon + percentage, color-coded)
- Moving/Parked status badge with speed (if moving)

Medium section:
- Reverse-geocoded address (using CLGeocoder on the latest lat/lng)
- Stats row using `PremiumStatCard` in 2x2 grid:
  - Speed (km/h→mph conversion via `CountingNumber`)
  - Heading (compass direction + degrees)
  - Temperature (C→F conversion via `CountingNumber`)
  - Signal (RSSI quality indicator or HDOP)
- "Locate" button (force ping) — shows confirmation alert first, then triggers with `.platformFeedback(.success)` on completion
- Quick actions: "Directions" (opens Apple Maps with coordinate), "Share Location"

Expanded section:
- Device info: KeyCode, Firmware, Product Name, Current Reporting Frequency
- History / Route Replay (see GPSRouteHistoryView)
- Device Management (see GPSDeviceManagementView)

**Step 2: GPSDeviceListView**

If multiple devices exist, shown in collapsed sheet state. FindMy-style list:
- Each row: vehicle icon, name, "Last seen X ago", battery pill, status badge
- Tap to select → zooms map, expands detail
- `.staggerReveal()` on each row

**Step 3: GPSRouteHistoryView**

Date range picker + route visualization:
- Start/end date pickers
- "Show Route" button → loads `routePoints` → draws polyline on map
- Timeline scrubber (horizontal `Slider`) — dragging moves a marker along the route
- Report list below scrubber showing each ping with reason badges (PeriodicReport, MovementChange, etc.)
- `.staggerReveal()` on report list items

**Step 4: GPSDeviceManagementView**

Device settings section:
- Label text field (saves on submit)
- Note text field (saves on submit)
- Reporting frequency picker (`.pickerStyle(.menu)`)
- Sync status display (last synced, total reports, polling interval)
- "Sync Now" button

**Step 5: Commit**
```bash
git add Datacore/Views/GPSTracking/
git commit -m "feat(gps): add detail panel, device list, route history, and device management views"
```

---

## Task 10: iOS — Design System Polish

**Files:**
- Modify: All `GPSTracking/` view files

Apply the Datacore motion design system:
- `ShimmerView` / `PanelSkeleton` / `StatCardSkeleton` for loading states
- `.staggerReveal()` on device list items, report history rows, stat cards
- `.scrollReveal()` on detail panel sections
- `CountingNumber` for speed, temperature, battery percentage displays
- `PremiumStatCard` for the stats grid (speed, heading, temp, signal)
- `.platformFeedback(.success)` after locate ping, `.platformFeedback(.selection)` on map style toggle and device selection
- `.buttonStyle(.datacoreCard)` on device list rows
- Alert banner entrance animation for "Pending frequency change" notice

**Commit:**
```bash
git commit -m "feat(gps): apply design system polish — shimmer, stagger, haptics"
```

---

## Task 11: Build Verification

**Step 1: Regenerate Xcode project**
```bash
cd /path/to/Datacore-Apple
xcodegen generate
```

**Step 2: Build iOS**
```bash
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Build macOS**
```bash
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 4: Fix any errors until both produce zero error lines.**

**Step 5: Ask about version bump, commit, push.**

---

## Task Summary

| Task | Component | Estimated Complexity |
|------|-----------|---------------------|
| 1 | Backend DB models | Low |
| 2 | Trak-4 API client service | Medium |
| 3 | Sync engine + webhook ingestion | Medium-High |
| 4 | Flask API routes (13 endpoints) | Medium |
| 5 | iOS Codable models | Low |
| 6 | iOS Endpoint enum + ViewModel | Medium |
| 7 | Navigation + module registration | Low |
| 8 | Map view + annotations (core UX) | High |
| 9 | Detail panel + route history + management | High |
| 10 | Design system polish | Medium |
| 11 | Build verification | Low |

**Dependencies:** Tasks 1→2→3→4 (backend chain), Tasks 5→6→7→8→9→10→11 (iOS chain). Backend and iOS chains are independent and can be parallelized.
