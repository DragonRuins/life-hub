"""
Vehicle Module - Database Models

Defines four tables:
  - vehicles: Your vehicles (year, make, model, etc.)
  - maintenance_logs: Service records linked to a vehicle
  - vehicle_components: Parts installed on vehicles (tires, battery, etc.)
  - component_logs: Service history specific to a component

SQLAlchemy models map Python classes to database tables.
Each attribute becomes a column. You interact with the database
using Python objects instead of writing raw SQL.
"""
from datetime import datetime, timezone
from app import db


class Vehicle(db.Model):
    """A vehicle you own or track."""
    __tablename__ = 'vehicles'

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    make = db.Column(db.String(100), nullable=False)       # e.g., "Ram"
    model = db.Column(db.String(100), nullable=False)      # e.g., "1500"
    trim = db.Column(db.String(100))                        # e.g., "Night Edition"
    color = db.Column(db.String(50))
    vin = db.Column(db.String(17))                          # Vehicle Identification Number
    license_plate = db.Column(db.String(20))
    current_mileage = db.Column(db.Float)
    notes = db.Column(db.Text)                              # Any extra info
    is_primary = db.Column(db.Boolean, default=False)         # Favorite vehicle for dashboard
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one vehicle has many maintenance logs
    # "cascade='all, delete-orphan'" means if you delete a vehicle,
    # its maintenance logs are deleted too
    maintenance_logs = db.relationship(
        'MaintenanceLog', backref='vehicle', cascade='all, delete-orphan'
    )

    # Relationship: one vehicle has many fuel logs
    # Deleting a vehicle deletes all its fuel logs
    fuel_logs = db.relationship(
        'FuelLog', backref='vehicle', cascade='all, delete-orphan'
    )

    # Relationship: one vehicle has many components
    # Components are parts like tires, battery, filters, etc.
    components = db.relationship(
        'VehicleComponent', backref='vehicle', cascade='all, delete-orphan'
    )

    # Relationship: one vehicle has many tire sets
    # Deleting a vehicle deletes all its tire sets
    tire_sets = db.relationship(
        'TireSet', backref='vehicle', cascade='all, delete-orphan'
    )

    # Relationship: one vehicle has many maintenance intervals
    maintenance_intervals = db.relationship(
        'VehicleMaintenanceInterval', backref='vehicle', cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'year': self.year,
            'make': self.make,
            'model': self.model,
            'trim': self.trim,
            'color': self.color,
            'vin': self.vin,
            'license_plate': self.license_plate,
            'current_mileage': self.current_mileage,
            'notes': self.notes,
            'is_primary': self.is_primary or False,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'maintenance_count': len(self.maintenance_logs),
            'component_count': len(self.components),
            'fuel_log_count': len(self.fuel_logs),
        }


class MaintenanceLog(db.Model):
    """A maintenance/service record for a vehicle."""
    __tablename__ = 'maintenance_logs'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)

    # What was done
    service_type = db.Column(db.String(100), nullable=False)  # e.g., "Oil Change"
    description = db.Column(db.Text)                           # Detailed notes
    date = db.Column(db.Date, nullable=False)                  # When it was done
    mileage = db.Column(db.Integer)                            # Mileage at service

    # Cost tracking
    cost = db.Column(db.Float, default=0.0)
    shop_name = db.Column(db.String(200))                      # Where it was done

    # Reminder for next service
    next_service_mileage = db.Column(db.Integer)               # e.g., next oil change at 50,000
    next_service_date = db.Column(db.Date)                     # e.g., in 6 months

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: which maintenance items were serviced in this log entry
    # A log can cover multiple items (e.g., "Oil Change" = Engine Oil + Oil Filter)
    items = db.relationship(
        'MaintenanceItem',
        secondary='maintenance_log_items',
        backref='maintenance_logs'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'service_type': self.service_type,
            'description': self.description,
            'date': self.date.isoformat() if self.date else None,
            'mileage': self.mileage,
            'cost': self.cost,
            'shop_name': self.shop_name,
            'next_service_mileage': self.next_service_mileage,
            'next_service_date': self.next_service_date.isoformat() if self.next_service_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'item_ids': [item.id for item in self.items],
            'item_names': [item.name for item in self.items],
        }


class VehicleComponent(db.Model):
    """A part or component installed on a vehicle (tire, battery, filter, etc.)."""
    __tablename__ = 'vehicle_components'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)

    # What is it?
    component_type = db.Column(db.String(100), nullable=False)  # e.g., "tire", "battery", "oil_filter"
    position = db.Column(db.String(100))                         # e.g., "Front Left", "Engine Bay", etc.

    # Product details
    brand = db.Column(db.String(100))          # e.g., "Michelin"
    part_number = db.Column(db.String(100))     # Manufacturer part number
    model = db.Column(db.String(100))          # e.g., "Defender T/A"

    # Installation info
    install_date = db.Column(db.Date)           # When installed
    install_mileage = db.Column(db.Integer)     # Vehicle mileage at install

    # Removal info (for archived parts)
    remove_date = db.Column(db.Date)            # When removed (null = still installed)
    remove_mileage = db.Column(db.Integer)      # Vehicle mileage at removal
    is_active = db.Column(db.Boolean, default=True)  # true = installed, false = removed
    tire_set_id = db.Column(db.Integer, db.ForeignKey('tire_sets.id'))  # Optional, links component to a set

    # Purchase & warranty
    purchase_date = db.Column(db.Date)         # When you bought it
    purchase_price = db.Column(db.Float)         # Cost
    warranty_info = db.Column(db.Text)         # Warranty details, expiration, etc.

    # Additional info
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one component has many service logs
    component_logs = db.relationship(
        'ComponentLog', backref='component', cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'component_type': self.component_type,
            'position': self.position,
            'brand': self.brand,
            'part_number': self.part_number,
            'model': self.model,
            'install_date': self.install_date.isoformat() if self.install_date else None,
            'install_mileage': self.install_mileage,
            'remove_date': self.remove_date.isoformat() if self.remove_date else None,
            'remove_mileage': self.remove_mileage,
            'is_active': self.is_active,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'purchase_price': self.purchase_price,
            'warranty_info': self.warranty_info,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'log_count': len(self.component_logs),
        }


class TireSet(db.Model):
    """A set of 4 tires + 4 rims that can be swapped on a vehicle."""
    __tablename__ = 'tire_sets'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    name = db.Column(db.String(100))  # "Winter Set 2024"
    tire_brand = db.Column(db.String(100))  # "Bridgestone"
    tire_model = db.Column(db.String(100))  # "Blizzak"
    rim_brand = db.Column(db.String(100))  # "Fuel"
    rim_model = db.Column(db.String(100))  # "Trophy"
    install_date = db.Column(db.Date)
    install_mileage = db.Column(db.Integer)  # Vehicle mileage when first installed
    accumulated_mileage = db.Column(db.Integer, default=0)  # Total miles this set has been used
    mileage_at_last_swap = db.Column(db.Integer)  # Vehicle mileage when last equipped
    rated_lifespan = db.Column(db.Integer, nullable=True)  # Manufacturer-rated tire lifespan in miles
    purchase_date = db.Column(db.Date)
    purchase_price = db.Column(db.Float)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one set has many components (8 total: 4 tires + 4 rims)
    components = db.relationship(
        'VehicleComponent', backref='tire_set', cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        # Check if this set is currently equipped (has active components)
        is_equipped = any(c.is_active for c in self.components if c.component_type in ['tire', 'rim'])

        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'name': self.name,
            'tire_brand': self.tire_brand,
            'tire_model': self.tire_model,
            'rim_brand': self.rim_brand,
            'rim_model': self.rim_model,
            'install_date': self.install_date.isoformat() if self.install_date else None,
            'install_mileage': self.install_mileage,
            'accumulated_mileage': self.accumulated_mileage or 0,
            'mileage_at_last_swap': self.mileage_at_last_swap,
            'rated_lifespan': self.rated_lifespan,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'purchase_price': self.purchase_price,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'component_count': len(self.components),
            'is_current': is_equipped,
        }


class FuelLog(db.Model):
    """Track fuel fill-ups and calculate MPG."""
    __tablename__ = 'fuel_logs'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    mileage = db.Column(db.Float, nullable=False)  # Odometer at fill-up
    gallons_added = db.Column(db.Float, nullable=False)  # Amount of fuel added
    cost_per_gallon = db.Column(db.Float, nullable=False)  # Price per gallon
    total_cost = db.Column(db.Float, nullable=False)  # Calculated or manual entry
    location = db.Column(db.String(200))  # Optional: where purchased (e.g., "Shell station on Main St")
    fuel_type = db.Column(db.String(50))  # Optional: regular, midgrade, premium, diesel, e85, high
    octane_rating = db.Column(db.Integer)  # Optional: 87-93
    payment_method = db.Column(db.String(50))  # Optional: cash, credit, debit, mobile
    notes = db.Column(db.Text)  # Additional notes
    mpg = db.Column(db.Float)  # Calculated: miles driven / gallons
    missed_previous = db.Column(db.Boolean, default=False)  # True = missed a fill-up before this one, skip MPG calc
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'vehicle_id': self.vehicle_id,
            'date': self.date.isoformat() if self.date else None,
            'mileage': self.mileage,
            'gallons_added': self.gallons_added,
            'cost_per_gallon': self.cost_per_gallon,
            'total_cost': self.total_cost,
            'location': self.location,
            'fuel_type': self.fuel_type,
            'octane_rating': self.octane_rating,
            'payment_method': self.payment_method,
            'notes': self.notes,
            'mpg': self.mpg,
            'missed_previous': self.missed_previous,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ComponentLog(db.Model):
    """A service record for a specific vehicle component."""
    __tablename__ = 'component_log'

    id = db.Column(db.Integer, primary_key=True)
    component_id = db.Column(db.Integer, db.ForeignKey('vehicle_components.id'), nullable=False)

    # What was done
    log_type = db.Column(db.String(100), nullable=False)  # e.g., "rotation", "inspection", "repair"
    description = db.Column(db.Text)                           # Detailed notes
    date = db.Column(db.Date, nullable=False)                  # When it was done
    mileage = db.Column(db.Integer)                            # Vehicle mileage at service

    # Cost tracking
    cost = db.Column(db.Float, default=0.0)
    shop_name = db.Column(db.String(200))                      # Where it was done

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'component_id': self.component_id,
            'log_type': self.log_type,
            'description': self.description,
            'date': self.date.isoformat() if self.date else None,
            'mileage': self.mileage,
            'cost': self.cost,
            'shop_name': self.shop_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
