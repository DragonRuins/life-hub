# GPS Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add battery level alerts (predefined tiers) and geofence zone alerts (circle/rectangle) to GPS tracking, integrated with the existing notification system and iOS push notifications.

**Architecture:** New `Trak4Geofence` model with CRUD API. Geofence + battery checks hook into `trak4_sync.py` after every position update. Events fire through the existing `emit()` → rule evaluator → dispatcher → APNs pipeline. iOS gets geofence map overlays, zone creation mode, and management UI.

**Tech Stack:** Flask/SQLAlchemy (backend), SwiftUI/MapKit (iOS), existing event_bus + dispatcher for notifications.

---

### Task 1: Add Trak4Geofence Database Model

**Files:**
- Modify: `backend/app/models/gps_tracking.py` (append after Trak4GPSReport class, ~line 148)

**Step 1: Add the Trak4Geofence model**

Add after the `Trak4GPSReport` class in `gps_tracking.py`:

```python
class Trak4Geofence(db.Model):
    """A geofence zone (circle or rectangle) for a GPS tracker device."""
    __tablename__ = 'trak4_geofences'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('trak4_devices.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    shape = db.Column(db.String(10), nullable=False, default='circle')  # 'circle' or 'rectangle'
    center_lat = db.Column(db.Float, nullable=False)
    center_lng = db.Column(db.Float, nullable=False)
    radius_meters = db.Column(db.Float, nullable=True)      # circle
    width_meters = db.Column(db.Float, nullable=True)        # rectangle east-west
    height_meters = db.Column(db.Float, nullable=True)       # rectangle north-south
    rotation_degrees = db.Column(db.Float, default=0)        # reserved, always 0
    alert_on_entry = db.Column(db.Boolean, default=True)
    alert_on_exit = db.Column(db.Boolean, default=True)
    enabled = db.Column(db.Boolean, default=True)
    last_state = db.Column(db.String(10), nullable=True)     # 'inside', 'outside', or None
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = db.relationship('Trak4Device', backref=db.backref('geofences', lazy='dynamic', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'name': self.name,
            'shape': self.shape,
            'center_lat': self.center_lat,
            'center_lng': self.center_lng,
            'radius_meters': self.radius_meters,
            'width_meters': self.width_meters,
            'height_meters': self.height_meters,
            'rotation_degrees': self.rotation_degrees,
            'alert_on_entry': self.alert_on_entry,
            'alert_on_exit': self.alert_on_exit,
            'enabled': self.enabled,
            'last_state': self.last_state,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }
```

**Step 2: Verify the model is auto-discovered**

The `gps_tracking` module is already imported in `backend/app/__init__.py` line 117. Adding the class to the same file means SQLAlchemy picks it up automatically. No init changes needed.

**Step 3: Commit**

```bash
git add backend/app/models/gps_tracking.py
git commit -m "feat(gps): add Trak4Geofence database model"
```

---

### Task 2: Register GPS Event Types in Notification System

**Files:**
- Modify: `backend/app/routes/notifications.py` — add GPS events to the `AVAILABLE_EVENTS` list (~line 73-231, find the list and append)

**Step 1: Add 5 new GPS event types**

Find the `AVAILABLE_EVENTS` list in `notifications.py` and append these entries:

```python
# GPS Tracking
{
    'name': 'gps.battery_low',
    'module': 'gps',
    'description': 'GPS tracker battery is low (≤20%)',
    'fields': ['device_name', 'device_id', 'vehicle_name', 'battery_percent', 'voltage', 'tier'],
},
{
    'name': 'gps.battery_critical',
    'module': 'gps',
    'description': 'GPS tracker battery is critical (≤10%)',
    'fields': ['device_name', 'device_id', 'vehicle_name', 'battery_percent', 'voltage', 'tier'],
},
{
    'name': 'gps.battery_dead',
    'module': 'gps',
    'description': 'GPS tracker battery is nearly dead (≤5%)',
    'fields': ['device_name', 'device_id', 'vehicle_name', 'battery_percent', 'voltage', 'tier'],
},
{
    'name': 'gps.geofence_enter',
    'module': 'gps',
    'description': 'GPS tracker entered a geofence zone',
    'fields': ['device_name', 'device_id', 'vehicle_name', 'zone_name', 'zone_id', 'latitude', 'longitude', 'position_source', 'direction'],
},
{
    'name': 'gps.geofence_exit',
    'module': 'gps',
    'description': 'GPS tracker exited a geofence zone',
    'fields': ['device_name', 'device_id', 'vehicle_name', 'zone_name', 'zone_id', 'latitude', 'longitude', 'position_source', 'direction'],
},
```

**Step 2: Commit**

```bash
git add backend/app/routes/notifications.py
git commit -m "feat(gps): register GPS battery and geofence notification events"
```

---

### Task 3: Add Geofence CRUD API Endpoints

**Files:**
- Modify: `backend/app/routes/gps.py` — add geofence endpoints (after existing device endpoints, before `/sync` section)

**Step 1: Add imports at top of gps.py**

Add `Trak4Geofence` to the existing model imports.

**Step 2: Add 4 geofence CRUD endpoints**

```python
# ── Geofences ──────────────────────────────────────────────

@gps_bp.route('/devices/<int:device_id>/geofences', methods=['GET'])
def list_geofences(device_id):
    """List all geofence zones for a device."""
    device = Trak4Device.query.get_or_404(device_id)
    fences = Trak4Geofence.query.filter_by(device_id=device.id).order_by(Trak4Geofence.created_at.desc()).all()
    return jsonify({'geofences': [f.to_dict() for f in fences]})


@gps_bp.route('/devices/<int:device_id>/geofences', methods=['POST'])
def create_geofence(device_id):
    """Create a new geofence zone."""
    device = Trak4Device.query.get_or_404(device_id)
    data = request.get_json(silent=True) or {}

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    shape = data.get('shape', 'circle')
    if shape not in ('circle', 'rectangle'):
        return jsonify({'error': 'shape must be circle or rectangle'}), 400

    center_lat = data.get('center_lat')
    center_lng = data.get('center_lng')
    if center_lat is None or center_lng is None:
        return jsonify({'error': 'center_lat and center_lng are required'}), 400

    fence = Trak4Geofence(
        device_id=device.id,
        name=name,
        shape=shape,
        center_lat=float(center_lat),
        center_lng=float(center_lng),
        radius_meters=data.get('radius_meters'),
        width_meters=data.get('width_meters'),
        height_meters=data.get('height_meters'),
        alert_on_entry=data.get('alert_on_entry', True),
        alert_on_exit=data.get('alert_on_exit', True),
        enabled=data.get('enabled', True),
    )
    db.session.add(fence)
    db.session.commit()
    return jsonify({'geofence': fence.to_dict()}), 201


@gps_bp.route('/devices/<int:device_id>/geofences/<int:fence_id>', methods=['PUT'])
def update_geofence(device_id, fence_id):
    """Update a geofence zone."""
    Trak4Device.query.get_or_404(device_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.device_id != device_id:
        return jsonify({'error': 'Geofence does not belong to this device'}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        fence.name = data['name'].strip()
    if 'shape' in data and data['shape'] in ('circle', 'rectangle'):
        fence.shape = data['shape']
    if 'center_lat' in data:
        fence.center_lat = float(data['center_lat'])
    if 'center_lng' in data:
        fence.center_lng = float(data['center_lng'])
    if 'radius_meters' in data:
        fence.radius_meters = data['radius_meters']
    if 'width_meters' in data:
        fence.width_meters = data['width_meters']
    if 'height_meters' in data:
        fence.height_meters = data['height_meters']
    if 'alert_on_entry' in data:
        fence.alert_on_entry = bool(data['alert_on_entry'])
    if 'alert_on_exit' in data:
        fence.alert_on_exit = bool(data['alert_on_exit'])
    if 'enabled' in data:
        fence.enabled = bool(data['enabled'])

    db.session.commit()
    return jsonify({'geofence': fence.to_dict()})


@gps_bp.route('/devices/<int:device_id>/geofences/<int:fence_id>', methods=['DELETE'])
def delete_geofence(device_id, fence_id):
    """Delete a geofence zone."""
    Trak4Device.query.get_or_404(device_id)
    fence = Trak4Geofence.query.get_or_404(fence_id)
    if fence.device_id != device_id:
        return jsonify({'error': 'Geofence does not belong to this device'}), 404

    db.session.delete(fence)
    db.session.commit()
    return jsonify({'success': True})
```

**Step 3: Commit**

```bash
git add backend/app/routes/gps.py
git commit -m "feat(gps): add geofence CRUD API endpoints"
```

---

### Task 4: Add Geofence + Battery Check Logic to Sync Pipeline

**Files:**
- Modify: `backend/app/services/trak4_sync.py` — add check functions and hook them into sync_reports() and ingest_webhook_report()

**Step 1: Add geometry helper functions at end of file**

```python
import math

def _haversine_meters(lat1, lng1, lat2, lng2):
    """Calculate distance in meters between two lat/lng points using haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_in_rect(lat, lng, center_lat, center_lng, width_m, height_m):
    """Check if a point is inside a rectangle defined by center + width/height in meters."""
    # Convert meters to approximate degrees at this latitude
    lat_deg_per_m = 1.0 / 111320.0
    lng_deg_per_m = 1.0 / (111320.0 * math.cos(math.radians(center_lat)))
    half_h = (height_m / 2.0) * lat_deg_per_m
    half_w = (width_m / 2.0) * lng_deg_per_m
    return (center_lat - half_h <= lat <= center_lat + half_h and
            center_lng - half_w <= lng <= center_lng + half_w)


def _is_inside_geofence(lat, lng, fence):
    """Check if a point is inside a geofence zone."""
    if fence.shape == 'circle':
        dist = _haversine_meters(lat, lng, fence.center_lat, fence.center_lng)
        return dist <= (fence.radius_meters or 0)
    elif fence.shape == 'rectangle':
        return _point_in_rect(lat, lng, fence.center_lat, fence.center_lng,
                              fence.width_meters or 0, fence.height_meters or 0)
    return False
```

**Step 2: Add check_geofences function**

```python
def check_geofences(device, lat, lng):
    """Check all enabled geofences for a device and emit events on state transitions."""
    if lat is None or lng is None:
        return

    from app.models.gps_tracking import Trak4Geofence
    from app.services.event_bus import emit

    fences = Trak4Geofence.query.filter_by(device_id=device.id, enabled=True).all()
    for fence in fences:
        inside = _is_inside_geofence(lat, lng, fence)
        new_state = 'inside' if inside else 'outside'

        # First check — set state without alerting
        if fence.last_state is None:
            fence.last_state = new_state
            continue

        # No transition — skip
        if fence.last_state == new_state:
            continue

        old_state = fence.last_state
        fence.last_state = new_state

        device_name = device.vehicle.name if device.vehicle_id else (device.label or device.key_code or f'Device {device.device_id}')
        vehicle_name = device.vehicle.name if device.vehicle_id else None
        payload = dict(
            device_name=device_name,
            device_id=device.id,
            vehicle_name=vehicle_name or device_name,
            zone_name=fence.name,
            zone_id=fence.id,
            latitude=lat,
            longitude=lng,
            position_source=device.last_position_source,
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
```

**Step 3: Add check_battery_alerts function**

```python
# Module-level dict to track last alert times per device per tier
_battery_alert_cache = {}  # key: (device_id, tier) → value: datetime

BATTERY_TIERS = [
    (5,  'dead',     'gps.battery_dead'),
    (10, 'critical', 'gps.battery_critical'),
    (20, 'low',      'gps.battery_low'),
]
BATTERY_COOLDOWN_HOURS = 6


def check_battery_alerts(device, battery_percent):
    """Check battery level against predefined tiers and emit events with cooldown."""
    if battery_percent is None:
        return

    from app.services.event_bus import emit

    device_name = device.vehicle.name if device.vehicle_id else (device.label or device.key_code or f'Device {device.device_id}')
    vehicle_name = device.vehicle.name if device.vehicle_id else None
    now = datetime.utcnow()

    for threshold, tier, event_name in BATTERY_TIERS:
        if battery_percent <= threshold:
            cache_key = (device.id, tier)
            last_alert = _battery_alert_cache.get(cache_key)

            if last_alert and (now - last_alert).total_seconds() < BATTERY_COOLDOWN_HOURS * 3600:
                break  # Already alerted this tier recently

            _battery_alert_cache[cache_key] = now
            emit(event_name,
                 device_name=device_name,
                 device_id=device.id,
                 vehicle_name=vehicle_name or device_name,
                 battery_percent=battery_percent,
                 voltage=device.last_voltage,
                 tier=tier)
            logger.info(f'Battery {tier}: {device_name} at {battery_percent}%')
            break  # Only fire the lowest matching tier
```

**Step 4: Hook checks into sync_reports() and ingest_webhook_report()**

In `sync_reports()`, after storing reports and updating device position, add:
```python
check_geofences(device, lat, lng)
check_battery_alerts(device, device.last_voltage_percent)
```

In `ingest_webhook_report()`, after updating device's last position, add the same two calls.

In `sync_devices()`, after updating device from device_list API, add the same two calls using the device's `last_latitude`, `last_longitude`, and `last_voltage_percent`.

**Step 5: Commit**

```bash
git add backend/app/services/trak4_sync.py
git commit -m "feat(gps): add geofence and battery alert checks to sync pipeline"
```

---

### Task 5: Add iOS Geofence Model + API Endpoints

**Files:**
- Modify: `Datacore/Models/Trak4.swift` — add geofence struct and response envelopes
- Modify: `Datacore/Network/Endpoint.swift` — add geofence endpoint cases

**Step 1: Add Trak4Geofence model to Trak4.swift (append at end)**

```swift
// MARK: - Geofence

struct Trak4Geofence: Codable, Sendable, Identifiable {
    let id: Int
    let deviceId: Int
    let name: String
    let shape: String  // "circle" or "rectangle"
    let centerLat: Double
    let centerLng: Double
    let radiusMeters: Double?
    let widthMeters: Double?
    let heightMeters: Double?
    let rotationDegrees: Double?
    let alertOnEntry: Bool
    let alertOnExit: Bool
    let enabled: Bool
    let lastState: String?  // "inside", "outside", or nil
    let createdAt: String?
    let updatedAt: String?

    var isCircle: Bool { shape == "circle" }
    var isRectangle: Bool { shape == "rectangle" }
}

struct Trak4GeofenceListResponse: Codable, Sendable {
    let geofences: [Trak4Geofence]
}

struct Trak4GeofenceResponse: Codable, Sendable {
    let geofence: Trak4Geofence
}
```

**Step 2: Add Endpoint cases in Endpoint.swift**

Add these cases to the `Endpoint` enum (after existing GPS cases):
```swift
case gpsGeofences(deviceId: Int)
case gpsCreateGeofence(deviceId: Int)
case gpsUpdateGeofence(deviceId: Int, fenceId: Int)
case gpsDeleteGeofence(deviceId: Int, fenceId: Int)
```

Add matching path entries in the `var path: String` switch:
```swift
case .gpsGeofences(let id):                          return "/api/gps/devices/\(id)/geofences"
case .gpsCreateGeofence(let id):                     return "/api/gps/devices/\(id)/geofences"
case .gpsUpdateGeofence(let id, let fid):            return "/api/gps/devices/\(id)/geofences/\(fid)"
case .gpsDeleteGeofence(let id, let fid):            return "/api/gps/devices/\(id)/geofences/\(fid)"
```

**Step 3: Add ViewModel methods in GPSTrackingViewModel.swift**

```swift
// MARK: - Geofences

var geofences: [Trak4Geofence] = []

func loadGeofences(deviceId: Int) async {
    do {
        let response: Trak4GeofenceListResponse = try await APIClient.shared.get(.gpsGeofences(deviceId: deviceId))
        geofences = response.geofences
    } catch {}
}

func createGeofence(deviceId: Int, data: [String: Any]) async -> Trak4Geofence? {
    do {
        let response: Trak4GeofenceResponse = try await APIClient.shared.post(.gpsCreateGeofence(deviceId: deviceId), body: data)
        geofences.append(response.geofence)
        return response.geofence
    } catch { return nil }
}

func updateGeofence(deviceId: Int, fenceId: Int, data: [String: Any]) async -> Bool {
    do {
        let response: Trak4GeofenceResponse = try await APIClient.shared.put(.gpsUpdateGeofence(deviceId: deviceId, fenceId: fenceId), body: data)
        if let idx = geofences.firstIndex(where: { $0.id == fenceId }) {
            geofences[idx] = response.geofence
        }
        return true
    } catch { return false }
}

func deleteGeofence(deviceId: Int, fenceId: Int) async -> Bool {
    do {
        try await APIClient.shared.delete(.gpsDeleteGeofence(deviceId: deviceId, fenceId: fenceId))
        geofences.removeAll { $0.id == fenceId }
        return true
    } catch { return false }
}
```

**Step 4: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/Trak4.swift Datacore/Network/Endpoint.swift Datacore/ViewModels/GPSTrackingViewModel.swift
git commit -m "feat(gps): add geofence model, endpoints, and ViewModel methods"
```

---

### Task 6: Add Geofence Map Overlays to GPSMapView

**Files:**
- Modify: `Datacore/Views/GPSTracking/GPSMapView.swift` — render geofence zones on the map

**Step 1: Accept geofences parameter**

Add `let geofences: [Trak4Geofence]` to `GPSMapView` properties.

**Step 2: Render overlays inside the Map content builder**

After the route polyline section, add:
```swift
// Geofence overlays
ForEach(geofences) { fence in
    if fence.isCircle, let radius = fence.radiusMeters {
        MapCircle(
            center: CLLocationCoordinate2D(latitude: fence.centerLat, longitude: fence.centerLng),
            radius: radius
        )
        .foregroundStyle(fenceColor(fence).opacity(0.15))
        .stroke(fenceColor(fence).opacity(0.6), lineWidth: 2)
    } else if fence.isRectangle, let w = fence.widthMeters, let h = fence.heightMeters {
        MapPolygon(coordinates: rectCorners(fence.centerLat, fence.centerLng, w, h))
            .foregroundStyle(fenceColor(fence).opacity(0.15))
            .stroke(fenceColor(fence).opacity(0.6), lineWidth: 2)
    }
}
```

**Step 3: Add helper functions**

```swift
private func fenceColor(_ fence: Trak4Geofence) -> Color {
    fence.lastState == "inside" ? .green : .orange
}

private func rectCorners(_ lat: Double, _ lng: Double, _ widthM: Double, _ heightM: Double) -> [CLLocationCoordinate2D] {
    let latDeg = (heightM / 2.0) / 111320.0
    let lngDeg = (widthM / 2.0) / (111320.0 * cos(lat * .pi / 180.0))
    return [
        CLLocationCoordinate2D(latitude: lat - latDeg, longitude: lng - lngDeg),
        CLLocationCoordinate2D(latitude: lat - latDeg, longitude: lng + lngDeg),
        CLLocationCoordinate2D(latitude: lat + latDeg, longitude: lng + lngDeg),
        CLLocationCoordinate2D(latitude: lat + latDeg, longitude: lng - lngDeg),
    ]
}
```

**Step 4: Update GPSTrackingView to pass geofences**

Pass `viewModel.geofences` to `GPSMapView` in both iPhone and iPad layouts. Load geofences when a device is selected.

**Step 5: Commit**

```bash
git add Datacore/Views/GPSTracking/GPSMapView.swift Datacore/Views/GPSTracking/GPSTrackingView.swift
git commit -m "feat(gps): render geofence overlays on map"
```

---

### Task 7: Add Geofence Zone Creation Mode

**Files:**
- Create: `Datacore/Views/GPSTracking/GPSGeofenceCreationView.swift`
- Modify: `Datacore/Views/GPSTracking/GPSDetailPanel.swift` — add "Add Zone" button
- Modify: `Datacore/Views/GPSTracking/GPSTrackingView.swift` — manage creation mode state

**Step 1: Create GPSGeofenceCreationView**

A toolbar overlay that appears at the bottom of the map during creation mode:
- Shape toggle (circle / rectangle) — two icon buttons
- Cancel and Save buttons
- Tap map to place center pin
- Drag handles to set radius (circle) or width/height (rectangle)
- On Save → sheet with name field + entry/exit/enabled toggles → POST to API

**Step 2: Add "Add Zone" button to GPSDetailPanel**

In the device detail section, between action buttons and route history, add:
```swift
Button {
    onAddGeofence()
} label: {
    HStack {
        Image(systemName: "mappin.and.ellipse")
            .foregroundStyle(ModuleAccent.gpsTracking.color)
        Text("Add Zone")
            .font(.subheadline.weight(.medium))
        Spacer()
        Image(systemName: "plus.circle")
            .font(.caption)
            .foregroundStyle(.tertiary)
    }
}
.buttonStyle(.plain)
```

**Step 3: Add creation mode state to GPSTrackingView**

Add `@State private var isCreatingGeofence = false` and manage the transition between detail sheet and creation mode.

**Step 4: Commit**

```bash
git add Datacore/Views/GPSTracking/GPSGeofenceCreationView.swift Datacore/Views/GPSTracking/GPSDetailPanel.swift Datacore/Views/GPSTracking/GPSTrackingView.swift
git commit -m "feat(gps): add geofence zone creation mode with map interaction"
```

---

### Task 8: Add Geofence Management Section in Detail Panel

**Files:**
- Create: `Datacore/Views/GPSTracking/GPSGeofenceListView.swift`
- Modify: `Datacore/Views/GPSTracking/GPSDetailPanel.swift` — add geofences section

**Step 1: Create GPSGeofenceListView**

List of existing geofence zones with:
- Zone name + shape icon (circle.dashed / rectangle.dashed)
- Inside/outside badge (green "Inside" / orange "Outside" based on lastState)
- Tap → zoom map to zone
- Swipe to delete
- Tap edit → inline edit for name, entry/exit toggles, enabled toggle

**Step 2: Add section to GPSDetailPanel**

Between action buttons and route history button, add the geofences section:
```swift
if !viewModel.geofences.isEmpty {
    Divider()
    GPSGeofenceListView(
        geofences: viewModel.geofences,
        onZoom: { fence in /* zoom map to fence center */ },
        onDelete: { fence in /* delete via API */ },
        onUpdate: { fence, data in /* update via API */ }
    )
    .padding(.horizontal)
}
```

**Step 3: Commit**

```bash
git add Datacore/Views/GPSTracking/GPSGeofenceListView.swift Datacore/Views/GPSTracking/GPSDetailPanel.swift
git commit -m "feat(gps): add geofence management list with edit/delete"
```

---

### Task 9: Add GPS Push Notification Category

**Files:**
- Modify: `Datacore/Network/PushNotificationManager.swift` — add gps_alert category

**Step 1: Add notification category**

In the `registerNotificationCategories()` method, add:
```swift
let gpsAlert = UNNotificationCategory(
    identifier: "gps_alert",
    actions: [
        UNNotificationAction(identifier: "view_map", title: "View Map", options: [.foreground]),
    ],
    intentIdentifiers: [],
    options: []
)
```

Add `gpsAlert` to the set passed to `UNUserNotificationCenter.current().setNotificationCategories()`.

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Network/PushNotificationManager.swift
git commit -m "feat(gps): add gps_alert push notification category"
```

---

### Task 10: Build, Test, and Deploy

**Step 1: Regenerate Xcode project**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
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

**Step 4: Fix any errors until both builds are clean**

**Step 5: Push backend changes, pull in Dockge, verify table creation**

```bash
# On server, check the new table was created
docker exec life-hub-main-backend-1 python -c "from app.models.gps_tracking import Trak4Geofence; print('Model loaded')"
```

**Step 6: Ask about version bump for Apple app**

**Step 7: Final commit + push**
