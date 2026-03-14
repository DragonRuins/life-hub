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

    from app.routes.obd import obd_bp
    app.register_blueprint(obd_bp, url_prefix='/api/obd')

    from app.routes.debts import debts_bp
    app.register_blueprint(debts_bp, url_prefix='/api/debts')

    from app.routes.timecard import timecard_bp
    app.register_blueprint(timecard_bp, url_prefix='/api/timecard')

    from app.routes.gps import gps_bp
    app.register_blueprint(gps_bp, url_prefix='/api/gps')

    # ── Create database tables ─────────────────────────────────
    # Import all models so SQLAlchemy knows about them,
    # then create any tables that don't exist yet.
    # Note: Alembic migrations handle column additions and data changes.
    # db.create_all() only creates new tables — it won't add columns to
    # existing tables. The entrypoint.sh runs `flask db upgrade` before
    # the app starts to handle migrations in production.
    with app.app_context():
        from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, obd, debt, timecard, gps_tracking  # noqa: F401
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

        # Ensure "Odometer Update" item exists (added after initial seed).
        try:
            from app.models.maintenance_interval import MaintenanceItem as MI
            if not MI.query.filter_by(name='Odometer Update').first():
                db.session.add(MI(
                    name='Odometer Update', category='General',
                    default_miles_interval=None, default_months_interval=None,
                    is_preset=True, sort_order=9,
                ))
                db.session.commit()
        except Exception:
            pass

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

        # Auto-seed debt payoff notification rules (all disabled by default).
        try:
            _seed_debt_notification_rules(db)
        except Exception:
            pass  # Don't break startup if seeding fails

        # Auto-seed timecard notification rules (all disabled by default).
        try:
            _seed_timecard_notification_rules(db)
        except Exception:
            pass

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

        # Start Trak-4 GPS sync if API key is configured
        if app.config.get('TRAK4_API_KEY'):
            from app.services.trak4_sync import start_sync_scheduler
            start_sync_scheduler(app)

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
        # General
        ('Odometer Update', 'General', None, None, 9),
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


def _seed_debt_notification_rules(db):
    """Seed default debt payoff notification rules on first startup."""
    from app.models.notification import NotificationRule

    debt_rules = [
        {
            'name': 'Debt Paid Off',
            'event_name': 'debt.paid_off',
            'module': 'debts',
            'description': 'When a debt is fully paid off',
            'title_template': 'Debt Paid Off: {{debt_label}}',
            'body_template': '{{debt_label}} is paid off! You\'ve freed up ${{monthly_payment}}/mo. Total freed: ${{total_freed_monthly}}/mo.',
        },
        {
            'name': 'Autopay Logged',
            'event_name': 'debt.autopay_logged',
            'module': 'debts',
            'description': 'When an autopay deduction is recorded',
            'title_template': 'Autopay: {{debt_label}}',
            'body_template': 'Autopay: ${{amount_paid}} applied to {{debt_label}}. Remaining balance: ${{remaining_balance}}.',
        },
        {
            'name': 'Savings Ready to Pay Off',
            'event_name': 'debt.savings_ready',
            'module': 'debts',
            'description': 'When savings balance can cover the next target debt',
            'title_template': 'Ready to Pay Off: {{debt_label}}',
            'body_template': 'Your savings (${{savings_balance}}) can now cover {{debt_label}} (${{debt_balance}}). Ready to pay it off?',
        },
        {
            'name': 'Savings Approaching Target',
            'event_name': 'debt.savings_approaching',
            'module': 'debts',
            'description': 'When savings reaches 80% of the next target debt',
            'title_template': 'Almost There: {{debt_label}}',
            'body_template': 'You\'re 80%+ of the way to paying off {{debt_label}}. ~${{shortfall}} more to go.',
        },
        {
            'name': 'All Debts Cleared',
            'event_name': 'debt.all_cleared',
            'module': 'debts',
            'description': 'When the last active debt is paid off',
            'title_template': 'All Debts Paid Off!',
            'body_template': 'All debts are paid off! Total interest saved: ${{total_interest_saved}}.',
        },
    ]

    for rule_data in debt_rules:
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


def _seed_timecard_notification_rules(db):
    """Seed default timecard notification rules on first startup."""
    from app.models.notification import NotificationRule

    timecard_rules = [
        {
            'name': 'Clock In',
            'event_name': 'timecard.clock_in',
            'module': 'timecard',
            'description': 'When you clock in to start tracking time',
            'title_template': 'Clocked In',
            'body_template': '{{work_type_label}} at {{time}}',
        },
        {
            'name': 'Clock Out',
            'event_name': 'timecard.clock_out',
            'module': 'timecard',
            'description': 'When you clock out and stop tracking time',
            'title_template': 'Clocked Out',
            'body_template': '{{duration}} — {{work_type_label}}',
        },
        {
            'name': 'Timer Auto-Stopped',
            'event_name': 'timecard.auto_stop',
            'module': 'timecard',
            'description': 'When a running timer is auto-stopped by starting a new one',
            'title_template': 'Timer Switched',
            'body_template': 'Stopped {{old_type}} ({{old_duration}}) → Started {{new_type}}',
        },
        {
            'name': 'Quick Day Logged',
            'event_name': 'timecard.quick_day',
            'module': 'timecard',
            'description': 'When a holiday or vacation day is logged',
            'title_template': 'Day Logged',
            'body_template': '{{day_type}} — 8h recorded for {{date}}',
        },
        {
            'name': 'Forgotten Timer',
            'event_name': 'timecard.forgotten_timer',
            'module': 'timecard',
            'description': 'Alert when a timer has been running for 8+ hours',
            'title_template': 'Forgot to Clock Out?',
            'body_template': '{{work_type_label}} timer still running — {{duration}}',
        },
    ]

    for rule_data in timecard_rules:
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

        # Fuel log improvements: Date → DateTime (preserves existing dates at midnight)
        """DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'fuel_logs' AND column_name = 'date'
                  AND data_type = 'date'
            ) THEN
                ALTER TABLE fuel_logs ALTER COLUMN date TYPE TIMESTAMP USING date::timestamp;
            END IF;
        END $$""",

        # Fuel log improvements: mileage Integer → Float
        """DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'fuel_logs' AND column_name = 'mileage'
                  AND data_type = 'integer'
            ) THEN
                ALTER TABLE fuel_logs ALTER COLUMN mileage TYPE DOUBLE PRECISION USING mileage::double precision;
            END IF;
        END $$""",

        # Vehicle current_mileage Integer → Float
        """DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'vehicles' AND column_name = 'current_mileage'
                  AND data_type = 'integer'
            ) THEN
                ALTER TABLE vehicles ALTER COLUMN current_mileage TYPE DOUBLE PRECISION USING current_mileage::double precision;
            END IF;
        END $$""",

        # Fuel log improvements: add octane_rating column
        """ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS octane_rating INTEGER""",

        # Normalize "mid-grade" → "midgrade" in fuel_type
        """UPDATE fuel_logs SET fuel_type = 'midgrade' WHERE fuel_type = 'mid-grade'""",

        # APNs snooze support: per-rule snooze duration
        """ALTER TABLE notification_rules
           ADD COLUMN IF NOT EXISTS snooze_duration_hours INTEGER""",

        # APNs snooze support: global default snooze duration
        """ALTER TABLE notification_settings
           ADD COLUMN IF NOT EXISTS default_snooze_hours INTEGER DEFAULT 168""",

        # Per-rule push notification toggle (default True for existing rules)
        """ALTER TABLE notification_rules
           ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE""",

        # Vehicle photo upload
        """ALTER TABLE vehicles
           ADD COLUMN IF NOT EXISTS image_filename VARCHAR(255)""",

        # Per-interval push notification toggle (default True for existing intervals)
        """ALTER TABLE vehicle_maintenance_intervals
           ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE""",

        # Push notification delay (minutes before APNs push is delivered)
        """ALTER TABLE notification_settings
           ADD COLUMN IF NOT EXISTS push_delay_minutes INTEGER NOT NULL DEFAULT 5""",

        # Vehicle types & motorcycle mode
        """ALTER TABLE vehicles
           ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(20) NOT NULL DEFAULT 'car'""",
        """ALTER TABLE vehicles
           ADD COLUMN IF NOT EXISTS cylinder_count INTEGER""",
        """ALTER TABLE vehicles
           ADD COLUMN IF NOT EXISTS dual_spark BOOLEAN NOT NULL DEFAULT FALSE""",
        """ALTER TABLE vehicles
           ADD COLUMN IF NOT EXISTS final_drive_type VARCHAR(20)""",

        # Maintenance item vehicle type filter (for motorcycle-specific items)
        """ALTER TABLE maintenance_items
           ADD COLUMN IF NOT EXISTS vehicle_types VARCHAR(100)""",

        # OBD snapshot new sensor columns
        """ALTER TABLE obd_snapshots ADD COLUMN IF NOT EXISTS battery_voltage_v DOUBLE PRECISION""",
        """ALTER TABLE obd_snapshots ADD COLUMN IF NOT EXISTS odometer_km DOUBLE PRECISION""",

        # Timecard: partial unique index for one active timer
        """DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_active_timer'
    ) THEN
        CREATE UNIQUE INDEX idx_one_active_timer ON time_entries ((TRUE)) WHERE end_time IS NULL;
    END IF;
END $$""",

        # Timecard: index on start_time for date-range queries
        """CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries (start_time)""",
    ]

    for sql in migrations:
        try:
            db.session.execute(text(sql))
        except Exception:
            db.session.rollback()
            continue
    db.session.commit()

    # Seed motorcycle-specific maintenance presets (idempotent: skips existing)
    _seed_motorcycle_presets(db)


def _seed_motorcycle_presets(db):
    """Insert motorcycle maintenance presets if they don't already exist."""
    from sqlalchemy import text

    presets = [
        ('Chain Lubrication', 'Drivetrain', 500, 1, 910, 'motorcycle'),
        ('Chain Adjustment', 'Drivetrain', 3000, 6, 920, 'motorcycle'),
        ('Chain Replacement', 'Drivetrain', 20000, 48, 930, 'motorcycle'),
        ('Belt Inspection', 'Drivetrain', 5000, 12, 940, 'motorcycle'),
        ('Belt Replacement', 'Drivetrain', 50000, 60, 950, 'motorcycle'),
        ('Valve Clearance Check', 'Engine', 15000, 24, 960, 'motorcycle'),
        ('Fork Oil Change', 'Suspension', 15000, 24, 970, 'motorcycle'),
        ('Tire Replacement', 'Tires', 10000, 36, 540, 'motorcycle'),
    ]

    for name, category, miles, months, sort_order, vehicle_types in presets:
        try:
            db.session.execute(text("""
                INSERT INTO maintenance_items (name, category, default_miles_interval,
                    default_months_interval, is_preset, sort_order, vehicle_types)
                SELECT :name, :category, :miles, :months, TRUE, :sort_order, :vehicle_types
                WHERE NOT EXISTS (SELECT 1 FROM maintenance_items WHERE name = :name)
            """), {
                'name': name, 'category': category, 'miles': miles,
                'months': months, 'sort_order': sort_order, 'vehicle_types': vehicle_types,
            })
        except Exception:
            db.session.rollback()
            continue
    db.session.commit()
