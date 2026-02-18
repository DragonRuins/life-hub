"""
Datacore - Flask Application Factory

This is the "app factory" pattern. Instead of creating the Flask app
at module level, we create it inside a function. This makes testing
easier and lets us create multiple instances if needed.

When you want to add a new module, you:
1. Create a model in app/models/
2. Create routes in app/routes/
3. Register the blueprint here in create_app()
"""
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# These are initialized here but configured in create_app()
# This lets other files import them (e.g., models need db)
db = SQLAlchemy()
migrate = Migrate()


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object('app.config.Config')

    # Allow the React frontend to make requests to this API
    # In development, React runs on port 3000, Flask on port 5000
    CORS(app)

    # Initialize database and migration support
    db.init_app(app)
    migrate.init_app(app, db)

    # ── Register Modules (Blueprints) ──────────────────────────
    # Each module is a Flask "blueprint" - a self-contained set of routes.
    # To add a new module, create it in app/routes/ and register it here.

    from app.routes.dashboard import dashboard_bp
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

    from app.routes.vehicles import vehicles_bp
    app.register_blueprint(vehicles_bp, url_prefix='/api/vehicles')

    from app.routes.notes import notes_bp
    app.register_blueprint(notes_bp, url_prefix='/api/notes')

    from app.routes.folders import folders_bp
    app.register_blueprint(folders_bp, url_prefix='/api/folders')

    from app.routes.attachments import attachments_bp
    app.register_blueprint(attachments_bp, url_prefix='/api/attachments')

    from app.routes.fuel import fuel_bp
    app.register_blueprint(fuel_bp, url_prefix='/api/fuel')

    from app.routes.notifications import notifications_bp
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')

    from app.routes.projects import projects_bp
    app.register_blueprint(projects_bp, url_prefix='/api/projects')

    # ── Create database tables ─────────────────────────────────
    # Import all models so SQLAlchemy knows about them,
    # then create any tables that don't exist yet.
    # Note: Alembic migrations handle column additions and data changes.
    # db.create_all() only creates new tables — it won't add columns to
    # existing tables. The entrypoint.sh runs `flask db upgrade` before
    # the app starts to handle migrations in production.
    with app.app_context():
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project  # noqa: F401
        db.create_all()

        # Auto-seed preset maintenance items if the table is empty.
        # This runs on first deploy so the user doesn't need to run the
        # seed script manually.
        try:
            from app.models.maintenance_interval import MaintenanceItem
            if MaintenanceItem.query.count() == 0:
                _seed_maintenance_items(db)
        except Exception:
            pass  # Don't break startup if seeding fails

    # ── Initialize notification scheduler ─────────────────────
    # APScheduler runs scheduled notification rules in the background.
    # Uses PostgreSQL as the job store so jobs survive app restarts.
    from app.services.scheduler import init_scheduler
    init_scheduler(app)

    # Simple health check endpoint
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'app': 'Datacore'}

    return app


def _seed_maintenance_items(db):
    """Seed the preset maintenance items catalog on first startup."""
    from app.models.maintenance_interval import MaintenanceItem

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
