"""
Vehicles Module - API Routes

Full CRUD (Create, Read, Update, Delete) for vehicles, their
maintenance logs, and components.

Endpoints:
  Vehicles:
    GET    /api/vehicles/          → List all vehicles
    POST   /api/vehicles/          → Add a new vehicle
    GET    /api/vehicles/<id>      → Get one vehicle with its logs
    PUT    /api/vehicles/<id>      → Update a vehicle
    DELETE /api/vehicles/<id>      → Delete a vehicle and all its logs

  Maintenance Logs:
    POST   /api/vehicles/<id>/maintenance       → Add a maintenance log
    PUT    /api/vehicles/maintenance/<log_id>    → Update a log
    DELETE /api/vehicles/maintenance/<log_id>    → Delete a log

  Components (tires, battery, filters, etc.):
    GET    /api/vehicles/<id>/components          → List components for a vehicle
    POST   /api/vehicles/<id>/components          → Add a component
    GET    /api/vehicles/components/<id>          → Get component with logs
    PUT    /api/vehicles/components/<id>          → Update/archive a component
    DELETE /api/vehicles/components/<id>          → Delete a component

  Component Logs (service history for a component):
    POST   /api/vehicles/components/<id>/logs     → Add a component log
    PUT    /api/vehicles/component-logs/<id>      → Update a component log
    DELETE /api/vehicles/component-logs/<id>      → Delete a component log
"""
import sys
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.vehicle import Vehicle, MaintenanceLog, VehicleComponent, ComponentLog, TireSet, FuelLog

vehicles_bp = Blueprint('vehicles', __name__)


# ── Helper Functions ───────────────────────────────────────────────

def parse_component_date(value):
    """Parse date from JSON request, handling empty strings."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    return date.fromisoformat(value)


# ── Default Components ─────────────────────────────────────────────

# Note: Tires and rims are managed via Tire Sets, not included here
DEFAULT_COMPONENTS = [
    # Battery (1)
    {'component_type': 'battery', 'position': 'Engine Bay'},
    # Filters (3)
    {'component_type': 'oil_filter', 'position': 'Engine Bay'},
    {'component_type': 'air_filter', 'position': 'Engine Bay'},
    {'component_type': 'fuel_filter', 'position': 'Under Vehicle'},
    # Brakes (8: 4 pads + 4 rotors)
    {'component_type': 'brake_pad', 'position': 'Front Left'},
    {'component_type': 'brake_pad', 'position': 'Front Right'},
    {'component_type': 'brake_pad', 'position': 'Rear Left'},
    {'component_type': 'brake_pad', 'position': 'Rear Right'},
    {'component_type': 'brake_rotor', 'position': 'Front Left'},
    {'component_type': 'brake_rotor', 'position': 'Front Right'},
    {'component_type': 'brake_rotor', 'position': 'Rear Left'},
    {'component_type': 'brake_rotor', 'position': 'Rear Right'},
    # Wiper Blades (2)
    {'component_type': 'wiper_blade', 'position': 'Front Driver'},
    {'component_type': 'wiper_blade', 'position': 'Front Passenger'},
    # Spark Plugs (8 - standard V8)
    {'component_type': 'spark_plug', 'position': 'Cylinder 1'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 2'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 3'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 4'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 5'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 6'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 7'},
    {'component_type': 'spark_plug', 'position': 'Cylinder 8'},
    # Engine Components (3)
    {'component_type': 'alternator', 'position': 'Engine Bay'},
    {'component_type': 'water_pump', 'position': 'Engine Bay'},
    {'component_type': 'fuel_pump', 'position': 'Fuel Tank / Engine Bay'},
]


def create_default_components(vehicle_id):
    """
    Create default components for a vehicle.
    Skips components that already exist (type+position match).
    """
    existing = VehicleComponent.query.filter_by(vehicle_id=vehicle_id).all()
    existing_keys = {(c.component_type, c.position) for c in existing}

    created = []
    for default in DEFAULT_COMPONENTS:
        key = (default['component_type'], default['position'])
        if key in existing_keys:
            continue

        component = VehicleComponent(
            vehicle_id=vehicle_id,
            **default,
            is_active=True,
        )
        db.session.add(component)
        created.append(component)

    if created:
        db.session.commit()

    return [c.to_dict() for c in created]


# ── Tire Set CRUD ───────────────────────────────────────

def create_tire_set(vehicle_id, data):
    """Create a tire set and its 8 components (4 tires + 4 rims)."""

    # Helper to convert empty strings to None for numeric fields
    def to_int(val):
        if val is None or val == '':
            return None
        return int(val)

    def to_float(val):
        if val is None or val == '':
            return None
        return float(val)

    install_mileage = to_int(data.get('install_mileage'))

    # Extract only valid TireSet fields
    tire_set_data = {
        'name': data.get('name') or None,  # Convert empty string to None
        'tire_brand': data.get('tire_brand') or None,
        'tire_model': data.get('tire_model') or None,
        'rim_brand': data.get('rim_brand') or None,
        'rim_model': data.get('rim_model') or None,
        'install_date': parse_component_date(data.get('install_date')),
        'install_mileage': install_mileage,
        'mileage_at_last_swap': install_mileage,  # Track mileage at creation
        'accumulated_mileage': to_int(data.get('accumulated_mileage')) or 0,
        'purchase_date': parse_component_date(data.get('purchase_date')),
        'purchase_price': to_float(data.get('purchase_price')),
        'notes': data.get('notes') or None,
    }

    tire_set = TireSet(vehicle_id=vehicle_id, **tire_set_data)
    db.session.add(tire_set)
    db.session.flush()  # Get tire_set.id

    # Get values for components (convert empty strings to None)
    tire_brand = data.get('tire_brand') or None
    tire_model = data.get('tire_model') or None
    rim_brand = data.get('rim_brand') or None
    rim_model = data.get('rim_model') or None
    install_date = parse_component_date(data.get('install_date'))
    purchase_date = parse_component_date(data.get('purchase_date'))
    purchase_price = to_float(data.get('purchase_price'))

    # Check if there's already an equipped tire set for this vehicle
    has_equipped_set = VehicleComponent.query.filter(
        VehicleComponent.vehicle_id == vehicle_id,
        VehicleComponent.component_type.in_(['tire', 'rim']),
        VehicleComponent.is_active == True
    ).first()

    # New sets start as inactive (in storage) unless there are no other sets
    is_active = not has_equipped_set

    # Create 4 tires
    for position in ['Front Left', 'Front Right', 'Rear Left', 'Rear Right']:
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

    # Create 4 rims
    rim_price = purchase_price / 8 if purchase_price else None
    for position in ['Front Left', 'Front Right', 'Rear Left', 'Rear Right']:
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

    db.session.commit()

    # Refresh to ensure components relationship is loaded
    db.session.refresh(tire_set)
    return tire_set


def swap_tire_set(set_id):
    """
    Swap to this tire set.

    The accumulated_mileage is already being updated by add_miles_to_equipped_set()
    whenever vehicle mileage is updated. We just need to:
    1. Deactivate all other tire/rim sets
    2. Activate the new set
    3. Record the vehicle mileage at swap time for the new set
    """
    new_set = TireSet.query.get_or_404(set_id)

    # Get current vehicle mileage
    vehicle = Vehicle.query.get(new_set.vehicle_id)
    current_mileage = vehicle.current_mileage or 0

    # Deactivate all tire/rim components from other sets
    VehicleComponent.query.filter(
        VehicleComponent.vehicle_id == new_set.vehicle_id,
        VehicleComponent.tire_set_id != set_id,
        VehicleComponent.component_type.in_(['tire', 'rim'])
    ).update({
        'is_active': False,
        'remove_date': date.today(),
        'remove_mileage': current_mileage,
    }, synchronize_session=False)

    # Activate new set's components
    VehicleComponent.query.filter_by(tire_set_id=set_id).update({
        'is_active': True,
        'remove_date': None,
        'remove_mileage': None,
    }, synchronize_session=False)

    # Record vehicle mileage at time of swap (for future accumulation)
    new_set.mileage_at_last_swap = current_mileage

    # Set install_mileage if this is a brand new set
    if new_set.install_mileage is None:
        new_set.install_mileage = current_mileage

    db.session.commit()
    return new_set


def add_miles_to_equipped_set(vehicle_id, new_mileage):
    """
    Add miles to the currently equipped tire set when vehicle mileage is updated.
    Call this whenever the vehicle's odometer is updated via maintenance logs.
    """
    # Get vehicle to calculate mileage delta
    vehicle = Vehicle.query.get(vehicle_id)
    if not vehicle:
        return

    old_mileage = vehicle.current_mileage or 0
    mileage_delta = new_mileage - old_mileage

    # DEBUG
    print(f"[TIRE MILES] vehicle_id={vehicle_id}, old_mileage={old_mileage}, new_mileage={new_mileage}, delta={mileage_delta}")

    if mileage_delta <= 0:
        print(f"[TIRE MILES] Skipping - delta <= 0")
        return

    # Find currently equipped set
    equipped_component = VehicleComponent.query.filter(
        VehicleComponent.vehicle_id == vehicle_id,
        VehicleComponent.component_type.in_(['tire', 'rim']),
        VehicleComponent.is_active == True
    ).first()

    if equipped_component and equipped_component.tire_set_id:
        equipped_set = TireSet.query.get(equipped_component.tire_set_id)
        if equipped_set:
            old_accum = equipped_set.accumulated_mileage or 0
            # Add the mileage delta to the set's accumulated mileage
            equipped_set.accumulated_mileage = old_accum + mileage_delta
            print(f"[TIRE MILES] Added {mileage_delta} to set '{equipped_set.name}': {old_accum} -> {equipped_set.accumulated_mileage}")

    # Update vehicle mileage
    vehicle.current_mileage = new_mileage
    db.session.commit()


# ── Vehicle CRUD ───────────────────────────────────────────────

@vehicles_bp.route('/', methods=['GET'])
def list_vehicles():
    """Get all vehicles."""
    vehicles = Vehicle.query.order_by(Vehicle.year.desc()).all()
    return jsonify([v.to_dict() for v in vehicles])


@vehicles_bp.route('/', methods=['POST'])
def create_vehicle():
    """
    Add a new vehicle.
    Expects JSON body like:
    {
        "year": 2021,
        "make": "Ram",
        "model": "1500",
        "trim": "Night Edition",
        "color": "black",
        "current_mileage": 45000
    }
    """
    data = request.get_json()

    # Validate required fields
    if not all(k in data for k in ('year', 'make', 'model')):
        return jsonify({'error': 'year, make, and model are required'}), 400

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
    )
    db.session.add(vehicle)
    db.session.commit()

    # Auto-create default components for new vehicle
    create_default_components(vehicle.id)

    return jsonify(vehicle.to_dict()), 201


@vehicles_bp.route('/<int:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    """Get a vehicle with its maintenance logs and components."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    result = vehicle.to_dict()
    # Include full maintenance history, newest first
    result['maintenance_logs'] = [
        m.to_dict() for m in
        sorted(vehicle.maintenance_logs, key=lambda m: m.date, reverse=True)
    ]
    # Include all components
    result['components'] = [c.to_dict() for c in vehicle.components]
    return jsonify(result)


@vehicles_bp.route('/<int:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    """Update a vehicle's info."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json()

    # Update only the fields that were provided
    for field in ('year', 'make', 'model', 'trim', 'color', 'vin',
                  'license_plate', 'current_mileage', 'notes'):
        if field in data:
            setattr(vehicle, field, data[field])

    db.session.commit()
    return jsonify(vehicle.to_dict())


@vehicles_bp.route('/<int:vehicle_id>', methods=['DELETE'])
def delete_vehicle(vehicle_id):
    """Delete a vehicle and all its maintenance logs."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({'message': 'Vehicle deleted'}), 200


# ── Maintenance Log CRUD ──────────────────────────────────────

@vehicles_bp.route('/<int:vehicle_id>/maintenance', methods=['GET'])
def list_maintenance(vehicle_id):
    """Get all maintenance logs for a vehicle."""
    Vehicle.query.get_or_404(vehicle_id)  # Verify vehicle exists
    logs = (
        MaintenanceLog.query
        .filter_by(vehicle_id=vehicle_id)
        .order_by(MaintenanceLog.date.desc())
        .all()
    )
    return jsonify([m.to_dict() for m in logs])


@vehicles_bp.route('/<int:vehicle_id>/maintenance', methods=['POST'])
def create_maintenance(vehicle_id):
    """
    Add a maintenance record.
    Expects JSON body like:
    {
        "service_type": "Oil Change",
        "description": "Full synthetic 5W-30",
        "date": "2025-01-15",
        "mileage": 45000,
        "cost": 65.99,
        "shop_name": "Valvoline"
    }
    """
    Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json()

    if not all(k in data for k in ('service_type', 'date')):
        return jsonify({'error': 'service_type and date are required'}), 400

    log = MaintenanceLog(
        vehicle_id=vehicle_id,
        service_type=data['service_type'],
        description=data.get('description'),
        date=date.fromisoformat(data['date']),
        mileage=data.get('mileage'),
        cost=data.get('cost', 0.0),
        shop_name=data.get('shop_name'),
        next_service_mileage=data.get('next_service_mileage'),
        next_service_date=(
            date.fromisoformat(data['next_service_date'])
            if data.get('next_service_date') else None
        ),
    )
    db.session.add(log)
    db.session.commit()

    # If maintenance log has mileage, update vehicle and equipped tire set
    if 'mileage' in data and data['mileage'] is not None:
        add_miles_to_equipped_set(vehicle_id, data['mileage'])

    return jsonify(log.to_dict()), 201


@vehicles_bp.route('/maintenance/<int:log_id>', methods=['PUT'])
def update_maintenance(log_id):
    """Update a maintenance log entry."""
    log = MaintenanceLog.query.get_or_404(log_id)
    data = request.get_json()

    for field in ('service_type', 'description', 'mileage', 'cost',
                  'shop_name', 'next_service_mileage'):
        if field in data:
            setattr(log, field, data[field])

    if 'date' in data:
        log.date = date.fromisoformat(data['date'])
    if 'next_service_date' in data:
        log.next_service_date = (
            date.fromisoformat(data['next_service_date'])
            if data['next_service_date'] else None
        )

    db.session.commit()
    return jsonify(log.to_dict())


@vehicles_bp.route('/maintenance/<int:log_id>', methods=['DELETE'])
def delete_maintenance(log_id):
    """Delete a maintenance log entry."""
    log = MaintenanceLog.query.get_or_404(log_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Maintenance log deleted'}), 200


# ── Component CRUD ─────────────────────────────────────────────

@vehicles_bp.route('/<int:vehicle_id>/components', methods=['GET'])
def list_components(vehicle_id):
    """
    Get all components for a vehicle.
    Query params:
      - type: filter by component_type (e.g., ?type=tire)
      - active: true/false to show only active or archived
      - position: filter by position (partial match)
    """
    Vehicle.query.get_or_404(vehicle_id)  # Verify vehicle exists

    query = VehicleComponent.query.filter_by(vehicle_id=vehicle_id)

    # Apply filters
    if request.args.get('type'):
        query = query.filter_by(component_type=request.args.get('type'))
    if request.args.get('active'):
        is_active = request.args.get('active').lower() == 'true'
        query = query.filter_by(is_active=is_active)
    if request.args.get('position'):
        query = query.filter(
            VehicleComponent.position.ilike(f"%{request.args.get('position')}%")
        )

    # Sort: active first, then by install date (newest first)
    components = query.order_by(
        VehicleComponent.is_active.desc(),
        VehicleComponent.install_date.desc()
    ).all()

    return jsonify([c.to_dict() for c in components])


@vehicles_bp.route('/<int:vehicle_id>/components', methods=['POST'])
def create_component(vehicle_id):
    """
    Add a new component to a vehicle.
    Expects JSON body like:
    {
        "component_type": "tire",
        "position": "Front Left",
        "brand": "Michelin",
        "model": "Defender T/A",
        "install_date": "2025-01-15",
        "install_mileage": 45000,
        "purchase_price": 250.00
    }
    """
    Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json()

    if 'component_type' not in data:
        return jsonify({'error': 'component_type is required'}), 400

    component = VehicleComponent(
        vehicle_id=vehicle_id,
        component_type=data['component_type'],
        position=data.get('position'),
        brand=data.get('brand'),
        part_number=data.get('part_number'),
        model=data.get('model'),
        install_date=parse_component_date(data.get('install_date')),
        install_mileage=data.get('install_mileage'),
        purchase_date=parse_component_date(data.get('purchase_date')),
        purchase_price=data.get('purchase_price'),
        warranty_info=data.get('warranty_info'),
        notes=data.get('notes'),
    )
    db.session.add(component)
    db.session.commit()

    return jsonify(component.to_dict()), 201


@vehicles_bp.route('/components/<int:component_id>', methods=['GET'])
def get_component(component_id):
    """Get a single component with its logs."""
    component = VehicleComponent.query.get_or_404(component_id)
    result = component.to_dict()
    # Include full log history, newest first
    result['logs'] = [
        log.to_dict() for log in
        sorted(component.component_logs, key=lambda l: l.date, reverse=True)
    ]
    return jsonify(result)


@vehicles_bp.route('/components/<int:component_id>', methods=['PUT'])
def update_component(component_id):
    """
    Update a component.
    Also supports archiving: set is_active=false with remove_date and remove_mileage.
    """
    component = VehicleComponent.query.get_or_404(component_id)
    data = request.get_json()

    # Update all provided fields
    for field in ('component_type', 'position', 'brand', 'part_number',
                  'model', 'install_mileage', 'remove_mileage',
                  'purchase_price', 'warranty_info', 'notes', 'is_active'):
        if field in data:
            setattr(component, field, data[field])

    # Handle date fields
    if 'install_date' in data:
        component.install_date = parse_component_date(data['install_date'])
    if 'purchase_date' in data:
        component.purchase_date = parse_component_date(data['purchase_date'])
    if 'remove_date' in data:
        component.remove_date = parse_component_date(data['remove_date'])

    db.session.commit()
    return jsonify(component.to_dict())


@vehicles_bp.route('/components/<int:component_id>', methods=['DELETE'])
def delete_component(component_id):
    """
    Delete a component permanently.
    Consider using the archive pattern (PUT with is_active=false) instead.
    """
    component = VehicleComponent.query.get_or_404(component_id)
    db.session.delete(component)
    db.session.commit()
    return jsonify({'message': 'Component deleted'}), 200


@vehicles_bp.route('/<int:vehicle_id>/defaults', methods=['POST'])
def add_default_components(vehicle_id):
    """
    Manually add default components to an existing vehicle.
    Skips components that already exist (type+position match).
    """
    Vehicle.query.get_or_404(vehicle_id)
    created = create_default_components(vehicle_id)
    return jsonify(created), 201


# ── Component Log CRUD ────────────────────────────────────────

@vehicles_bp.route('/components/<int:component_id>/logs', methods=['POST'])
def create_component_log(component_id):
    """
    Add a service log for a component.
    Expects JSON body like:
    {
        "log_type": "rotation",
        "description": "Rotated front to rear",
        "date": "2025-02-01",
        "mileage": 46000
    }
    """
    VehicleComponent.query.get_or_404(component_id)
    data = request.get_json()

    if not all(k in data for k in ('log_type', 'date')):
        return jsonify({'error': 'log_type and date are required'}), 400

    log = ComponentLog(
        component_id=component_id,
        log_type=data['log_type'],
        description=data.get('description'),
        date=date.fromisoformat(data['date']),
        mileage=data.get('mileage'),
        cost=data.get('cost', 0.0),
        shop_name=data.get('shop_name'),
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(log.to_dict()), 201


@vehicles_bp.route('/component-logs/<int:log_id>', methods=['PUT'])
def update_component_log(log_id):
    """Update a component log entry."""
    log = ComponentLog.query.get_or_404(log_id)
    data = request.get_json()

    for field in ('log_type', 'description', 'mileage', 'cost', 'shop_name'):
        if field in data:
            setattr(log, field, data[field])

    if 'date' in data:
        log.date = date.fromisoformat(data['date'])

    db.session.commit()
    return jsonify(log.to_dict())


@vehicles_bp.route('/component-logs/<int:log_id>', methods=['DELETE'])
def delete_component_log(log_id):
    """Delete a component log entry."""
    log = ComponentLog.query.get_or_404(log_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Component log deleted'}), 200


# ── Fuel Log Endpoints ────────────────────────────────────

@vehicles_bp.route('/<int:vehicle_id>/fuel-logs', methods=['GET'])
def list_fuel_logs(vehicle_id):
    """Get all fuel logs for a vehicle, newest first."""
    Vehicle.query.get_or_404(vehicle_id)
    logs = (
        FuelLog.query
        .filter_by(vehicle_id=vehicle_id)
        .order_by(FuelLog.date.desc(), FuelLog.id.desc())
        .all()
    )
    return jsonify([log.to_dict() for log in logs])


@vehicles_bp.route('/<int:vehicle_id>/fuel-logs', methods=['POST'])
def create_fuel_log(vehicle_id):
    """Add a fuel log with MPG calculation."""
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json()

    if not data or not data.get('date'):
        return jsonify({'error': 'date is required'}), 400

    # Check if user flagged a missed previous fill-up (skip MPG calculation)
    missed_previous = bool(data.get('missed_previous', False))

    # Calculate MPG from the fill-up with the closest lower mileage
    mileage = data.get('mileage')
    mpg = None
    if mileage and not missed_previous:
        previous_log = (
            FuelLog.query
            .filter_by(vehicle_id=vehicle_id)
            .filter(FuelLog.mileage < mileage)
            .order_by(FuelLog.mileage.desc())
            .first()
        )
        if previous_log:
            miles_driven = mileage - previous_log.mileage
            gallons = data.get('gallons_added')
            if gallons and gallons > 0:
                mpg = round(miles_driven / gallons, 1)

    # Auto-calculate total_cost if not provided
    total_cost = data.get('total_cost')
    if total_cost is None:
        gallons = data.get('gallons_added', 0)
        price_per = data.get('cost_per_gallon', 0)
        total_cost = gallons * price_per

    log = FuelLog(
        vehicle_id=vehicle_id,
        date=datetime.fromisoformat(data['date']),
        mileage=mileage,
        gallons_added=data.get('gallons_added'),
        cost_per_gallon=data.get('cost_per_gallon'),
        total_cost=total_cost,
        location=data.get('location'),
        fuel_type=data.get('fuel_type'),
        payment_method=data.get('payment_method'),
        notes=data.get('notes'),
        mpg=mpg,
        missed_previous=missed_previous,
    )
    db.session.add(log)

    # Update vehicle odometer if this fill-up has a higher mileage
    if mileage and (vehicle.current_mileage is None or mileage > vehicle.current_mileage):
        vehicle.current_mileage = mileage

    db.session.commit()

    return jsonify(log.to_dict()), 201


@vehicles_bp.route('/fuel-logs/<int:log_id>', methods=['PUT'])
def update_fuel_log(log_id):
    """Update a fuel log."""
    log = FuelLog.query.get_or_404(log_id)
    data = request.get_json()

    for field in ('date', 'mileage', 'gallons_added', 'cost_per_gallon',
                  'total_cost', 'location', 'fuel_type', 'payment_method', 'notes'):
        if field in data:
            setattr(log, field, data[field])

    db.session.commit()
    return jsonify(log.to_dict())


@vehicles_bp.route('/fuel-logs/<int:log_id>', methods=['DELETE'])
def delete_fuel_log(log_id):
    """Delete a fuel log."""
    log = FuelLog.query.get_or_404(log_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Fuel log deleted'}), 200


# ── Tire Set Endpoints ────────────────────────────────────

@vehicles_bp.route('/<int:vehicle_id>/tire-sets', methods=['GET'])
def list_tire_sets(vehicle_id):
    """Get all tire sets for a vehicle."""
    Vehicle.query.get_or_404(vehicle_id)
    sets = TireSet.query.filter_by(vehicle_id=vehicle_id).order_by(TireSet.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sets])


@vehicles_bp.route('/tire-sets/<int:set_id>', methods=['GET'])
def get_tire_set(set_id):
    """Get a single tire set with its components."""
    tire_set = TireSet.query.get_or_404(set_id)
    return jsonify(tire_set.to_dict()), 200


@vehicles_bp.route('/<int:vehicle_id>/tire-sets', methods=['POST'])
def create_tire_set_endpoint(vehicle_id):
    """
    Add a new tire set (creates 8 components: 4 tires + 4 rims).

    Expects JSON body like:
    {
        "name": "Winter Set 2024",
        "tire_brand": "Bridgestone",
        "tire_model": "Blizzak",
        "rim_brand": "Fuel",
        "rim_model": "Trophy",
        "install_date": "2024-11-15",
        "install_mileage": 45000,
        "purchase_date": "2024-10-01",
        "purchase_price": 1400.00
    }
    """
    Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json()

    print(f"[TIRE SET CREATE] vehicle_id={vehicle_id}, data={data}", file=sys.stderr, flush=True)

    if not data or not data.get('name'):
        print(f"[TIRE SET CREATE] Missing name - data={data}", file=sys.stderr, flush=True)
        return jsonify({'error': 'name is required'}), 400

    try:
        tire_set = create_tire_set(vehicle_id, data)
        return jsonify(tire_set.to_dict()), 201
    except Exception as e:
        print(f"[TIRE SET CREATE] Exception: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@vehicles_bp.route('/tire-sets/<int:set_id>', methods=['PUT'])
def update_tire_set(set_id):
    """
    Update a tire set.

    Only updates set-level info (name, brands, models). To modify individual
    tires/rims, update those components directly.
    """
    tire_set = TireSet.query.get_or_404(set_id)
    data = request.get_json()

    for field in ('name', 'tire_brand', 'tire_model', 'rim_brand', 'rim_model',
                  'install_date', 'install_mileage', 'accumulated_mileage',
                  'purchase_date', 'purchase_price', 'notes'):
        if field in data:
            setattr(tire_set, field, data[field])

    db.session.commit()
    return jsonify(tire_set.to_dict()), 200


@vehicles_bp.route('/tire-sets/<int:set_id>', methods=['DELETE'])
def delete_tire_set(set_id):
    """
    Delete a tire set and all its 8 components (4 tires + 4 rims).
    """
    tire_set = TireSet.query.get_or_404(set_id)

    # Delete all components in this set (cascade handles this)
    db.session.delete(tire_set)
    db.session.commit()

    return jsonify({'message': 'Tire set deleted'}), 200


@vehicles_bp.route('/tire-sets/<int:set_id>/swap', methods=['POST'])
def swap_tire_set_endpoint(set_id):
    """
    Swap to this tire set.

    Archives all other sets for this vehicle and activates this one.
    Also updates current_mileage on the new set.
    """
    new_set = swap_tire_set(set_id)
    return jsonify(new_set.to_dict()), 200
