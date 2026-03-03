# Vehicle Types & Motorcycle Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add vehicle type support (Car, Truck, SUV, Motorcycle) with type-specific default components, 2-wheel tire sets for motorcycles, drivetrain tracking, cylinder-count-aware spark plugs, and motorcycle-specific maintenance intervals.

**Architecture:** Simple string-based `vehicle_type` column on the Vehicle model. Backend logic branches on type to determine defaults. Frontend forms conditionally show motorcycle-specific fields. Both Catppuccin and LCARS themes updated. Apple app models updated for new fields.

**Tech Stack:** Python/Flask/SQLAlchemy (backend), React/Vite (frontend), SwiftUI (Apple app), PostgreSQL

---

### Task 1: Add vehicle type columns to the Vehicle model

**Files:**
- Modify: `backend/app/models/vehicle.py:18-86`

**Step 1: Add new columns to Vehicle class**

After line 33 (`image_filename`), add:

```python
    # Vehicle classification
    vehicle_type = db.Column(db.String(20), nullable=False, default='car')  # car, truck, suv, motorcycle
    cylinder_count = db.Column(db.Integer, nullable=True)  # Number of cylinders (for spark plug defaults)
    dual_spark = db.Column(db.Boolean, default=False)  # Motorcycle-only: 2 spark plugs per cylinder
    final_drive_type = db.Column(db.String(20), nullable=True)  # Motorcycle-only: chain, belt, shaft
```

**Step 2: Update `to_dict()` to include new fields**

Add after `'image_url'` line (81):

```python
            'vehicle_type': self.vehicle_type or 'car',
            'cylinder_count': self.cylinder_count,
            'dual_spark': self.dual_spark or False,
            'final_drive_type': self.final_drive_type,
```

**Step 3: Commit**

```bash
git add backend/app/models/vehicle.py
git commit -m "feat(vehicles): add vehicle_type, cylinder_count, dual_spark, final_drive_type columns"
```

---

### Task 2: Add vehicle_types column to MaintenanceItem model

**Files:**
- Modify: `backend/app/models/maintenance_interval.py:17-53`

**Step 1: Add vehicle_types column to MaintenanceItem**

After line 35 (`is_preset`), add:

```python
    vehicle_types = db.Column(db.String(100), nullable=True)  # Comma-separated: 'motorcycle' or NULL = all types
```

**Step 2: Update MaintenanceItem `to_dict()`**

Add after `'sort_order'` (line 52):

```python
            'vehicle_types': self.vehicle_types,
```

**Step 3: Commit**

```bash
git add backend/app/models/maintenance_interval.py
git commit -m "feat(intervals): add vehicle_types filter column to MaintenanceItem"
```

---

### Task 3: Create database migration for new columns + motorcycle preset items

**Files:**
- Create: `backend/migrations/versions/add_vehicle_types.py`

**Step 1: Write the migration**

```python
"""Add vehicle type support and motorcycle maintenance presets.

Adds vehicle_type, cylinder_count, dual_spark, final_drive_type to vehicles table.
Adds vehicle_types filter column to maintenance_items.
Seeds motorcycle-specific maintenance items.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_vehicle_types'
down_revision = 'reorder_maintenance_items'
branch_labels = None
depends_on = None

# Motorcycle-specific maintenance presets: (name, category, miles, months, sort_order, vehicle_types)
MOTORCYCLE_PRESETS = [
    ('Chain Lubrication', 'Drivetrain', 500, 1, 910, 'motorcycle'),
    ('Chain Adjustment', 'Drivetrain', 3000, 6, 920, 'motorcycle'),
    ('Chain Replacement', 'Drivetrain', 20000, 48, 930, 'motorcycle'),
    ('Belt Inspection', 'Drivetrain', 5000, 12, 940, 'motorcycle'),
    ('Belt Replacement', 'Drivetrain', 50000, 60, 950, 'motorcycle'),
    ('Valve Clearance Check', 'Engine', 15000, 24, 960, 'motorcycle'),
    ('Fork Oil Change', 'Suspension', 15000, 24, 970, 'motorcycle'),
    ('Tire Replacement', 'Tires', 10000, 36, 540, 'motorcycle'),
]


def upgrade():
    # ── Vehicle table: add type columns ─────────────────────────
    op.add_column('vehicles', sa.Column('vehicle_type', sa.String(20), nullable=False, server_default='car'))
    op.add_column('vehicles', sa.Column('cylinder_count', sa.Integer(), nullable=True))
    op.add_column('vehicles', sa.Column('dual_spark', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('vehicles', sa.Column('final_drive_type', sa.String(20), nullable=True))

    # ── MaintenanceItem: add vehicle_types filter ───────────────
    op.add_column('maintenance_items', sa.Column('vehicle_types', sa.String(100), nullable=True))

    # ── Seed motorcycle maintenance presets ──────────────────────
    items_table = sa.table(
        'maintenance_items',
        sa.column('name', sa.String),
        sa.column('category', sa.String),
        sa.column('default_miles_interval', sa.Integer),
        sa.column('default_months_interval', sa.Integer),
        sa.column('is_preset', sa.Boolean),
        sa.column('sort_order', sa.Integer),
        sa.column('vehicle_types', sa.String),
    )
    op.bulk_insert(items_table, [
        {
            'name': name,
            'category': category,
            'default_miles_interval': miles,
            'default_months_interval': months,
            'is_preset': True,
            'sort_order': sort_order,
            'vehicle_types': vehicle_types,
        }
        for name, category, miles, months, sort_order, vehicle_types in MOTORCYCLE_PRESETS
    ])


def downgrade():
    # Remove motorcycle presets
    op.execute("DELETE FROM maintenance_items WHERE vehicle_types = 'motorcycle'")

    # Remove columns
    op.drop_column('maintenance_items', 'vehicle_types')
    op.drop_column('vehicles', 'final_drive_type')
    op.drop_column('vehicles', 'dual_spark')
    op.drop_column('vehicles', 'cylinder_count')
    op.drop_column('vehicles', 'vehicle_type')
```

**Step 2: Commit**

```bash
git add backend/migrations/versions/add_vehicle_types.py
git commit -m "feat(migrations): add vehicle types migration with motorcycle presets"
```

---

### Task 4: Update vehicle creation route with type-aware default components

**Files:**
- Modify: `backend/app/routes/vehicles.py:55-118` (DEFAULT_COMPONENTS and create_default_components)
- Modify: `backend/app/routes/vehicles.py:291-340` (create_vehicle endpoint)

**Step 1: Replace the static DEFAULT_COMPONENTS with a function**

Replace lines 55-118 with:

```python
# ── Default Components ─────────────────────────────────────────────

# 4-wheel vehicle defaults (car, truck, suv)
FOUR_WHEEL_POSITIONS = ['Front Left', 'Front Right', 'Rear Left', 'Rear Right']

# Motorcycle defaults
MOTORCYCLE_POSITIONS = ['Front', 'Rear']

# Drivetrain components by final drive type
DRIVETRAIN_COMPONENTS = {
    'chain': [
        {'component_type': 'drive_chain', 'position': 'Drivetrain'},
        {'component_type': 'front_sprocket', 'position': 'Drivetrain'},
        {'component_type': 'rear_sprocket', 'position': 'Drivetrain'},
    ],
    'belt': [
        {'component_type': 'drive_belt', 'position': 'Drivetrain'},
        {'component_type': 'front_pulley', 'position': 'Drivetrain'},
        {'component_type': 'rear_pulley', 'position': 'Drivetrain'},
    ],
    'shaft': [],  # Shaft drive has no user-serviceable drivetrain components
}


def get_default_components(vehicle_type='car', cylinder_count=None, dual_spark=False, final_drive_type=None):
    """
    Build the list of default components based on vehicle type.

    Args:
        vehicle_type: 'car', 'truck', 'suv', or 'motorcycle'
        cylinder_count: Number of engine cylinders (None = use legacy default)
        dual_spark: If True, double the spark plug count (motorcycle-only)
        final_drive_type: 'chain', 'belt', or 'shaft' (motorcycle-only)
    """
    components = []

    if vehicle_type == 'motorcycle':
        # Brakes: 2 pads + 2 rotors (front/rear)
        for pos in MOTORCYCLE_POSITIONS:
            components.append({'component_type': 'brake_pad', 'position': pos})
            components.append({'component_type': 'brake_rotor', 'position': pos})

        # Spark plugs: cylinder_count * multiplier
        num_cylinders = cylinder_count or 2  # Default 2 for motorcycles
        num_plugs = num_cylinders * (2 if dual_spark else 1)
        for i in range(1, num_plugs + 1):
            components.append({'component_type': 'spark_plug', 'position': f'Cylinder {i}'})

        # Basic components
        components.append({'component_type': 'battery', 'position': 'Under Seat'})
        components.append({'component_type': 'oil_filter', 'position': 'Engine'})
        components.append({'component_type': 'air_filter', 'position': 'Airbox'})
        components.append({'component_type': 'stator', 'position': 'Engine'})

        # Drivetrain components based on final drive type
        if final_drive_type and final_drive_type in DRIVETRAIN_COMPONENTS:
            components.extend(DRIVETRAIN_COMPONENTS[final_drive_type])

    else:
        # Car / Truck / SUV: 4-wheel defaults
        # Brakes: 4 pads + 4 rotors
        for pos in FOUR_WHEEL_POSITIONS:
            components.append({'component_type': 'brake_pad', 'position': pos})
            components.append({'component_type': 'brake_rotor', 'position': pos})

        # Spark plugs: cylinder_count (default 8 for backward compat with existing V8)
        num_cylinders = cylinder_count or 8
        for i in range(1, num_cylinders + 1):
            components.append({'component_type': 'spark_plug', 'position': f'Cylinder {i}'})

        # Wiper blades
        components.append({'component_type': 'wiper_blade', 'position': 'Front Driver'})
        components.append({'component_type': 'wiper_blade', 'position': 'Front Passenger'})

        # Basic components
        components.append({'component_type': 'battery', 'position': 'Engine Bay'})
        components.append({'component_type': 'oil_filter', 'position': 'Engine Bay'})
        components.append({'component_type': 'air_filter', 'position': 'Engine Bay'})
        components.append({'component_type': 'fuel_filter', 'position': 'Under Vehicle'})
        components.append({'component_type': 'alternator', 'position': 'Engine Bay'})
        components.append({'component_type': 'water_pump', 'position': 'Engine Bay'})
        components.append({'component_type': 'fuel_pump', 'position': 'Fuel Tank / Engine Bay'})

    return components


def create_default_components(vehicle):
    """
    Create default components for a vehicle based on its type.
    Skips components that already exist (type+position match).

    Args:
        vehicle: Vehicle model instance (needs vehicle_type, cylinder_count, etc.)
    """
    defaults = get_default_components(
        vehicle_type=vehicle.vehicle_type or 'car',
        cylinder_count=vehicle.cylinder_count,
        dual_spark=vehicle.dual_spark or False,
        final_drive_type=vehicle.final_drive_type,
    )

    existing = VehicleComponent.query.filter_by(vehicle_id=vehicle.id).all()
    existing_keys = {(c.component_type, c.position) for c in existing}

    created = []
    for default in defaults:
        key = (default['component_type'], default['position'])
        if key in existing_keys:
            continue

        component = VehicleComponent(
            vehicle_id=vehicle.id,
            **default,
            is_active=True,
        )
        db.session.add(component)
        created.append(component)

    if created:
        db.session.commit()

    return [c.to_dict() for c in created]
```

**Step 2: Update `create_vehicle()` to accept and pass new fields**

In the `create_vehicle` function (around line 311), update the Vehicle constructor:

```python
    vehicle = Vehicle(
        year=data['year'],
        make=data['make'],
        model=data['model'],
        trim=data.get('trim'),
        color=data.get('color'),
        vin=data.get('vin'),
        license_plate=data.get('license_plate'),
        current_mileage=data.get('current_mileage'),
        notes=data.get('notes'),
        vehicle_type=data.get('vehicle_type', 'car'),
        cylinder_count=data.get('cylinder_count'),
        dual_spark=data.get('dual_spark', False),
        final_drive_type=data.get('final_drive_type'),
    )
```

**Step 3: Update the `create_default_components` call**

Change `create_default_components(vehicle.id)` to `create_default_components(vehicle)` (pass the full vehicle object instead of just ID).

**Step 4: Update `update_vehicle()` to allow editing cylinder_count and dual_spark (but NOT vehicle_type or final_drive_type)**

In `update_vehicle()`, update the allowed fields list (around line 376):

```python
    for field in ('year', 'make', 'model', 'trim', 'color', 'vin',
                  'license_plate', 'current_mileage', 'notes',
                  'cylinder_count', 'dual_spark'):
```

**Step 5: Commit**

```bash
git add backend/app/routes/vehicles.py
git commit -m "feat(vehicles): type-aware default components and vehicle creation"
```

---

### Task 5: Update tire set creation for 2-wheel motorcycle support

**Files:**
- Modify: `backend/app/routes/vehicles.py:121-218` (create_tire_set function)

**Step 1: Update `create_tire_set()` to check vehicle type**

Replace the hardcoded tire/rim creation loops (lines 179-212) with:

```python
    # Determine tire positions based on vehicle type
    vehicle = Vehicle.query.get(vehicle_id)
    if vehicle and vehicle.vehicle_type == 'motorcycle':
        positions = ['Front', 'Rear']
    else:
        positions = ['Front Left', 'Front Right', 'Rear Left', 'Rear Right']

    # Check if there's already an equipped tire set for this vehicle
    has_equipped_set = VehicleComponent.query.filter(
        VehicleComponent.vehicle_id == vehicle_id,
        VehicleComponent.component_type.in_(['tire', 'rim']),
        VehicleComponent.is_active == True
    ).first()

    # New sets start as inactive (in storage) unless there are no other sets
    is_active = not has_equipped_set

    # Create tires (2 for motorcycle, 4 for cars)
    for position in positions:
        tire = VehicleComponent(
            vehicle_id=vehicle_id,
            tire_set_id=tire_set.id,
            component_type='tire',
            position=position,
            brand=tire_brand,
            model=tire_model,
            install_date=install_date,
            install_mileage=install_mileage,
            purchase_date=purchase_date,
            purchase_price=purchase_price,
            is_active=is_active,
        )
        db.session.add(tire)

    # Create rims (2 for motorcycle, 4 for cars)
    num_components = len(positions) * 2  # tires + rims
    rim_price = purchase_price / num_components if purchase_price else None
    for position in positions:
        rim = VehicleComponent(
            vehicle_id=vehicle_id,
            tire_set_id=tire_set.id,
            component_type='rim',
            position=position,
            brand=rim_brand,
            model=rim_model,
            install_date=install_date,
            install_mileage=install_mileage,
            purchase_date=purchase_date,
            purchase_price=rim_price,
            is_active=is_active,
        )
        db.session.add(rim)
```

**Step 2: Update TireSet model docstring** (vehicle.py:203-204)

Change `"""A set of 4 tires + 4 rims that can be swapped on a vehicle."""` to:
`"""A set of tires + rims that can be swapped on a vehicle (4+4 for cars, 2+2 for motorcycles)."""`

**Step 3: Commit**

```bash
git add backend/app/routes/vehicles.py backend/app/models/vehicle.py
git commit -m "feat(tire-sets): support 2-wheel tire sets for motorcycles"
```

---

### Task 6: Update interval setup-defaults to filter by vehicle type

**Files:**
- Modify: `backend/app/routes/vehicles.py:662-705` (setup_default_intervals)

**Step 1: Update setup_default_intervals to filter maintenance items by vehicle type**

Replace the preset_items query (line 675) with:

```python
    # Get all preset items, filtered to those applicable to this vehicle type
    all_presets = MaintenanceItem.query.filter_by(is_preset=True).all()
    vehicle_type = vehicle.vehicle_type or 'car'

    # Filter: include items where vehicle_types is NULL (universal)
    # or where the vehicle's type is in the comma-separated vehicle_types list
    preset_items = [
        item for item in all_presets
        if item.vehicle_types is None or vehicle_type in item.vehicle_types.split(',')
    ]
```

**Step 2: Commit**

```bash
git add backend/app/routes/vehicles.py
git commit -m "feat(intervals): filter preset items by vehicle type in setup-defaults"
```

---

### Task 7: Add motorcycle component types to frontend constants

**Files:**
- Modify: `frontend/src/constants/componentTypes.js`

**Step 1: Add new motorcycle component types before 'other'**

Insert before the `other` entry (before line 106):

```javascript
  {
    value: 'drive_chain',
    label: 'Drive Chain',
    icon: '⛓️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'drive_belt',
    label: 'Drive Belt',
    icon: '🔗',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'front_sprocket',
    label: 'Front Sprocket',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'rear_sprocket',
    label: 'Rear Sprocket',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'front_pulley',
    label: 'Front Pulley',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'rear_pulley',
    label: 'Rear Pulley',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'stator',
    label: 'Stator',
    icon: '⚡',
    suggestedPositions: ['Engine'],
    commonFields: ['brand', 'part_number'],
    vehicleTypes: ['motorcycle'],
  },
```

**Step 2: Add a helper function to get component types filtered by vehicle type**

After `getAllPositions()`, add:

```javascript
/**
 * Get component types filtered for a specific vehicle type.
 * Items with no vehicleTypes restriction are always included.
 * Items with a vehicleTypes array are only included if the vehicle type matches.
 */
export function getComponentTypesForVehicle(vehicleType) {
  if (!vehicleType) return COMPONENT_TYPES
  return COMPONENT_TYPES.filter(t =>
    !t.vehicleTypes || t.vehicleTypes.includes(vehicleType)
  )
}
```

**Step 3: Commit**

```bash
git add frontend/src/constants/componentTypes.js
git commit -m "feat(components): add motorcycle component types and vehicle type filtering"
```

---

### Task 8: Update Catppuccin VehicleForm with type fields

**Files:**
- Modify: `frontend/src/pages/Vehicles.jsx:152-234` (VehicleForm component)

**Step 1: Add new fields to form state** (line 153)

Update the initial state:

```javascript
  const [form, setForm] = useState({
    vehicle_type: 'car',
    year: '',
    make: '',
    model: '',
    trim: '',
    color: '',
    vin: '',
    license_plate: '',
    current_mileage: '',
    cylinder_count: '',
    dual_spark: false,
    final_drive_type: 'chain',
    notes: '',
  })
```

**Step 2: Update handleSubmit** (line 169) to include new fields:

```javascript
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      year: parseInt(form.year),
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
      cylinder_count: form.cylinder_count ? parseInt(form.cylinder_count) : null,
      dual_spark: form.vehicle_type === 'motorcycle' ? form.dual_spark : false,
      final_drive_type: form.vehicle_type === 'motorcycle' ? form.final_drive_type : null,
    })
  }
```

**Step 3: Add vehicle type dropdown as the first row** (after `<h3>` on line 180):

```jsx
      {/* Vehicle Type Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Vehicle Type</label>
        <select name="vehicle_type" value={form.vehicle_type} onChange={handleChange}>
          <option value="car">Car</option>
          <option value="truck">Truck</option>
          <option value="suv">SUV</option>
          <option value="motorcycle">Motorcycle</option>
        </select>
      </div>
```

**Step 4: Add cylinder count to the second row** (replace the Mileage row, lines 197-210):

The second `form-grid-3col` should become:

```jsx
      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Trim</label>
          <input name="trim" placeholder="Night Edition" value={form.trim} onChange={handleChange} />
        </div>
        <div>
          <label>Color</label>
          <input name="color" placeholder="Black" value={form.color} onChange={handleChange} />
        </div>
        <div>
          <label>Current Mileage</label>
          <input name="current_mileage" type="number" placeholder="45000" value={form.current_mileage} onChange={handleChange} />
        </div>
      </div>

      {/* Engine & Motorcycle-specific fields */}
      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Cylinder Count</label>
          <input name="cylinder_count" type="number" placeholder={form.vehicle_type === 'motorcycle' ? '2' : '8'} value={form.cylinder_count} onChange={handleChange} />
        </div>
        {form.vehicle_type === 'motorcycle' && (
          <>
            <div>
              <label>Final Drive Type</label>
              <select name="final_drive_type" value={form.final_drive_type} onChange={handleChange}>
                <option value="chain">Chain</option>
                <option value="belt">Belt</option>
                <option value="shaft">Shaft</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <input
                type="checkbox"
                id="dual_spark"
                name="dual_spark"
                checked={form.dual_spark}
                onChange={(e) => setForm({ ...form, dual_spark: e.target.checked })}
                style={{ width: 'auto' }}
              />
              <label htmlFor="dual_spark" style={{ margin: 0, cursor: 'pointer' }}>Dual Spark Plugs</label>
            </div>
          </>
        )}
      </div>
```

**Step 5: Add type badge to vehicle cards** (in the vehicle list, around line 107)

After `{v.year} {v.make} {v.model}`, add:

```jsx
                    {v.vehicle_type && v.vehicle_type !== 'car' && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        background: v.vehicle_type === 'motorcycle' ? 'rgba(203, 166, 247, 0.15)' : 'rgba(137, 180, 250, 0.15)',
                        color: v.vehicle_type === 'motorcycle' ? 'var(--color-mauve)' : 'var(--color-blue)',
                      }}>
                        {v.vehicle_type}
                      </span>
                    )}
```

**Step 6: Commit**

```bash
git add frontend/src/pages/Vehicles.jsx
git commit -m "feat(frontend): add vehicle type fields to Catppuccin vehicle form and cards"
```

---

### Task 9: Update LCARS VehicleForm with type fields

**Files:**
- Modify: `frontend/src/themes/lcars/LCARSVehicles.jsx:319-398` (LCARSVehicleForm)

**Step 1: Mirror the exact same form state and submit logic from Task 8**

Update `LCARSVehicleForm` state (line 320):

```javascript
  const [form, setForm] = useState({
    vehicle_type: 'car',
    year: '',
    make: '',
    model: '',
    trim: '',
    color: '',
    vin: '',
    license_plate: '',
    current_mileage: '',
    cylinder_count: '',
    dual_spark: false,
    final_drive_type: 'chain',
    notes: '',
  })
```

Update handleSubmit (line 336):

```javascript
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      year: parseInt(form.year),
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
      cylinder_count: form.cylinder_count ? parseInt(form.cylinder_count) : null,
      dual_spark: form.vehicle_type === 'motorcycle' ? form.dual_spark : false,
      final_drive_type: form.vehicle_type === 'motorcycle' ? form.final_drive_type : null,
    })
  }
```

**Step 2: Add vehicle type dropdown before the first form-grid-3col** (before line 347):

```jsx
      {/* Vehicle Type Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Vehicle Type</label>
        <select name="vehicle_type" value={form.vehicle_type} onChange={handleChange}>
          <option value="car">Car</option>
          <option value="truck">Truck</option>
          <option value="suv">SUV</option>
          <option value="motorcycle">Motorcycle</option>
        </select>
      </div>
```

**Step 3: Add engine/motorcycle fields after the Trim/Color/Mileage row** (after the second form-grid-3col, line 375):

Same JSX as Task 8 Step 4 (the cylinder count + motorcycle conditional fields).

**Step 4: Add type badge to LCARS vehicle cards**

In `LCARSVehicleCard` (around line 208, after the vehicle name span), add a type badge for non-car vehicles:

```jsx
              {v.vehicle_type && v.vehicle_type !== 'car' && (
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0.1rem 0.35rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: v.vehicle_type === 'motorcycle' ? 'var(--lcars-african-violet)' : 'var(--lcars-ice)',
                }}>
                  {v.vehicle_type}
                </span>
              )}
```

**Step 5: Commit**

```bash
git add frontend/src/themes/lcars/LCARSVehicles.jsx
git commit -m "feat(lcars): add vehicle type fields to LCARS vehicle form and cards"
```

---

### Task 10: Update ComponentForm to filter types by vehicle type

**Files:**
- Modify: `frontend/src/components/ComponentForm.jsx:1-10`

**Step 1: Accept vehicleType prop and filter component types**

Update the import and component signature:

```javascript
import { COMPONENT_TYPES, getComponentType, getComponentTypesForVehicle } from '../constants/componentTypes'

export default function ComponentForm({ vehicleId, vehicleType, component, onSubmit, onCancel }) {
```

**Step 2: Replace COMPONENT_TYPES usage in the dropdown**

Wherever the component type `<select>` renders its options from `COMPONENT_TYPES`, replace with:

```javascript
{getComponentTypesForVehicle(vehicleType).map(t => (
  <option key={t.value} value={t.value}>{t.label}</option>
))}
```

**Step 3: Pass vehicleType from VehicleDetail**

In `VehicleDetail.jsx`, find where `<ComponentForm>` is rendered and add `vehicleType={vehicle.vehicle_type}`:

```jsx
<ComponentForm
  vehicleId={vehicle.id}
  vehicleType={vehicle.vehicle_type}
  component={selectedComponent}
  onSubmit={handleComponentSubmit}
  onCancel={() => { setShowComponentForm(false); setSelectedComponent(null) }}
/>
```

Do the same in `LCARSVehicleDetail.jsx` if it renders ComponentForm directly.

**Step 4: Commit**

```bash
git add frontend/src/components/ComponentForm.jsx frontend/src/pages/VehicleDetail.jsx
git commit -m "feat(components): filter component type dropdown by vehicle type"
```

---

### Task 11: Update Apple app Vehicle model

**Files:**
- Modify: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Models/Vehicle.swift`

**Step 1: Add new optional fields to the Vehicle struct**

After `imageUrl` (or similar), add:

```swift
    let vehicleType: String?
    let cylinderCount: Int?
    let dualSpark: Bool?
    let finalDriveType: String?
```

**Step 2: Commit** (from the Datacore-Apple repo)

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/Vehicle.swift
git commit -m "feat(models): add vehicle type fields to Vehicle model"
```

---

### Task 12: Final verification and push

**Step 1: Verify all backend changes are consistent**

Run from the Personal_Database directory:
```bash
grep -n 'vehicle_type\|cylinder_count\|dual_spark\|final_drive_type' backend/app/models/vehicle.py backend/app/routes/vehicles.py
```

Expected: All new columns appear in the model, to_dict, create_vehicle, and default component logic.

**Step 2: Verify all frontend changes**

Run:
```bash
grep -rn 'vehicle_type\|cylinder_count\|dual_spark\|final_drive_type' frontend/src/
```

Expected: References in Vehicles.jsx, LCARSVehicles.jsx, ComponentForm.jsx, componentTypes.js.

**Step 3: Verify migration file references correct down_revision**

```bash
head -5 backend/migrations/versions/add_vehicle_types.py
```

**Step 4: Push to main (triggers Docker rebuild)**

Tell user:
```bash
git push origin main
```

Then in Dockge: pull latest images, restart the stack. Backend will run `db.create_all()` and the new columns will be auto-created. Existing vehicles will get `vehicle_type='car'` default.

---

## Summary of Files Changed

| File | Action |
|------|--------|
| `backend/app/models/vehicle.py` | Add 4 columns, update to_dict, update TireSet docstring |
| `backend/app/models/maintenance_interval.py` | Add vehicle_types column, update to_dict |
| `backend/migrations/versions/add_vehicle_types.py` | New migration file |
| `backend/app/routes/vehicles.py` | Rewrite default components, update create/update vehicle, update tire set creation, update interval setup |
| `frontend/src/constants/componentTypes.js` | Add 7 motorcycle types, add filtering helper |
| `frontend/src/pages/Vehicles.jsx` | Add type fields to form, type badge on cards |
| `frontend/src/themes/lcars/LCARSVehicles.jsx` | Add type fields to LCARS form, type badge on LCARS cards |
| `frontend/src/components/ComponentForm.jsx` | Accept vehicleType prop, filter dropdown |
| `frontend/src/pages/VehicleDetail.jsx` | Pass vehicleType to ComponentForm |
| `Datacore-Apple/.../Vehicle.swift` | Add 4 optional fields |
