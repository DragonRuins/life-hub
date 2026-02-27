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

    from app.routes.kb import kb_bp
    app.register_blueprint(kb_bp, url_prefix='/api/kb')

    from app.routes.infrastructure import infrastructure_bp
    app.register_blueprint(infrastructure_bp, url_prefix='/api/infrastructure')

    from app.routes.astrometrics import astrometrics_bp
    app.register_blueprint(astrometrics_bp, url_prefix='/api/astrometrics')

    from app.routes.trek import trek_bp
    app.register_blueprint(trek_bp, url_prefix='/api/trek')

    from app.routes.ai import ai_bp
    app.register_blueprint(ai_bp, url_prefix='/api/ai')

    from app.routes.data_import import import_bp
    app.register_blueprint(import_bp, url_prefix='/api/import')

    from app.routes.work_hours import work_hours_bp
    app.register_blueprint(work_hours_bp, url_prefix='/api/work-hours')

    # ── Create database tables ─────────────────────────────────
    # Import all models so SQLAlchemy knows about them,
    # then create any tables that don't exist yet.
    # Note: Alembic migrations handle column additions and data changes.
    # db.create_all() only creates new tables — it won't add columns to
    # existing tables. The entrypoint.sh runs `flask db upgrade` before
    # the app starts to handle migrations in production.
    with app.app_context():
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, work_hours  # noqa: F401
        db.create_all()

        # ── Safe column migrations ──────────────────────────────
        # db.create_all() doesn't add columns to existing tables.
        # These ALTER TABLE statements are idempotent (IF NOT EXISTS / IF EXISTS).
        _run_safe_migrations(db)

        # Auto-seed preset maintenance items if the table is empty.
        # This runs on first deploy so the user doesn't need to run the
        # seed script manually.
        try:
            from app.models.maintenance_interval import MaintenanceItem
            if MaintenanceItem.query.count() == 0:
                _seed_maintenance_items(db)
        except Exception:
            pass  # Don't break startup if seeding fails

        # Auto-seed astrometrics notification rules (all disabled by default).
        try:
            _seed_astro_notification_rules(db)
        except Exception:
            pass  # Don't break startup if seeding fails

        # Auto-seed smart home / printer notification rules (all disabled by default).
        try:
            _seed_smarthome_notification_rules(db)
        except Exception:
            pass  # Don't break startup if seeding fails

    # ── Initialize notification scheduler ─────────────────────
    # APScheduler runs scheduled notification rules in the background.
    # Uses PostgreSQL as the job store so jobs survive app restarts.
    #
    # IMPORTANT: Only start the scheduler in ONE process to prevent
    # duplicate notifications. In dev mode, Flask's reloader spawns
    # two processes — only the child (WERKZEUG_RUN_MAIN=true) should
    # run the scheduler. In production with Gunicorn, we use a file
    # lock so only the first worker starts it.
    import os
    should_start_scheduler = True

    # Dev mode: Flask reloader spawns parent + child. Only run in child.
    if os.environ.get('FLASK_ENV') != 'production':
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
            should_start_scheduler = False
    else:
        # Production (Gunicorn with multiple workers): use a file lock
        # so only the first worker to acquire the lock starts the scheduler.
        import fcntl
        lock_path = '/tmp/datacore_scheduler.lock'
        try:
            # Open (or create) the lock file and try a non-blocking exclusive lock
            lock_fd = open(lock_path, 'w')
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Got the lock — this worker runs the scheduler.
            # Keep lock_fd open for the lifetime of the process (GC won't close
            # it because we store a reference on the app object).
            app._scheduler_lock_fd = lock_fd
        except (IOError, OSError):
            # Another worker already holds the lock — skip scheduler.
            should_start_scheduler = False

    if should_start_scheduler:
        from app.services.scheduler import init_scheduler
        init_scheduler(app)

        # Start HA WebSocket client for real-time state updates
        try:
            from app.services.infrastructure.ha_websocket import HAWebSocketClient
            app.ha_ws_client = HAWebSocketClient(app)
            app.ha_ws_client.start()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to start HA WebSocket client: {e}")
            app.ha_ws_client = None

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


def _seed_astro_notification_rules(db):
    """Seed default astrometrics notification rules on first startup.

    Creates 4 event-based rules (all disabled by default) so the user
    can enable them from the Notifications settings page.
    """
    from app.models.notification import NotificationRule

    astro_rules = [
        {
            'name': 'Launch Reminder',
            'event_name': 'astro.launch_reminder',
            'module': 'astrometrics',
            'description': 'Get notified before upcoming launches',
            'title_template': 'Upcoming Launch: {{launch_name}}',
            'body_template': '{{launch_name}} is launching in {{hours_until}} from {{pad_name}}.',
        },
        {
            'name': 'NEO Close Approach',
            'event_name': 'astro.neo_close_approach',
            'module': 'astrometrics',
            'description': 'Alert when an asteroid passes within threshold distance',
            'title_template': 'Close Approach: {{neo_name}}',
            'body_template': '{{neo_name}} will pass within {{miss_distance_ld}} lunar distances on {{close_approach_date}}.',
        },
        {
            'name': 'Hazardous NEO Alert',
            'event_name': 'astro.neo_hazardous',
            'module': 'astrometrics',
            'description': 'Alert when a potentially hazardous asteroid is detected nearby',
            'title_template': 'Hazardous Asteroid: {{neo_name}}',
            'body_template': 'Potentially hazardous asteroid {{neo_name}} (diameter ~{{diameter_m}}m) approaching within {{miss_distance_ld}} LD.',
        },
        {
            'name': 'New APOD',
            'event_name': 'astro.apod_new',
            'module': 'astrometrics',
            'description': 'Daily notification when a new Astronomy Picture of the Day is available',
            'title_template': 'APOD: {{title}}',
            'body_template': "Today's Astronomy Picture of the Day: {{title}}.",
        },
        {
            'name': 'Launch In Flight',
            'event_name': 'astro.launch_inflight',
            'module': 'astrometrics',
            'description': 'Get notified when a tracked launch has lifted off',
            'title_template': 'Liftoff: {{launch_name}}',
            'body_template': '{{launch_name}} by {{provider}} has launched from {{pad_name}}.',
        },
    ]

    for rule_data in astro_rules:
        # Only insert if the rule doesn't already exist (idempotent)
        existing = NotificationRule.query.filter_by(
            event_name=rule_data['event_name']
        ).first()
        if not existing:
            db.session.add(NotificationRule(
                name=rule_data['name'],
                description=rule_data['description'],
                module=rule_data['module'],
                rule_type='event',
                event_name=rule_data['event_name'],
                title_template=rule_data['title_template'],
                body_template=rule_data['body_template'],
                priority='normal',
                is_enabled=False,
            ))
    db.session.commit()


def _seed_smarthome_notification_rules(db):
    """Seed default smart home and printer notification rules on first startup.

    Creates event-based rules (all disabled by default) for smart home
    device monitoring and 3D printer job tracking.
    """
    from app.models.notification import NotificationRule

    smarthome_rules = [
        {
            'name': 'Smart Home Device Unavailable',
            'event_name': 'smarthome.device_unavailable',
            'module': 'infrastructure',
            'description': 'Alert when a smart home device becomes unavailable',
            'title_template': 'Device Offline: {{device_name}}',
            'body_template': '{{device_name}} ({{domain}}) in {{room}} is now unavailable.',
        },
        {
            'name': 'Smart Home Device Recovered',
            'event_name': 'smarthome.device_recovered',
            'module': 'infrastructure',
            'description': 'Notification when a device recovers from unavailable state',
            'title_template': 'Device Online: {{device_name}}',
            'body_template': '{{device_name}} ({{domain}}) in {{room}} is back online.',
        },
        {
            'name': 'Print Job Completed',
            'event_name': 'printer.job_completed',
            'module': 'infrastructure',
            'description': 'Get notified when a 3D print job finishes successfully',
            'title_template': 'Print Complete: {{file_name}}',
            'body_template': '{{file_name}} on {{printer_name}} completed successfully.',
        },
        {
            'name': 'Print Job Failed',
            'event_name': 'printer.job_failed',
            'module': 'infrastructure',
            'description': 'Alert when a 3D print job fails or errors',
            'title_template': 'Print Failed: {{file_name}}',
            'body_template': '{{file_name}} on {{printer_name}} failed at {{progress}}% progress.',
        },
        {
            'name': 'Print Job Started',
            'event_name': 'printer.job_started',
            'module': 'infrastructure',
            'description': 'Notification when a new print job begins',
            'title_template': 'Print Started: {{file_name}}',
            'body_template': '{{printer_name}} has started printing {{file_name}}.',
        },
    ]

    for rule_data in smarthome_rules:
        existing = NotificationRule.query.filter_by(
            event_name=rule_data['event_name']
        ).first()
        if not existing:
            db.session.add(NotificationRule(
                name=rule_data['name'],
                description=rule_data['description'],
                module=rule_data['module'],
                rule_type='event',
                event_name=rule_data['event_name'],
                title_template=rule_data['title_template'],
                body_template=rule_data['body_template'],
                priority='normal',
                is_enabled=False,
            ))
    db.session.commit()


def _run_safe_migrations(db):
    """Run idempotent ALTER TABLE statements for columns added after initial table creation.

    These use IF NOT EXISTS / IF EXISTS so they're safe to run repeatedly.
    PostgreSQL 9.6+ supports ADD COLUMN IF NOT EXISTS.
    """
    from sqlalchemy import text

    migrations = [
        # Add is_favorited to smart home devices (for header quick menu)
        """ALTER TABLE infra_smarthome_devices
           ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT FALSE""",

        # Rename metadata -> job_metadata on printer jobs
        # (metadata is reserved in SQLAlchemy 2.x Declarative API)
        """DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'infra_printer_jobs' AND column_name = 'metadata'
            ) THEN
                ALTER TABLE infra_printer_jobs RENAME COLUMN metadata TO job_metadata;
            END IF;
        END $$""",
    ]

    for sql in migrations:
        try:
            db.session.execute(text(sql))
        except Exception:
            db.session.rollback()
            continue
    db.session.commit()
