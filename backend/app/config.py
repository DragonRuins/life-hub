"""
Configuration for the Datacore application.
Reads from environment variables so we can change settings
without modifying code (important for dev vs production).
"""
import os


class Config:
    # Database connection string - tells SQLAlchemy how to connect to PostgreSQL
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://lifehub:changeme_in_production@localhost:5432/lifehub'
    )
    # Disable a noisy SQLAlchemy feature we don't need
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Secret key for Flask sessions/security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')

    # Weather widget location (defaults to DeMotte, IN)
    WEATHER_LAT = float(os.environ.get('WEATHER_LAT', 41.1964))
    WEATHER_LON = float(os.environ.get('WEATHER_LON', -87.3617))

    # API key for the fuel module (used by Apple Shortcut)
    # Set this in your .env or Docker environment
    FUEL_API_KEY = os.environ.get('FUEL_API_KEY', '')

    # Attachment storage for the notes module
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/app/uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_UPLOAD_SIZE', 50 * 1024 * 1024))  # 50MB default
    ALLOWED_EXTENSIONS = {
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',              # Images
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'csv', # Documents
        'zip', 'tar', 'gz',                                        # Archives
    }
