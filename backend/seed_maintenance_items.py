"""One-time script to seed the preset maintenance items."""
from app import create_app, db
from app.models.maintenance_interval import MaintenanceItem

app = create_app()
with app.app_context():
    if MaintenanceItem.query.count() > 0:
        print("Items already exist, skipping seed.")
    else:
        items = [
            # Common items (sort_order < 100) — shown at top of picker
            ('Oil Change', 'Fluids', 5000, 6, 1),
            ('Battery', 'Electrical', None, 48, 2),
            ('Air Filter', 'Filters', 15000, 12, 3),
            ('Tire Rotation', 'Tires', 7500, 6, 4),
            ('Brake Pads', 'Brakes', 40000, 36, 5),
            ('Cabin Air Filter', 'Filters', 15000, 12, 6),
            ('Wiper Blades', 'Exterior', None, 12, 7),
            ('Annual Inspection', 'Inspection', None, 12, 8),

            # Fluids
            ('Transmission Fluid', 'Fluids', 60000, 48, 110),
            ('Brake Fluid', 'Fluids', 30000, 24, 120),
            ('Coolant', 'Fluids', 30000, 24, 130),
            ('Power Steering Fluid', 'Fluids', 50000, 48, 140),
            ('Differential Fluid', 'Fluids', 30000, 36, 150),
            ('Transfer Case Fluid', 'Fluids', 30000, 36, 160),
            ('Windshield Washer Fluid', 'Fluids', None, 3, 170),

            # Filters
            ('Fuel Filter', 'Filters', 30000, 24, 210),

            # Ignition
            ('Spark Plugs', 'Ignition', 60000, 60, 310),

            # Belts & Hoses
            ('Serpentine Belt', 'Belts & Hoses', 60000, 60, 410),
            ('Timing Belt/Chain', 'Belts & Hoses', 100000, 84, 420),
            ('Radiator Hoses', 'Belts & Hoses', 60000, 60, 430),

            # Brakes
            ('Brake Rotors', 'Brakes', 70000, 60, 510),

            # Tires
            ('Wheel Alignment', 'Tires', 15000, 12, 520),
            ('Tire Balancing', 'Tires', 15000, 12, 530),
        ]
        for name, category, miles, months, sort_order in items:
            db.session.add(MaintenanceItem(
                name=name, category=category,
                default_miles_interval=miles,
                default_months_interval=months,
                is_preset=True, sort_order=sort_order,
            ))
        db.session.commit()
        print(f"Seeded {MaintenanceItem.query.count()} maintenance items")
