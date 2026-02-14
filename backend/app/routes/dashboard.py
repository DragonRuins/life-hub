"""
Dashboard Module - API Routes

Provides:
  - GET /api/dashboard/weather  → Current weather data
  - GET /api/dashboard/summary  → Quick stats from all modules

The weather endpoint proxies the free Open-Meteo API so the
frontend doesn't need to handle external API calls directly.
Open-Meteo requires no API key, which keeps things simple.
"""
from flask import Blueprint, current_app, jsonify
import requests

from app import db
from app.models.vehicle import Vehicle, MaintenanceLog, FuelLog
from app.models.note import Note

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/weather')
def get_weather():
    """
    Fetch current weather from Open-Meteo (free, no API key needed).
    Uses the lat/lon from your .env config.
    """
    lat = current_app.config['WEATHER_LAT']
    lon = current_app.config['WEATHER_LON']

    try:
        resp = requests.get(
            'https://api.open-meteo.com/v1/forecast',
            params={
                'latitude': lat,
                'longitude': lon,
                'current': 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature',
                'daily': 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
                'temperature_unit': 'fahrenheit',
                'wind_speed_unit': 'mph',
                'timezone': 'America/Chicago',
                'forecast_days': 5,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.RequestException as e:
        return jsonify({'error': f'Weather fetch failed: {str(e)}'}), 502


@dashboard_bp.route('/summary')
def get_summary():
    """
    Quick stats for the dashboard cards.
    Returns counts and recent items from each module.
    """
    # Vehicle stats
    vehicle_count = Vehicle.query.count()
    recent_maintenance = (
        db.session.query(MaintenanceLog)
        .join(Vehicle)
        .order_by(MaintenanceLog.date.desc(), MaintenanceLog.id.desc())
        .limit(5)
        .all()
    )

    # Add vehicle details to each maintenance log
    maintenance_with_vehicle = []
    for log in recent_maintenance:
        log_dict = log.to_dict()
        log_dict['vehicle'] = {
            'id': log.vehicle.id,
            'year': log.vehicle.year,
            'make': log.vehicle.make,
            'model': log.vehicle.model,
        }
        maintenance_with_vehicle.append(log_dict)

    # Fuel log stats
    fuel_log_count = FuelLog.query.count()
    recent_fuel_logs = (
        db.session.query(FuelLog)
        .join(Vehicle)
        .order_by(FuelLog.date.desc(), FuelLog.id.desc())
        .limit(5)
        .all()
    )

    # Add vehicle details to each fuel log
    fuel_logs_with_vehicle = []
    for log in recent_fuel_logs:
        log_dict = log.to_dict()
        log_dict['vehicle'] = {
            'id': log.vehicle.id,
            'year': log.vehicle.year,
            'make': log.vehicle.make,
            'model': log.vehicle.model,
        }
        fuel_logs_with_vehicle.append(log_dict)

    # Notes stats
    note_count = Note.query.count()
    pinned_notes = Note.query.filter_by(is_pinned=True).all()
    recent_notes = (
        Note.query
        .order_by(Note.updated_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        'vehicles': {
            'count': vehicle_count,
            'recent_maintenance': maintenance_with_vehicle,
            'fuel_log_count': fuel_log_count,
            'recent_fuel_logs': fuel_logs_with_vehicle,
        },
        'notes': {
            'count': note_count,
            'pinned': [n.to_dict() for n in pinned_notes],
            'recent': [n.to_dict() for n in recent_notes],
        },
    })
