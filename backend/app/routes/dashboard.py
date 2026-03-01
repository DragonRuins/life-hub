"""
Dashboard Module - API Routes

Provides:
  - GET /api/dashboard/weather       → Current weather data
  - GET /api/dashboard/summary       → Quick stats from all modules
  - GET /api/dashboard/fleet-status  → Aggregated fleet data for LCARS dashboard

The weather endpoint proxies the free Open-Meteo API so the
frontend doesn't need to handle external API calls directly.
Open-Meteo requires no API key, which keeps things simple.
"""
from datetime import date, timedelta

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.orm import joinedload, subqueryload
import requests

from app import db
from app.models.vehicle import Vehicle, MaintenanceLog, FuelLog, VehicleComponent, TireSet
from app.models.maintenance_interval import VehicleMaintenanceInterval
from app.models.note import Note
from app.models.project import Project, ProjectTask
from app.models.kb import KBArticle, KBCategory
from app.models.infrastructure import InfraHost, InfraContainer, InfraService, InfraIncident
from app.models.astrometrics import AstroCache
from app.services.interval_checker import check_interval_status

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/weather')
def get_weather():
    """
    Fetch current weather from Open-Meteo (free, no API key needed).
    Accepts optional ?lat=&lon= query params (e.g. from iOS CoreLocation).
    Falls back to .env config values if not provided.
    """
    lat = request.args.get('lat', current_app.config['WEATHER_LAT'])
    lon = request.args.get('lon', current_app.config['WEATHER_LON'])

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

    Optional query param:
      ?vehicle_id=X  → filter maintenance and fuel logs to a single vehicle
    """
    vehicle_id = request.args.get('vehicle_id', type=int)

    # Find primary vehicle for frontend default
    primary_vehicle = Vehicle.query.filter_by(is_primary=True).first()
    primary_vehicle_id = primary_vehicle.id if primary_vehicle else None

    # Vehicle stats
    vehicle_count = Vehicle.query.count()

    # Build maintenance query with optional vehicle filter
    maint_query = db.session.query(MaintenanceLog).join(Vehicle)
    if vehicle_id:
        maint_query = maint_query.filter(MaintenanceLog.vehicle_id == vehicle_id)
    recent_maintenance = (
        maint_query
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

    # Build fuel log query with optional vehicle filter
    fuel_query = db.session.query(FuelLog).join(Vehicle)
    if vehicle_id:
        fuel_query = fuel_query.filter(FuelLog.vehicle_id == vehicle_id)

    fuel_log_count = fuel_query.count()
    recent_fuel_logs = (
        fuel_query
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

    # Notes stats (exclude trashed notes)
    note_count = Note.query.filter_by(is_trashed=False).count()
    starred_notes = Note.query.filter_by(is_trashed=False, is_starred=True).all()
    recent_notes = (
        Note.query
        .filter_by(is_trashed=False)
        .order_by(Note.updated_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        'primary_vehicle_id': primary_vehicle_id,
        'vehicles': {
            'count': vehicle_count,
            'recent_maintenance': maintenance_with_vehicle,
            'fuel_log_count': fuel_log_count,
            'recent_fuel_logs': fuel_logs_with_vehicle,
        },
        'notes': {
            'count': note_count,
            'starred': [n.to_dict(include_content=False) for n in starred_notes],
            'recent': [n.to_dict(include_content=False) for n in recent_notes],
        },
    })


@dashboard_bp.route('/system-stats')
def get_system_stats():
    """
    Consolidated module counts for the dashboard.
    Returns stats from notes, projects, KB, infrastructure,
    and astrometrics in a single API call.
    """
    today = date.today()

    # ── Notes ────────────────────────────────────────────────────
    note_count = Note.query.filter_by(is_trashed=False).count()
    starred_count = Note.query.filter_by(is_trashed=False, is_starred=True).count()

    # ── Projects ─────────────────────────────────────────────────
    active_projects = Project.query.filter(
        Project.status.in_(['active', 'planning', 'paused'])
    ).count()
    tasks_in_progress = ProjectTask.query.filter(
        ProjectTask.completed_at.is_(None)
    ).count()
    overdue_tasks = ProjectTask.query.filter(
        ProjectTask.due_date < today,
        ProjectTask.completed_at.is_(None)
    ).count()

    # ── Knowledge Base ───────────────────────────────────────────
    kb_total = KBArticle.query.filter_by(is_template=False).count()
    kb_published = KBArticle.query.filter_by(
        is_template=False, status='published'
    ).count()

    # ── Infrastructure ───────────────────────────────────────────
    hosts_count = InfraHost.query.count()
    containers_total = InfraContainer.query.count()
    containers_running = InfraContainer.query.filter_by(status='running').count()
    services_total = InfraService.query.count()
    services_up = InfraService.query.filter_by(status='up').count()
    active_incidents = InfraIncident.query.filter_by(status='active').count()

    # ── Astrometrics (from cache) ────────────────────────────────
    crew_in_space = 0
    next_launch_name = None
    next_launch_time = None

    try:
        crew_cache = AstroCache.query.filter_by(
            source='people_in_space', cache_key='current'
        ).first()
        if crew_cache and crew_cache.data:
            cache_data = crew_cache.data
            if isinstance(cache_data, dict) and 'number' in cache_data:
                crew_in_space = cache_data['number']
    except Exception:
        pass

    try:
        launch_cache = AstroCache.query.filter_by(
            source='launches_next', cache_key='next'
        ).first()
        if launch_cache and launch_cache.data:
            launch_data = launch_cache.data
            if isinstance(launch_data, dict):
                next_launch_name = launch_data.get('name')
                next_launch_time = launch_data.get('net')
    except Exception:
        pass

    # ── Trek Database ────────────────────────────────────────────
    trek_favorites = 0
    trek_daily_name = None
    trek_cached = 0

    try:
        from app.models.trek import TrekFavorite, TrekDailyEntry
        trek_favorites = TrekFavorite.query.count()
        today_entry = TrekDailyEntry.query.filter_by(entry_date=today).first()
        if today_entry:
            trek_daily_name = today_entry.entity_name
        trek_cached = AstroCache.query.filter(
            AstroCache.source.like('stapi_detail_%')
        ).count()
    except Exception:
        pass

    return jsonify({
        'notes': {
            'count': note_count,
            'starred': starred_count,
        },
        'projects': {
            'active': active_projects,
            'tasks_in_progress': tasks_in_progress,
            'overdue': overdue_tasks,
        },
        'kb': {
            'total': kb_total,
            'published': kb_published,
        },
        'infrastructure': {
            'hosts': hosts_count,
            'containers_running': containers_running,
            'containers_total': containers_total,
            'services_up': services_up,
            'services_total': services_total,
            'active_incidents': active_incidents,
        },
        'astrometrics': {
            'crew_in_space': crew_in_space,
            'next_launch_name': next_launch_name,
            'next_launch_time': next_launch_time,
        },
        'trek': {
            'favorites': trek_favorites,
            'daily_entry': trek_daily_name,
            'cached_entities': trek_cached,
        },
    })


@dashboard_bp.route('/fleet-status')
def get_fleet_status():
    """
    Aggregated fleet data for the LCARS dashboard.

    Returns all vehicle-related data in a single call so the frontend
    doesn't need to make N+1 requests per vehicle. Seven sections:
      - interval_alerts: Non-ok maintenance intervals across all vehicles
      - vehicle_summaries: Per-vehicle status readouts
      - fuel_stats: Fleet-wide fuel economy and cost data
      - cost_analysis: 30-day and YTD spending breakdown
      - tire_sets: Currently equipped tire sets
      - active_components: Installed parts (excluding tires/rims)
      - activity_timeline: 15 most recent events across all types

    Optional query param:
      ?vehicle_id=X  → filter all sections to a single vehicle
    """
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    year_start = date(today.year, 1, 1)

    vehicle_id = request.args.get('vehicle_id', type=int)

    # Eager-load all vehicle relationships using subqueryload for collections.
    # joinedload on multiple collections creates a cartesian product that
    # can blow up memory; subqueryload issues separate queries per relationship.
    query = Vehicle.query.options(
        subqueryload(Vehicle.maintenance_intervals).joinedload(VehicleMaintenanceInterval.item),
        subqueryload(Vehicle.tire_sets).subqueryload(TireSet.components),
        subqueryload(Vehicle.components),
        subqueryload(Vehicle.fuel_logs),
        subqueryload(Vehicle.maintenance_logs),
    )
    if vehicle_id:
        query = query.filter(Vehicle.id == vehicle_id)
    vehicles_list = query.all()

    # Severity ranking for sorting alerts and determining worst status
    severity = {'unknown': 0, 'ok': 1, 'due_soon': 2, 'due': 3, 'overdue': 4}

    # ── Section 1: Interval Alerts ──────────────────────────────────────
    # Collect ALL enabled intervals across all vehicles (including ok/unknown)
    # so clients can display full maintenance status lists.
    interval_alerts = []

    # ── Section 2: Vehicle Summaries ────────────────────────────────────
    vehicle_summaries = []

    # Build alerts and summaries in a single pass over vehicles
    for v in vehicles_list:
        vehicle_name = f"{v.year} {v.make} {v.model}"
        current_mileage = v.current_mileage or 0
        worst_status = 'ok'
        interval_counts = {'overdue': 0, 'due': 0, 'due_soon': 0, 'ok': 0, 'unknown': 0}

        for interval in v.maintenance_intervals:
            if not interval.is_enabled:
                continue

            status_info = check_interval_status(interval, current_mileage, today)
            status = status_info['status']
            interval_counts[status] = interval_counts.get(status, 0) + 1

            # Track worst status for this vehicle
            if severity.get(status, 0) > severity.get(worst_status, 0):
                worst_status = status

            # Collect all intervals (including ok/unknown) for full status display
            interval_alerts.append({
                'interval_id': interval.id,
                'item_name': interval.item.name if interval.item else 'Unknown',
                'item_category': interval.item.category if interval.item else 'Other',
                'status': status,
                'miles_remaining': status_info['miles_remaining'],
                'days_remaining': status_info['days_remaining'],
                'percent_miles': status_info['percent_miles'],
                'next_due_mileage': status_info['next_due_mileage'],
                'next_due_date': status_info['next_due_date'],
                'vehicle_id': v.id,
                'vehicle_name': vehicle_name,
            })

        # Get last fuel log MPG and average MPG
        sorted_fuel = sorted(
            v.fuel_logs,
            key=lambda fl: (fl.date or date.min, fl.id),
            reverse=True,
        )
        last_mpg = None
        if sorted_fuel and sorted_fuel[0].mpg is not None:
            last_mpg = round(sorted_fuel[0].mpg, 1)

        valid_mpg_logs = [fl for fl in v.fuel_logs if fl.mpg is not None]
        avg_mpg = None
        if valid_mpg_logs:
            avg_mpg = round(sum(fl.mpg for fl in valid_mpg_logs) / len(valid_mpg_logs), 1)

        # Find equipped tire set
        equipped_tire_set = None
        for ts in v.tire_sets:
            is_equipped = any(
                c.is_active for c in ts.components
                if c.component_type in ('tire', 'rim')
            )
            if is_equipped:
                equipped_tire_set = {
                    'name': ts.name,
                    'tire_brand': ts.tire_brand,
                    'accumulated_mileage': ts.accumulated_mileage or 0,
                    'rated_lifespan': ts.rated_lifespan,
                }
                break

        vehicle_summaries.append({
            'id': v.id,
            'year': v.year,
            'make': v.make,
            'model': v.model,
            'trim': v.trim,
            'current_mileage': current_mileage,
            'worst_status': worst_status,
            'interval_counts': interval_counts,
            'last_mpg': last_mpg,
            'avg_mpg': avg_mpg,
            'equipped_tire_set': equipped_tire_set,
        })

    # Sort alerts: overdue first, then due, then due_soon
    interval_alerts.sort(key=lambda a: -severity.get(a['status'], 0))

    # ── Section 3: Fuel Stats ───────────────────────────────────────────
    all_fuel_logs = []
    for v in vehicles_list:
        all_fuel_logs.extend(v.fuel_logs)

    fuel_30d = [fl for fl in all_fuel_logs if fl.date and fl.date >= thirty_days_ago]
    fuel_ytd = [fl for fl in all_fuel_logs if fl.date and fl.date >= year_start]

    valid_mpg_all = [fl for fl in all_fuel_logs if fl.mpg is not None]
    fleet_avg_mpg = (
        round(sum(fl.mpg for fl in valid_mpg_all) / len(valid_mpg_all), 1)
        if valid_mpg_all else None
    )

    # Sparkline: last 20 fuel entries with MPG, in chronological order
    sparkline_entries = sorted(
        [fl for fl in all_fuel_logs if fl.mpg is not None],
        key=lambda fl: (fl.date or date.min, fl.id),
        reverse=True,
    )[:20]
    sparkline_data = [
        {
            'date': fl.date.isoformat() if fl.date else None,
            'mpg': round(fl.mpg, 1),
            'vehicle_id': fl.vehicle_id,
        }
        for fl in reversed(sparkline_entries)  # Chronological for chart
    ]

    fuel_cost_30d = round(sum(fl.total_cost or 0 for fl in fuel_30d), 2)
    fuel_cost_ytd = round(sum(fl.total_cost or 0 for fl in fuel_ytd), 2)

    fuel_stats = {
        'fleet_avg_mpg': fleet_avg_mpg,
        'total_fuel_cost_30d': fuel_cost_30d,
        'total_fuel_cost_ytd': fuel_cost_ytd,
        'total_gallons_30d': round(sum(fl.gallons_added or 0 for fl in fuel_30d), 1),
        'sparkline_data': sparkline_data,
    }

    # ── Section 4: Cost Analysis ────────────────────────────────────────
    all_maintenance_logs = []
    for v in vehicles_list:
        all_maintenance_logs.extend(v.maintenance_logs)

    maint_30d = [ml for ml in all_maintenance_logs if ml.date and ml.date >= thirty_days_ago]
    maint_ytd = [ml for ml in all_maintenance_logs if ml.date and ml.date >= year_start]

    # Parts cost: components with a purchase_date in range
    all_components = []
    for v in vehicles_list:
        all_components.extend(v.components)

    parts_30d = [
        c for c in all_components
        if c.purchase_date and c.purchase_date >= thirty_days_ago and c.purchase_price
    ]
    parts_ytd = [
        c for c in all_components
        if c.purchase_date and c.purchase_date >= year_start and c.purchase_price
    ]

    maint_cost_30d = round(sum(ml.cost or 0 for ml in maint_30d), 2)
    maint_cost_ytd = round(sum(ml.cost or 0 for ml in maint_ytd), 2)
    parts_cost_30d = round(sum(c.purchase_price for c in parts_30d), 2)
    parts_cost_ytd = round(sum(c.purchase_price for c in parts_ytd), 2)

    cost_analysis = {
        'maintenance_30d': maint_cost_30d,
        'maintenance_ytd': maint_cost_ytd,
        'fuel_30d': fuel_cost_30d,
        'fuel_ytd': fuel_cost_ytd,
        'parts_30d': parts_cost_30d,
        'parts_ytd': parts_cost_ytd,
        'total_30d': round(maint_cost_30d + fuel_cost_30d + parts_cost_30d, 2),
        'total_ytd': round(maint_cost_ytd + fuel_cost_ytd + parts_cost_ytd, 2),
    }

    # ── Section 5: Tire Sets (equipped only) ────────────────────────────
    tire_sets_data = []
    for v in vehicles_list:
        vehicle_name = f"{v.year} {v.make} {v.model}"
        for ts in v.tire_sets:
            is_equipped = any(
                c.is_active for c in ts.components
                if c.component_type in ('tire', 'rim')
            )
            if is_equipped:
                tire_sets_data.append({
                    'id': ts.id,
                    'vehicle_id': v.id,
                    'vehicle_name': vehicle_name,
                    'name': ts.name,
                    'tire_brand': ts.tire_brand,
                    'tire_model': ts.tire_model,
                    'accumulated_mileage': ts.accumulated_mileage or 0,
                    'rated_lifespan': ts.rated_lifespan,
                    'is_current': True,
                })

    # ── Section 6: Active Components (excluding tires/rims) ─────────────
    active_components = []
    for v in vehicles_list:
        vehicle_name = f"{v.year} {v.make} {v.model}"
        for c in v.components:
            if not c.is_active or c.component_type in ('tire', 'rim'):
                continue

            days_since_install = None
            if c.install_date:
                days_since_install = (today - c.install_date).days

            miles_since_install = None
            if c.install_mileage is not None and v.current_mileage is not None:
                miles_since_install = v.current_mileage - c.install_mileage

            active_components.append({
                'id': c.id,
                'vehicle_id': v.id,
                'vehicle_name': vehicle_name,
                'component_type': c.component_type,
                'position': c.position,
                'brand': c.brand,
                'model': c.model,
                'install_date': c.install_date.isoformat() if c.install_date else None,
                'install_mileage': c.install_mileage,
                'days_since_install': days_since_install,
                'miles_since_install': miles_since_install,
            })

    # Sort by days_since_install descending (oldest installs first)
    active_components.sort(key=lambda c: -(c['days_since_install'] or 0))

    # ── Section 7: Activity Timeline ────────────────────────────────────
    # Build a lookup for vehicle names by id
    vehicle_name_map = {v.id: f"{v.year} {v.make} {v.model}" for v in vehicles_list}

    timeline = []

    for ml in all_maintenance_logs:
        subtitle_parts = []
        if ml.cost:
            subtitle_parts.append(f"${ml.cost:.2f}")
        if ml.shop_name:
            subtitle_parts.append(f"at {ml.shop_name}")
        timeline.append({
            'type': 'maintenance',
            'id': ml.id,
            'date': ml.date.isoformat() if ml.date else None,
            'title': ml.service_type or 'Service',
            'subtitle': ' '.join(subtitle_parts) if subtitle_parts else None,
            'vehicle_id': ml.vehicle_id,
            'vehicle_name': vehicle_name_map.get(ml.vehicle_id, 'Unknown'),
        })

    for fl in all_fuel_logs:
        title = f"Fuel - {fl.gallons_added:.1f} gal" if fl.gallons_added else "Fuel"
        subtitle_parts = []
        if fl.total_cost:
            subtitle_parts.append(f"${fl.total_cost:.2f}")
        if fl.mpg:
            subtitle_parts.append(f"@ {fl.mpg:.1f} MPG")
        timeline.append({
            'type': 'fuel',
            'id': fl.id,
            'date': fl.date.isoformat() if fl.date else None,
            'title': title,
            'subtitle': ' '.join(subtitle_parts) if subtitle_parts else None,
            'vehicle_id': fl.vehicle_id,
            'vehicle_name': vehicle_name_map.get(fl.vehicle_id, 'Unknown'),
        })

    # Include recent non-trashed notes in the timeline (only for fleet-wide view)
    recent_notes_for_timeline = []
    if not vehicle_id:
        recent_notes_for_timeline = (
            Note.query
            .filter_by(is_trashed=False)
            .order_by(Note.updated_at.desc())
            .limit(15)
            .all()
        )
    for n in recent_notes_for_timeline:
        note_date = n.updated_at or n.created_at
        # Build subtitle from folder name or first tag
        subtitle = None
        if n.folder and n.folder.name:
            subtitle = n.folder.name
        elif n.tags:
            subtitle = n.tags[0].name
        timeline.append({
            'type': 'note',
            'id': n.id,
            'date': note_date.isoformat() if note_date else None,
            'title': n.title or 'Untitled',
            'subtitle': subtitle,
            'vehicle_id': None,
            'vehicle_name': None,
        })

    # Sort by date descending and take top 15
    timeline.sort(key=lambda e: e['date'] or '', reverse=True)
    timeline = timeline[:15]

    return jsonify({
        'interval_alerts': interval_alerts,
        'vehicle_summaries': vehicle_summaries,
        'fuel_stats': fuel_stats,
        'cost_analysis': cost_analysis,
        'tire_sets': tire_sets_data,
        'active_components': active_components,
        'activity_timeline': timeline,
    })
