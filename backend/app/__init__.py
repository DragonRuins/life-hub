"""
Life Hub - Flask Application Factory

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

    from app.routes.fuel import fuel_bp
    app.register_blueprint(fuel_bp, url_prefix='/api/fuel')

    # ── Create database tables ─────────────────────────────────
    # Import all models so SQLAlchemy knows about them,
    # then create any tables that don't exist yet.
    with app.app_context():
        from app.models import vehicle, note  # noqa: F401
        db.create_all()

    # Simple health check endpoint
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'app': 'Life Hub'}

    return app
