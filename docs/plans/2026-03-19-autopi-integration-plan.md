# AutoPi TMU CM4 Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate AutoPi TMU CM4 into Datacore for CAN bus telemetry, OBD-II snapshot logging, and position tracking on a 2021 RAM 1500.

**Architecture:** AutoPi is a new backend module with its own sync engine (polling + webhook + backfill) modeled after the Trak-4 pattern. Position data is stored in new GPS module tables alongside Trak-4. OBD snapshots are stored in a tall/narrow table (one row per PID per reading). The sync engine cross-writes to GPS tables and updates `Vehicle.current_mileage` from odometer readings. Geofences are refactored from device-scoped to vehicle-scoped so they work with both device types.

**Tech Stack:** Python 3.12, Flask, SQLAlchemy, PostgreSQL, `requests` library for AutoPi REST API, APScheduler for polling.

**Design doc:** `docs/plans/2026-03-19-autopi-integration-design.md`

---

## Phase 0: API Discovery

### Task 1: AutoPi API Client Foundation

**Files:**
- Create: `backend/app/services/autopi_client.py`

**Step 1: Create the API client module**

This mirrors `trak4_client.py` — a thin wrapper around the AutoPi REST API with token auth.

```python
"""
AutoPi Cloud API Client

Proxy layer for the AutoPi REST API (https://api.autopi.io/).
All calls include the API token from the AUTOPI_API_TOKEN env var.

Auth: Token-based via Authorization header.
Base URL: https://api.autopi.io
"""
import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)

_TIMEOUT = 15


def _api_token():
    """Get the AutoPi API token from Flask config."""
    return current_app.config.get('AUTOPI_API_TOKEN', '')


def _device_id():
    """Get the configured AutoPi device ID from Flask config."""
    return current_app.config.get('AUTOPI_DEVICE_ID', '')


def _base_url():
    return 'https://api.autopi.io'


def _headers():
    """Build authorization headers for AutoPi API."""
    return {
        'Authorization': f'Bearer {_api_token()}',
        'Content-Type': 'application/json',
    }


def _get(path, params=None):
    """Make a GET request to the AutoPi API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    resp = requests.get(url, headers=_headers(), params=params, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _post(path, payload=None):
    """Make a POST request to the AutoPi API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    resp = requests.post(url, headers=_headers(), json=payload, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()
```

**Step 2: Commit**

```bash
git add backend/app/services/autopi_client.py
git commit -m "feat(autopi): add AutoPi Cloud API client foundation"
```

---

### Task 2: API Discovery Script

**Files:**
- Create: `backend/app/services/autopi_discovery.py`

**Step 1: Create discovery script with probing functions**

```python
"""
AutoPi API Discovery Script

Run these functions interactively to probe the AutoPi API and document
the response structures before building production models/sync.

Usage from Flask shell:
    flask shell
    >>> from app.services.autopi_discovery import *
    >>> discover_device_info()
"""
import json
import logging

from app.services import autopi_client

logger = logging.getLogger(__name__)


def _pretty(data):
    """Pretty-print JSON response."""
    print(json.dumps(data, indent=2, default=str))


def discover_device_info():
    """Probe GET /dongle/devices/ — list all devices on the account."""
    print("=== GET /dongle/devices/ ===")
    data = autopi_client._get('/dongle/devices/')
    _pretty(data)
    return data


def discover_device_detail(device_id=None):
    """Probe GET /dongle/devices/{id}/ — single device detail."""
    device_id = device_id or autopi_client._device_id()
    print(f"=== GET /dongle/devices/{device_id}/ ===")
    data = autopi_client._get(f'/dongle/devices/{device_id}/')
    _pretty(data)
    return data


def discover_position_data(device_id=None):
    """Probe position/location endpoints — see what GPS data looks like."""
    device_id = device_id or autopi_client._device_id()
    # Try the logbook/trips endpoint
    endpoints = [
        f'/logbook/trips/?device={device_id}',
        f'/logbook/locations/?device={device_id}',
    ]
    for endpoint in endpoints:
        print(f"\n=== GET {endpoint} ===")
        try:
            data = autopi_client._get(endpoint)
            _pretty(data)
        except Exception as e:
            print(f"  Error: {e}")
    return None


def discover_obd_pids():
    """Probe GET /can_logging/pids/ — list available OBD-II PIDs."""
    print("=== GET /can_logging/pids/ ===")
    data = autopi_client._get('/can_logging/pids/')
    _pretty(data)
    return data


def discover_can_loggers():
    """Probe GET /can_logging/loggers/ — list configured data loggers."""
    print("=== GET /can_logging/loggers/ ===")
    data = autopi_client._get('/can_logging/loggers/')
    _pretty(data)
    return data


def discover_can_channels():
    """Probe GET /can_logging/channels/ — list CAN bus channels."""
    print("=== GET /can_logging/channels/ ===")
    data = autopi_client._get('/can_logging/channels/')
    _pretty(data)
    return data


def discover_storage_data(device_id=None):
    """Probe storage/logged data endpoints — see how recorded data comes back."""
    device_id = device_id or autopi_client._device_id()
    # Try common data retrieval endpoints
    endpoints = [
        f'/dongle/devices/{device_id}/alerts/',
        '/can_logging/queries/',
    ]
    for endpoint in endpoints:
        print(f"\n=== GET {endpoint} ===")
        try:
            data = autopi_client._get(endpoint)
            _pretty(data)
        except Exception as e:
            print(f"  Error: {e}")
    return None


def discover_output_handlers():
    """Probe GET /can_logging/output_handlers/ — see webhook/push config options."""
    print("=== GET /can_logging/output_handlers/ ===")
    data = autopi_client._get('/can_logging/output_handlers/')
    _pretty(data)
    return data


def discover_all():
    """Run all discovery functions and save results to a file."""
    import io
    import sys

    # Capture output
    old_stdout = sys.stdout
    sys.stdout = buffer = io.StringIO()

    try:
        discover_device_info()
        print("\n" + "=" * 80 + "\n")
        discover_obd_pids()
        print("\n" + "=" * 80 + "\n")
        discover_can_loggers()
        print("\n" + "=" * 80 + "\n")
        discover_can_channels()
        print("\n" + "=" * 80 + "\n")
        discover_output_handlers()
    finally:
        sys.stdout = old_stdout

    output = buffer.getvalue()
    print(output)
    print(f"\n[Discovery complete — {len(output)} chars captured]")
    return output
```

**Step 2: Add config vars to Config class**

In `backend/app/config.py`, add after the `TRAK4_API_BASE` line:

```python
# AutoPi Cloud API
AUTOPI_API_TOKEN = os.environ.get('AUTOPI_API_TOKEN', '')
AUTOPI_DEVICE_ID = os.environ.get('AUTOPI_DEVICE_ID', '')
AUTOPI_SYNC_INTERVAL = int(os.environ.get('AUTOPI_SYNC_INTERVAL', 300))
```

**Step 3: Add env vars to .env.example**

Append to `.env.example`:

```
# AutoPi Cloud API (TMU CM4 OBD-II unit)
# Generate a token at: https://my.autopi.io → Settings → API Tokens
AUTOPI_API_TOKEN=
AUTOPI_DEVICE_ID=
```

**Step 4: Commit**

```bash
git add backend/app/services/autopi_discovery.py backend/app/config.py .env.example
git commit -m "feat(autopi): add API discovery script and config vars"
```

---

### Task 3: Run API Discovery (Interactive — User Runs)

**This is an interactive task.** The user configures their AutoPi token and device ID, then runs the discovery functions. We analyze the responses and refine the schema.

**Steps for the user:**

1. Set `AUTOPI_API_TOKEN` and `AUTOPI_DEVICE_ID` in your Docker environment (Dockge)
2. Restart the backend container
3. Run discovery:
   ```bash
   docker exec -it life-hub-main-backend-1 flask shell
   >>> from app.services.autopi_discovery import *
   >>> discover_device_info()
   >>> discover_position_data()
   >>> discover_obd_pids()
   ```
4. Paste back the output (or relevant excerpts) so we can see the actual field names and data shapes

**After discovery:** We refine the database models (Task 4+) based on the real response structures. The plan below uses the preliminary schema from the design doc — field names will be adjusted to match actual API responses.

---

## Phase 1: Backend — Database Models

### Task 4: AutoPi Device and Position Models (GPS Module)

**Files:**
- Modify: `backend/app/models/gps_tracking.py` (add new classes at the end)
- Modify: `backend/app/models/__init__.py` (add imports)

**Step 1: Add AutoPiDevice and AutoPiPositionReport models**

Append to `backend/app/models/gps_tracking.py`:

```python
class AutoPiDevice(db.Model):
    """An AutoPi TMU CM4 OBD-II device, linked 1:1 to a vehicle."""
    __tablename__ = 'autopi_devices'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(64), unique=True, nullable=False)       # AutoPi's device UUID
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='SET NULL'),
                           nullable=True, unique=True)                       # 1:1 assignment
    unit_id = db.Column(db.String(64))                                       # AutoPi unit identifier
    label = db.Column(db.String(100))                                        # User-friendly name
    hw_version = db.Column(db.String(50))                                    # Hardware board version
    firmware = db.Column(db.String(100))                                     # Current release
    last_latitude = db.Column(db.Float)
    last_longitude = db.Column(db.Float)
    last_report_time = db.Column(db.DateTime)
    last_synced_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicle = db.relationship('Vehicle', backref=db.backref('autopi_device', uselist=False))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'vehicle_id': self.vehicle_id,
            'vehicle_name': self.vehicle.to_dict().get('display_name') if self.vehicle else None,
            'vehicle_type': self.vehicle.vehicle_type if self.vehicle else None,
            'unit_id': self.unit_id,
            'label': self.label,
            'hw_version': self.hw_version,
            'firmware': self.firmware,
            'last_latitude': self.last_latitude,
            'last_longitude': self.last_longitude,
            'last_report_time': self.last_report_time.isoformat() + 'Z' if self.last_report_time else None,
            'last_synced_at': self.last_synced_at.isoformat() + 'Z' if self.last_synced_at else None,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class AutoPiPositionReport(db.Model):
    """A position report from an AutoPi device. Stored permanently."""
    __tablename__ = 'autopi_position_reports'
    __table_args__ = (
        db.Index('idx_autopi_pos_device_recorded', 'device_id', 'recorded_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('autopi_devices.id', ondelete='CASCADE'),
                          nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    speed = db.Column(db.Float)                                              # km/h
    heading = db.Column(db.Float)                                            # degrees
    altitude = db.Column(db.Float)                                           # meters
    recorded_at = db.Column(db.DateTime, nullable=False)                     # AutoPi timestamp
    received_at = db.Column(db.DateTime, default=datetime.utcnow)            # Datacore ingestion

    device = db.relationship('AutoPiDevice', backref=db.backref('position_reports', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'speed': self.speed,
            'heading': self.heading,
            'altitude': self.altitude,
            'recorded_at': self.recorded_at.isoformat() + 'Z' if self.recorded_at else None,
            'received_at': self.received_at.isoformat() + 'Z' if self.received_at else None,
        }

    def to_route_point(self):
        """Lightweight dict for route polyline rendering."""
        return {
            'lat': self.latitude,
            'lng': self.longitude,
            'time': self.recorded_at.isoformat() + 'Z' if self.recorded_at else None,
            'speed': self.speed,
            'heading': self.heading,
        }
```

**Step 2: Add imports to `backend/app/models/__init__.py`**

Add to the gps_tracking import line:

```python
from .gps_tracking import Trak4Device, Trak4GPSReport, Trak4Geofence, AutoPiDevice, AutoPiPositionReport
```

**Step 3: Commit**

```bash
git add backend/app/models/gps_tracking.py backend/app/models/__init__.py
git commit -m "feat(autopi): add AutoPiDevice and AutoPiPositionReport models"
```

---

### Task 5: AutoPi OBD Snapshot Model

**Files:**
- Create: `backend/app/models/autopi.py`
- Modify: `backend/app/models/__init__.py` (add import)
- Modify: `backend/app/__init__.py` (add to model imports in create_app)

**Step 1: Create the OBD snapshot model**

```python
"""
AutoPi Telemetry Module - Database Models

Tables:
  - autopi_obd_snapshots: Decoded OBD-II / CAN readings, one row per PID per reading.
    Tall/narrow schema so new PIDs appear without schema changes.

The AutoPi device and position models live in gps_tracking.py since
position data is part of the GPS tracking module.
"""
from datetime import datetime
from app import db


class AutoPiOBDSnapshot(db.Model):
    """A single decoded OBD-II reading from an AutoPi device."""
    __tablename__ = 'autopi_obd_snapshots'
    __table_args__ = (
        db.Index('idx_autopi_obd_device_pid_time', 'device_id', 'pid_name', 'recorded_at'),
        db.Index('idx_autopi_obd_device_time', 'device_id', 'recorded_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('autopi_devices.id', ondelete='CASCADE'),
                          nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)
    pid_name = db.Column(db.String(100), nullable=False)       # e.g. "odometer", "coolant_temp", "rpm"
    pid_code = db.Column(db.String(20))                         # e.g. "01 0C" for RPM
    value = db.Column(db.Float, nullable=False)                 # Decoded numeric value
    unit = db.Column(db.String(30))                             # e.g. "miles", "°F", "RPM"
    raw_value = db.Column(db.String(200))                       # Original value from API (debugging)

    device = db.relationship('AutoPiDevice', backref=db.backref('obd_snapshots', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'recorded_at': self.recorded_at.isoformat() + 'Z' if self.recorded_at else None,
            'pid_name': self.pid_name,
            'pid_code': self.pid_code,
            'value': self.value,
            'unit': self.unit,
            'raw_value': self.raw_value,
        }
```

**Step 2: Add import to `backend/app/models/__init__.py`**

```python
from .autopi import AutoPiOBDSnapshot
```

**Step 3: Add model import in `backend/app/__init__.py`**

In the `with app.app_context():` block, add `autopi` to the model import line:

```python
from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, debt, timecard, gps_tracking, jumper, watch, autopi  # noqa: F401
```

**Step 4: Commit**

```bash
git add backend/app/models/autopi.py backend/app/models/__init__.py backend/app/__init__.py
git commit -m "feat(autopi): add AutoPiOBDSnapshot model for telemetry data"
```

---

## Phase 1: Backend — Geofence Refactor

### Task 6: Refactor Geofences from Device-Scoped to Vehicle-Scoped

**Files:**
- Modify: `backend/app/models/gps_tracking.py` (update Trak4Geofence → Geofence)
- Modify: `backend/app/models/__init__.py` (update import)
- Modify: `backend/app/routes/gps.py` (update geofence routes)
- Modify: `backend/app/services/trak4_sync.py` (update geofence checks)
- Modify: `backend/app/__init__.py` (add migration SQL)

This is the most delicate task — it changes an existing table. The approach:

1. Add a `vehicle_id` column to `trak4_geofences` (nullable at first)
2. Backfill `vehicle_id` from the device's `vehicle_id`
3. Update routes to use `vehicle_id` instead of `device_id`
4. Update geofence check logic to query by `vehicle_id`

**Step 1: Add safe migration SQL to `_run_safe_migrations()` in `__init__.py`**

Add these migration statements to the `migrations` list:

```python
# Geofence: add vehicle_id column for device-agnostic geofences
"""ALTER TABLE trak4_geofences
   ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE""",

# Backfill vehicle_id from the device's vehicle assignment
"""UPDATE trak4_geofences g
   SET vehicle_id = d.vehicle_id
   FROM trak4_devices d
   WHERE g.device_id = d.id AND g.vehicle_id IS NULL AND d.vehicle_id IS NOT NULL""",
```

**Step 2: Update the Trak4Geofence model to include vehicle_id**

Add to the `Trak4Geofence` class (keep `device_id` for backward compat during migration):

```python
vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='CASCADE'),
                       nullable=True, index=True)
```

Add a vehicle relationship:
```python
vehicle = db.relationship('Vehicle', backref=db.backref('geofences', lazy='dynamic'))
```

Update `to_dict()` to include `vehicle_id`.

**Step 3: Update geofence routes to accept vehicle-based queries**

Add new vehicle-scoped geofence endpoints alongside (not replacing) the device-scoped ones:

```python
@gps_bp.route('/vehicles/<int:vehicle_id>/geofences', methods=['GET'])
def list_vehicle_geofences(vehicle_id):
    """List all geofence zones for a vehicle (device-agnostic)."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    fences = Trak4Geofence.query.filter_by(vehicle_id=vehicle.id).order_by(Trak4Geofence.created_at.desc()).all()
    return jsonify({'geofences': [f.to_dict() for f in fences]})


@gps_bp.route('/vehicles/<int:vehicle_id>/geofences', methods=['POST'])
def create_vehicle_geofence(vehicle_id):
    """Create a new geofence zone for a vehicle."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json(silent=True) or {}
    # ... same validation as existing create_geofence ...
    fence = Trak4Geofence(
        vehicle_id=vehicle.id,
        device_id=None,  # Vehicle-scoped, not device-scoped
        # ... rest of fields ...
    )
```

**Step 4: Update `check_geofences()` in `trak4_sync.py`**

Change the query from `filter_by(device_id=device.id)` to also check `vehicle_id`:

```python
def check_geofences_for_vehicle(vehicle_id, lat, lng, device_name):
    """Check all enabled geofences for a vehicle (works with any device type)."""
    if lat is None or lng is None or vehicle_id is None:
        return

    from app.models.gps_tracking import Trak4Geofence
    from app.services.event_bus import emit

    fences = Trak4Geofence.query.filter_by(vehicle_id=vehicle_id, enabled=True).all()
    # ... same logic, using vehicle_id for lookups ...
```

**Step 5: Commit**

```bash
git add backend/app/models/gps_tracking.py backend/app/routes/gps.py \
        backend/app/services/trak4_sync.py backend/app/__init__.py \
        backend/app/models/__init__.py
git commit -m "refactor(gps): make geofences vehicle-scoped for multi-device support"
```

---

## Phase 1: Backend — Sync Engine & Routes

### Task 7: AutoPi Sync Engine

**Files:**
- Create: `backend/app/services/autopi_sync.py`

**Step 1: Create the sync engine**

This follows the Trak-4 pattern exactly. The actual API endpoint paths and response parsing will be refined after Task 3 (API discovery). The structure below is the scaffold:

```python
"""
AutoPi Sync Engine

Handles three ingestion paths (mirrors Trak-4 pattern):
  1. Polling — fetches position + OBD data on an interval
  2. Webhook — processes real-time pushes from AutoPi output handlers
  3. Backfill — walks backward through time for historical import

All position reports are deduplicated on recorded_at timestamp.
OBD snapshots are deduplicated on (device_id, pid_name, recorded_at).
"""
import logging
from datetime import datetime, timedelta

from app import db
from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport
from app.models.autopi import AutoPiOBDSnapshot
from app.models.vehicle import Vehicle
from app.services import autopi_client

logger = logging.getLogger(__name__)


def _utcnow():
    return datetime.utcnow()


# -- Device Sync --------------------------------------------------------------

def sync_device():
    """
    Fetch device info from AutoPi Cloud and upsert into autopi_devices.
    Currently only one device (configured via AUTOPI_DEVICE_ID).
    """
    try:
        api_device_id = autopi_client._device_id()
        if not api_device_id:
            logger.warning("AUTOPI_DEVICE_ID not configured, skipping device sync")
            return None

        data = autopi_client._get(f'/dongle/devices/{api_device_id}/')

        device = AutoPiDevice.query.filter_by(device_id=api_device_id).first()
        if not device:
            device = AutoPiDevice(device_id=api_device_id)
            db.session.add(device)

        # Update fields from API response (field names TBD after discovery)
        device.unit_id = data.get('unit_id') or data.get('id')
        device.label = data.get('name') or data.get('display_name')
        device.hw_version = data.get('hw_version')
        device.firmware = data.get('release', {}).get('version') if isinstance(data.get('release'), dict) else data.get('release')
        device.last_synced_at = _utcnow()

        db.session.commit()
        logger.info(f"AutoPi device sync complete: {device.label or device.device_id}")
        return device

    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi device sync failed: {e}")
        return None


# -- Position Sync -------------------------------------------------------------

def sync_positions(device=None):
    """
    Fetch position data from AutoPi Cloud and store new position reports.
    Deduplicates on recorded_at timestamp.
    """
    if device is None:
        device = AutoPiDevice.query.first()
    if not device:
        return 0

    try:
        # TODO: Replace with actual endpoint path after discovery
        # This is a placeholder — the real endpoint and response shape
        # will be determined in Task 3
        since = device.last_synced_at or (_utcnow() - timedelta(hours=24))

        positions = autopi_client._get(
            f'/logbook/locations/',
            params={'device': device.device_id}
        )

        # Handle paginated results
        results = positions.get('results', positions) if isinstance(positions, dict) else positions
        if not isinstance(results, list):
            results = []

        new_count = 0
        for pos in results:
            recorded_at = _parse_dt(pos.get('timestamp') or pos.get('recorded_at') or pos.get('utc_timestamp'))
            if not recorded_at:
                continue

            # Deduplicate on timestamp
            existing = AutoPiPositionReport.query.filter_by(
                device_id=device.id,
                recorded_at=recorded_at,
            ).first()
            if existing:
                continue

            lat = pos.get('latitude') or pos.get('lat')
            lng = pos.get('longitude') or pos.get('lng') or pos.get('lon')
            if lat is None or lng is None:
                continue

            report = AutoPiPositionReport(
                device_id=device.id,
                latitude=float(lat),
                longitude=float(lng),
                speed=pos.get('speed'),
                heading=pos.get('heading') or pos.get('course'),
                altitude=pos.get('altitude') or pos.get('alt'),
                recorded_at=recorded_at,
            )
            db.session.add(report)
            new_count += 1

            # Update device last known position
            if not device.last_report_time or recorded_at > device.last_report_time:
                device.last_latitude = report.latitude
                device.last_longitude = report.longitude
                device.last_report_time = recorded_at

        if new_count:
            # Check geofences with latest position
            if device.vehicle_id and device.last_latitude:
                check_geofences_for_vehicle(
                    device.vehicle_id,
                    device.last_latitude,
                    device.last_longitude,
                    device.label or f'AutoPi {device.device_id}',
                )

        db.session.commit()
        if new_count:
            logger.info(f"AutoPi position sync: {new_count} new report(s)")
        return new_count

    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi position sync failed: {e}")
        return 0


# -- OBD Snapshot Sync ---------------------------------------------------------

def sync_obd_snapshots(device=None):
    """
    Fetch OBD-II / CAN decoded data and store snapshots.
    Also updates Vehicle.current_mileage when odometer PID arrives.
    """
    if device is None:
        device = AutoPiDevice.query.first()
    if not device:
        return 0

    try:
        # TODO: Replace with actual endpoint path after discovery
        # This will depend on how AutoPi exposes logged CAN data
        # Placeholder — actual implementation depends on API discovery
        logger.info("AutoPi OBD sync: waiting for API discovery to determine endpoints")
        return 0

    except Exception as e:
        db.session.rollback()
        logger.error(f"AutoPi OBD sync failed: {e}")
        return 0


def _update_vehicle_mileage(device, odometer_value):
    """Update Vehicle.current_mileage when a new odometer reading arrives."""
    if not device.vehicle_id or odometer_value is None:
        return

    vehicle = Vehicle.query.get(device.vehicle_id)
    if not vehicle:
        return

    # Only update if the new reading is higher (odometer doesn't go backward)
    if vehicle.current_mileage is None or odometer_value > vehicle.current_mileage:
        old = vehicle.current_mileage
        vehicle.current_mileage = odometer_value
        logger.info(f"Vehicle {vehicle.id} mileage updated: {old} → {odometer_value}")


# -- Webhook Ingestion ---------------------------------------------------------

def ingest_webhook(payload):
    """
    Process data pushed via AutoPi webhook/output handler.
    Returns count of new records ingested.
    """
    # TODO: Implement after Task 3 determines output handler format
    logger.info("AutoPi webhook received (handler not yet implemented)")
    return 0


# -- Backfill ------------------------------------------------------------------

def backfill_positions(days=7):
    """
    Walk backward through position history for initial import.
    """
    device = AutoPiDevice.query.first()
    if not device:
        return 0

    # TODO: Implement after discovery determines pagination/date filtering
    logger.info(f"AutoPi backfill requested ({days} days) — pending API discovery")
    return 0


# -- Sync Status ---------------------------------------------------------------

def get_sync_status():
    """Return current AutoPi sync status for the API."""
    device = AutoPiDevice.query.first()
    position_count = AutoPiPositionReport.query.count()
    snapshot_count = AutoPiOBDSnapshot.query.count()

    return {
        'device_configured': device is not None,
        'device_label': device.label if device else None,
        'last_synced_at': device.last_synced_at.isoformat() + 'Z' if device and device.last_synced_at else None,
        'total_position_reports': position_count,
        'total_obd_snapshots': snapshot_count,
    }


# -- Scheduler Integration ----------------------------------------------------

def start_sync_scheduler(app):
    """Register the AutoPi sync job with APScheduler."""
    from app.services.scheduler import scheduler

    if not scheduler:
        logger.warning("Scheduler not available, AutoPi sync will not run")
        return

    interval = app.config.get('AUTOPI_SYNC_INTERVAL', 300)

    # Initial sync on startup (delayed 15s to avoid blocking init)
    scheduler.add_job(
        _run_sync,
        trigger='date',
        id='autopi_sync_startup',
        run_date=_utcnow() + timedelta(seconds=15),
        replace_existing=True,
    )

    # Recurring sync
    scheduler.add_job(
        _run_sync,
        trigger='interval',
        id='autopi_sync',
        seconds=interval,
        replace_existing=True,
    )
    logger.info(f"AutoPi sync scheduled (every {interval}s)")


def _run_sync():
    """Execute device + position + OBD sync inside app context."""
    from app.services.scheduler import _app
    if not _app:
        return

    with _app.app_context():
        try:
            device = sync_device()
            if device:
                sync_positions(device)
                sync_obd_snapshots(device)
        except Exception as e:
            logger.error(f"AutoPi sync cycle failed: {e}")


# -- Geofence Check (vehicle-scoped) ------------------------------------------

def check_geofences_for_vehicle(vehicle_id, lat, lng, device_name):
    """Check all enabled geofences for a vehicle. Works with any device type."""
    if lat is None or lng is None or vehicle_id is None:
        return

    from app.models.gps_tracking import Trak4Geofence
    from app.services.event_bus import emit
    from app.services.trak4_sync import _is_inside_geofence

    fences = Trak4Geofence.query.filter_by(vehicle_id=vehicle_id, enabled=True).all()
    for fence in fences:
        inside = _is_inside_geofence(lat, lng, fence)
        new_state = 'inside' if inside else 'outside'

        if fence.last_state is None:
            fence.last_state = new_state
            continue

        if fence.last_state == new_state:
            continue

        old_state = fence.last_state
        fence.last_state = new_state

        payload = dict(
            device_name=device_name,
            vehicle_name=device_name,
            zone_name=fence.name,
            zone_id=fence.id,
            latitude=lat,
            longitude=lng,
        )

        if old_state == 'outside' and new_state == 'inside' and fence.alert_on_entry:
            payload['direction'] = 'entered'
            emit('gps.geofence_enter', **payload)
            logger.info(f'Geofence ENTER: {device_name} entered "{fence.name}"')

        elif old_state == 'inside' and new_state == 'outside' and fence.alert_on_exit:
            payload['direction'] = 'exited'
            emit('gps.geofence_exit', **payload)
            logger.info(f'Geofence EXIT: {device_name} exited "{fence.name}"')

    db.session.commit()


# -- Helpers -------------------------------------------------------------------

def _parse_dt(dt_str):
    """Parse an ISO datetime string into a naive UTC datetime."""
    if not dt_str:
        return None
    try:
        if isinstance(dt_str, datetime):
            return dt_str.replace(tzinfo=None)
        dt_str = str(dt_str).replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)
        return dt.replace(tzinfo=None)
    except (ValueError, TypeError):
        return None
```

**Step 2: Commit**

```bash
git add backend/app/services/autopi_sync.py
git commit -m "feat(autopi): add sync engine with polling, webhook, and backfill scaffolds"
```

---

### Task 8: AutoPi API Routes

**Files:**
- Create: `backend/app/routes/autopi.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Create the route blueprint**

```python
"""
AutoPi Telemetry Module - API Routes

Device management, OBD snapshot queries, sync controls, and webhook endpoint.

Read endpoints:
  GET /device                        → AutoPi device info
  GET /snapshots                     → OBD snapshot history (paginated, filterable)
  GET /snapshots/latest              → Latest reading for each PID
  GET /snapshots/pids                → List of all PIDs seen
  GET /sync/status                   → Current sync status

Write endpoints:
  POST /device/assign                → Assign device to a vehicle
  POST /sync                         → Trigger manual sync
  POST /sync/backfill                → Trigger historical backfill

Webhook endpoint:
  POST /webhook                      → Receives AutoPi data pushes

Blueprint is registered with url_prefix='/api/autopi' in __init__.py.
"""
import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from app import db
from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport
from app.models.autopi import AutoPiOBDSnapshot
from app.models.vehicle import Vehicle
from app.services.autopi_sync import (
    sync_device, sync_positions, sync_obd_snapshots,
    backfill_positions, get_sync_status, ingest_webhook,
)

logger = logging.getLogger(__name__)
autopi_bp = Blueprint('autopi', __name__)


# -- Read Endpoints -----------------------------------------------------------

@autopi_bp.route('/device', methods=['GET'])
def get_device():
    """Get the AutoPi device info."""
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'device': None, 'message': 'No AutoPi device configured'})
    return jsonify({'device': device.to_dict()})


@autopi_bp.route('/snapshots', methods=['GET'])
def list_snapshots():
    """Get OBD snapshot history, filterable by PID and date range.

    Query params:
      - pid (string) — filter by pid_name
      - start (ISO datetime)
      - end (ISO datetime)
      - limit (int, default 500, max 5000)
      - offset (int, default 0)
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'snapshots': [], 'total': 0})

    query = AutoPiOBDSnapshot.query.filter_by(device_id=device.id)

    pid = request.args.get('pid')
    if pid:
        query = query.filter_by(pid_name=pid)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(AutoPiOBDSnapshot.recorded_at >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(AutoPiOBDSnapshot.recorded_at <= end)

    total = query.count()

    limit = min(max(1, request.args.get('limit', 500, type=int)), 5000)
    offset = max(0, request.args.get('offset', 0, type=int))

    snapshots = query.order_by(AutoPiOBDSnapshot.recorded_at.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'snapshots': [s.to_dict() for s in snapshots],
        'total': total,
    })


@autopi_bp.route('/snapshots/latest', methods=['GET'])
def latest_snapshots():
    """Get the most recent reading for each PID."""
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'snapshots': []})

    # Subquery: max recorded_at per pid_name
    from sqlalchemy import func
    subq = db.session.query(
        AutoPiOBDSnapshot.pid_name,
        func.max(AutoPiOBDSnapshot.recorded_at).label('max_time'),
    ).filter_by(device_id=device.id).group_by(AutoPiOBDSnapshot.pid_name).subquery()

    latest = db.session.query(AutoPiOBDSnapshot).join(
        subq,
        db.and_(
            AutoPiOBDSnapshot.pid_name == subq.c.pid_name,
            AutoPiOBDSnapshot.recorded_at == subq.c.max_time,
        ),
    ).filter(AutoPiOBDSnapshot.device_id == device.id).all()

    return jsonify({'snapshots': [s.to_dict() for s in latest]})


@autopi_bp.route('/snapshots/pids', methods=['GET'])
def list_pids():
    """List all unique PID names that have been recorded."""
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'pids': []})

    from sqlalchemy import func
    pids = db.session.query(
        AutoPiOBDSnapshot.pid_name,
        AutoPiOBDSnapshot.unit,
        func.count(AutoPiOBDSnapshot.id).label('count'),
        func.max(AutoPiOBDSnapshot.recorded_at).label('last_seen'),
    ).filter_by(device_id=device.id).group_by(
        AutoPiOBDSnapshot.pid_name,
        AutoPiOBDSnapshot.unit,
    ).all()

    return jsonify({
        'pids': [
            {
                'pid_name': p.pid_name,
                'unit': p.unit,
                'count': p.count,
                'last_seen': p.last_seen.isoformat() + 'Z' if p.last_seen else None,
            }
            for p in pids
        ]
    })


@autopi_bp.route('/sync/status', methods=['GET'])
def sync_status():
    """Get current AutoPi sync status."""
    return jsonify(get_sync_status())


# -- Write Endpoints ----------------------------------------------------------

@autopi_bp.route('/device/assign', methods=['POST'])
def assign_vehicle():
    """Assign the AutoPi device to a vehicle.

    Expects: {"vehicle_id": 1}  (or null to unassign)
    """
    device = AutoPiDevice.query.first()
    if not device:
        return jsonify({'error': 'No AutoPi device found'}), 404

    data = request.get_json(silent=True) or {}
    vehicle_id = data.get('vehicle_id')

    if vehicle_id is not None:
        vehicle = Vehicle.query.get(vehicle_id)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404

    device.vehicle_id = vehicle_id
    db.session.commit()
    return jsonify({'device': device.to_dict()})


@autopi_bp.route('/sync', methods=['POST'])
def trigger_sync():
    """Trigger a manual sync of device, positions, and OBD data."""
    try:
        device = sync_device()
        pos_count = sync_positions(device) if device else 0
        obd_count = sync_obd_snapshots(device) if device else 0
        return jsonify({
            'success': True,
            'message': f'Sync complete. {pos_count} position(s), {obd_count} OBD snapshot(s).',
        })
    except Exception as e:
        logger.error(f"Manual AutoPi sync failed: {e}")
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


@autopi_bp.route('/sync/backfill', methods=['POST'])
def trigger_backfill():
    """Trigger historical backfill.

    Expects: {"days": 7}  (default 7)
    """
    data = request.get_json(silent=True) or {}
    days = data.get('days', 7)

    try:
        count = backfill_positions(days=days)
        return jsonify({
            'success': True,
            'message': f'Backfill complete. {count} new position report(s).',
        })
    except Exception as e:
        logger.error(f"AutoPi backfill failed: {e}")
        return jsonify({'error': f'Backfill failed: {str(e)}'}), 500


# -- Webhook Endpoint ---------------------------------------------------------

@autopi_bp.route('/webhook', methods=['POST'])
def webhook():
    """Receive data pushes from AutoPi output handlers."""
    payload = request.get_json(silent=True) or {}
    count = ingest_webhook(payload)
    return jsonify({'received': True, 'new': count})


# -- Helpers ------------------------------------------------------------------

def _parse_dt(value):
    """Parse an ISO datetime string into a naive UTC datetime."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    try:
        value = value.replace('Z', '+00:00')
        dt = datetime.fromisoformat(value)
        return dt.replace(tzinfo=None)
    except (ValueError, TypeError):
        return None
```

**Step 2: Register blueprint in `__init__.py`**

Add after the GPS blueprint registration:

```python
from app.routes.autopi import autopi_bp
app.register_blueprint(autopi_bp, url_prefix='/api/autopi')
```

**Step 3: Start AutoPi sync scheduler in `__init__.py`**

Add after the Trak-4 scheduler block:

```python
# Start AutoPi sync if API token is configured
if app.config.get('AUTOPI_API_TOKEN'):
    from app.services.autopi_sync import start_sync_scheduler as start_autopi_sync
    start_autopi_sync(app)
```

**Step 4: Commit**

```bash
git add backend/app/routes/autopi.py backend/app/__init__.py
git commit -m "feat(autopi): add API routes and scheduler integration"
```

---

### Task 9: GPS Routes — Add Tracked Vehicles Endpoint

**Files:**
- Modify: `backend/app/routes/gps.py`

**Step 1: Add a unified tracked vehicles endpoint**

This new endpoint returns all vehicles that have any tracking device assigned (Trak-4 or AutoPi), with their latest position and device type. The Apple app's vehicle selector will use this.

```python
@gps_bp.route('/tracked-vehicles', methods=['GET'])
def tracked_vehicles():
    """List all vehicles with a GPS tracking device assigned.

    Returns vehicles with their latest position and device type,
    regardless of whether the source is Trak-4 or AutoPi.
    """
    from app.models.gps_tracking import AutoPiDevice

    vehicles = []

    # Trak-4 devices
    for device in Trak4Device.query.filter(Trak4Device.vehicle_id.isnot(None)).all():
        vehicles.append({
            'vehicle_id': device.vehicle_id,
            'vehicle_name': device.vehicle.to_dict().get('display_name') if device.vehicle else None,
            'vehicle_type': device.vehicle.vehicle_type if device.vehicle else None,
            'device_type': 'trak4',
            'device_id': device.id,
            'latitude': device.last_latitude,
            'longitude': device.last_longitude,
            'last_report_time': device.last_report_time.isoformat() + 'Z' if device.last_report_time else None,
        })

    # AutoPi devices
    for device in AutoPiDevice.query.filter(AutoPiDevice.vehicle_id.isnot(None)).all():
        vehicles.append({
            'vehicle_id': device.vehicle_id,
            'vehicle_name': device.vehicle.to_dict().get('display_name') if device.vehicle else None,
            'vehicle_type': device.vehicle.vehicle_type if device.vehicle else None,
            'device_type': 'autopi',
            'device_id': device.id,
            'latitude': device.last_latitude,
            'longitude': device.last_longitude,
            'last_report_time': device.last_report_time.isoformat() + 'Z' if device.last_report_time else None,
        })

    return jsonify({'vehicles': vehicles})
```

**Step 2: Add AutoPi position route endpoints**

```python
@gps_bp.route('/autopi/<int:device_id>/reports', methods=['GET'])
def get_autopi_reports(device_id):
    """Get position report history for an AutoPi device."""
    from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport

    device = AutoPiDevice.query.get_or_404(device_id)
    query = AutoPiPositionReport.query.filter_by(device_id=device.id)

    start = _parse_dt(request.args.get('start'))
    if start:
        query = query.filter(AutoPiPositionReport.recorded_at >= start)

    end = _parse_dt(request.args.get('end'))
    if end:
        query = query.filter(AutoPiPositionReport.recorded_at <= end)

    total = query.count()
    limit = _parse_limit(request.args.get('limit', 500))
    offset = max(0, request.args.get('offset', 0, type=int))

    reports = query.order_by(AutoPiPositionReport.recorded_at.desc()) \
        .offset(offset).limit(limit).all()

    return jsonify({
        'reports': [r.to_dict() for r in reports],
        'total': total,
    })


@gps_bp.route('/autopi/<int:device_id>/route', methods=['GET'])
def get_autopi_route(device_id):
    """Get optimized route polyline data for an AutoPi device."""
    from app.models.gps_tracking import AutoPiDevice, AutoPiPositionReport

    device = AutoPiDevice.query.get_or_404(device_id)

    start = _parse_dt(request.args.get('start'))
    if not start:
        return jsonify({'error': 'start parameter is required'}), 400

    end = _parse_dt(request.args.get('end')) or datetime.utcnow()

    reports = AutoPiPositionReport.query.filter_by(device_id=device.id) \
        .filter(AutoPiPositionReport.recorded_at >= start) \
        .filter(AutoPiPositionReport.recorded_at <= end) \
        .filter(AutoPiPositionReport.latitude.isnot(None)) \
        .order_by(AutoPiPositionReport.recorded_at.asc()) \
        .all()

    return jsonify({
        'points': [r.to_route_point() for r in reports],
    })
```

**Step 3: Commit**

```bash
git add backend/app/routes/gps.py
git commit -m "feat(gps): add tracked-vehicles endpoint and AutoPi position routes"
```

---

## Phase 2 & 3: Apple App (Deferred)

### Task 10: Apple App — Swift Models for AutoPi

**Deferred until after API discovery (Task 3).** Once we know the exact response shapes, we'll create:

- `AutoPiDevice.swift` in `Datacore/Models/`
- `AutoPiPositionReport.swift` in `Datacore/Models/`
- `AutoPiOBDSnapshot.swift` in `Datacore/Models/`
- New `Endpoint` cases in `Datacore/Network/Endpoint.swift`
- `AutoPiViewModel.swift` in `Datacore/ViewModels/`

### Task 11: Apple App — GPS Module Vehicle Selector

**Deferred until backend is proven.** Will add:
- Vehicle picker to `GPSTrackingView` (Mac, iPad, iPhone)
- Device-type-aware detail drawer
- AutoPi position pins on the map with distinct styling

### Task 12: Apple App — Vehicle Detail Telemetry Tab

**Deferred until OBD data is flowing.** Will add:
- New "Telemetry" tab on `VehicleDetailView`
- `PremiumStatCard` for latest PID readings
- Trend charts with time range selector
- Drive session grouping

---

## Summary of Files

**Created:**
- `backend/app/services/autopi_client.py` — API client wrapper
- `backend/app/services/autopi_discovery.py` — Interactive discovery script
- `backend/app/services/autopi_sync.py` — Sync engine (polling + webhook + backfill)
- `backend/app/models/autopi.py` — OBD snapshot model
- `backend/app/routes/autopi.py` — AutoPi API routes

**Modified:**
- `backend/app/config.py` — Add AUTOPI_* config vars
- `backend/app/models/gps_tracking.py` — Add AutoPiDevice, AutoPiPositionReport, geofence vehicle_id
- `backend/app/models/__init__.py` — Add new model imports
- `backend/app/__init__.py` — Register blueprint, add model import, add scheduler, add migration SQL
- `backend/app/routes/gps.py` — Add tracked-vehicles endpoint, AutoPi position routes, vehicle-scoped geofences
- `backend/app/services/trak4_sync.py` — Update geofence checks for vehicle-scoped model
- `.env.example` — Add AutoPi env vars
