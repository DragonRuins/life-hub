"""
Astrometrics API Routes

All endpoints for the space/astronomy data dashboard.
Data is read-only (from external APIs via cache), except for
APOD favorites (user-created) and module settings.

Blueprint prefix: /api/astrometrics
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify, request

from app import db
from app.models.astrometrics import AstroApodFavorite, AstroSettings
from app.services.astrometrics.api_client import AstroApiClient
from app.services.astrometrics.cache_manager import AstroCacheManager

astrometrics_bp = Blueprint('astrometrics', __name__)


def _get_client():
    """Get an AstroApiClient configured with current settings."""
    settings = AstroSettings.get_settings()
    return AstroApiClient(nasa_api_key=settings.nasa_api_key)


def _get_cache():
    """Get a cache manager instance."""
    return AstroCacheManager()


# ═══════════════════════════════════════════════════════════════════
# APOD (Astronomy Picture of the Day)
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/apod', methods=['GET'])
def get_apod():
    """
    Get today's APOD, or a specific date's APOD.

    Query params:
      date (optional): YYYY-MM-DD format. Defaults to today.

    Returns cached data when available, fetches live otherwise.
    """
    date = request.args.get('date')
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    client = _get_client()
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='nasa_apod',
            cache_key=date,
            fetch_fn=lambda: client.get_apod(date),
        )

        # Check if this date is a favorite
        favorite = AstroApodFavorite.query.filter_by(date=date).first()
        result['is_favorite'] = favorite is not None

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch APOD: {str(e)}'}), 502


@astrometrics_bp.route('/apod/random', methods=['GET'])
def get_random_apod():
    """Fetch a random APOD entry. Not cached (always fresh)."""
    client = _get_client()

    try:
        data = client.get_random_apod()

        # Check if this date is a favorite
        favorite = AstroApodFavorite.query.filter_by(date=data.get('date', '')).first()

        return jsonify({
            'data': data,
            'stale': False,
            'is_favorite': favorite is not None,
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch random APOD: {str(e)}'}), 502


@astrometrics_bp.route('/apod/favorites', methods=['GET'])
def list_apod_favorites():
    """List all saved APOD favorites, newest first."""
    favorites = AstroApodFavorite.query.order_by(
        AstroApodFavorite.created_at.desc()
    ).all()
    return jsonify([f.to_dict() for f in favorites])


@astrometrics_bp.route('/apod/favorites', methods=['POST'])
def save_apod_favorite():
    """
    Save an APOD as a favorite.

    Request body: {date, title, url, hdurl, media_type, explanation, thumbnail_url, copyright}
    Returns 409 if already favorited.
    """
    data = request.get_json()
    if not data or not data.get('date'):
        return jsonify({'error': 'Date is required'}), 400

    # Check if already favorited
    existing = AstroApodFavorite.query.filter_by(date=data['date']).first()
    if existing:
        return jsonify({'error': 'Already favorited', 'favorite': existing.to_dict()}), 409

    favorite = AstroApodFavorite(
        date=data['date'],
        title=data.get('title', ''),
        url=data.get('url', ''),
        hdurl=data.get('hdurl'),
        media_type=data.get('media_type', 'image'),
        explanation=data.get('explanation'),
        thumbnail_url=data.get('thumbnail_url'),
        copyright=data.get('copyright'),
    )

    db.session.add(favorite)
    db.session.commit()

    return jsonify(favorite.to_dict()), 201


@astrometrics_bp.route('/apod/favorites/<int:favorite_id>', methods=['DELETE'])
def delete_apod_favorite(favorite_id):
    """Remove an APOD from favorites."""
    favorite = db.session.get(AstroApodFavorite, favorite_id)
    if not favorite:
        return jsonify({'error': 'Favorite not found'}), 404

    db.session.delete(favorite)
    db.session.commit()

    return jsonify({'message': 'Favorite removed'})


# ═══════════════════════════════════════════════════════════════════
# NEO (Near Earth Objects)
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/neo', methods=['GET'])
def get_neo_feed():
    """
    Get Near Earth Objects for this week (or custom range).

    Query params:
      start (optional): Start date YYYY-MM-DD (default: today)
      end (optional): End date YYYY-MM-DD (default: start + 6 days)

    NASA limits the range to 7 days max.
    """
    today = datetime.now(timezone.utc)
    start = request.args.get('start', today.strftime('%Y-%m-%d'))
    end = request.args.get('end', (today + timedelta(days=6)).strftime('%Y-%m-%d'))

    client = _get_client()
    cache = _get_cache()
    cache_key = f"{start}_{end}"

    try:
        result = cache.get_or_fetch(
            source='neo_feed',
            cache_key=cache_key,
            fetch_fn=lambda: client.get_neo_feed(start, end),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch NEO data: {str(e)}'}), 502


@astrometrics_bp.route('/neo/closest', methods=['GET'])
def get_closest_neo():
    """
    Get the closest approaching NEO this week.

    Parses the cached NEO feed and finds the asteroid with the
    smallest miss distance in lunar distances.
    """
    today = datetime.now(timezone.utc)
    start = today.strftime('%Y-%m-%d')
    end = (today + timedelta(days=6)).strftime('%Y-%m-%d')

    client = _get_client()
    cache = _get_cache()
    cache_key = f"{start}_{end}"

    try:
        result = cache.get_or_fetch(
            source='neo_feed',
            cache_key=cache_key,
            fetch_fn=lambda: client.get_neo_feed(start, end),
        )

        neo_data = result.get('data', {})
        closest = _find_closest_neo(neo_data)

        return jsonify({
            'closest': closest,
            'stale': result.get('stale', False),
            'fetched_at': result.get('fetched_at'),
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch closest NEO: {str(e)}'}), 502


@astrometrics_bp.route('/neo/hazardous', methods=['GET'])
def get_hazardous_neos():
    """
    Get only potentially hazardous NEOs this week.

    Filters the cached NEO feed for objects flagged as
    is_potentially_hazardous_asteroid = True.
    """
    today = datetime.now(timezone.utc)
    start = today.strftime('%Y-%m-%d')
    end = (today + timedelta(days=6)).strftime('%Y-%m-%d')

    client = _get_client()
    cache = _get_cache()
    cache_key = f"{start}_{end}"

    try:
        result = cache.get_or_fetch(
            source='neo_feed',
            cache_key=cache_key,
            fetch_fn=lambda: client.get_neo_feed(start, end),
        )

        neo_data = result.get('data', {})
        hazardous = _find_hazardous_neos(neo_data)

        return jsonify({
            'hazardous': hazardous,
            'count': len(hazardous),
            'stale': result.get('stale', False),
            'fetched_at': result.get('fetched_at'),
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch hazardous NEOs: {str(e)}'}), 502


# ═══════════════════════════════════════════════════════════════════
# ISS (International Space Station)
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/iss/position', methods=['GET'])
def get_iss_position():
    """
    Get the current ISS position (latitude/longitude).

    Short TTL (15s) — this endpoint is polled frequently by the frontend.
    """
    client = _get_client()
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='iss_position',
            cache_key='current',
            fetch_fn=lambda: client.get_iss_position(),
            ttl_seconds=15,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch ISS position: {str(e)}'}), 502


@astrometrics_bp.route('/iss/crew', methods=['GET'])
def get_iss_crew():
    """
    Get people currently in space, grouped by craft.

    Returns both the raw data and a grouped-by-craft structure
    for easy frontend rendering.

    Query params:
      refresh (optional): If 'true', bypass cache and fetch fresh data.
    """
    client = _get_client()
    cache = _get_cache()

    force_refresh = request.args.get('refresh', '').lower() == 'true'

    try:
        if force_refresh:
            # Delete stale cache entry so get_or_fetch re-fetches
            from app.models.astrometrics import AstroCache
            AstroCache.query.filter_by(
                source='people_in_space', cache_key='current'
            ).delete()
            db.session.commit()

        result = cache.get_or_fetch(
            source='people_in_space',
            cache_key='current',
            fetch_fn=lambda: client.get_people_in_space(),
        )

        # Group by craft for convenience
        data = result.get('data', {})
        people = data.get('people', [])
        crafts = {}
        for person in people:
            craft = person.get('craft', 'Unknown')
            if craft not in crafts:
                crafts[craft] = []
            crafts[craft].append(person.get('name', 'Unknown'))

        return jsonify({
            'data': data,
            'grouped': crafts,
            'total': data.get('number', len(people)),
            'stale': result.get('stale', False),
            'fetched_at': result.get('fetched_at'),
        })
    except Exception as e:
        return jsonify({'error': f'Failed to fetch crew data: {str(e)}'}), 502


@astrometrics_bp.route('/iss/groundtrack', methods=['GET'])
def get_iss_groundtrack():
    """
    Get the ISS ground track spanning ~45 minutes past and ~90 minutes ahead.

    Returns points (array of [lat, lng] pairs) and current_index (the point
    closest to the station's current position). Cached for 5 minutes.

    Query params:
      minutes (optional): How far ahead (default 90, max 180)
    """
    minutes = min(int(request.args.get('minutes', 50)), 180)
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='iss_groundtrack',
            cache_key=f"track_{minutes}",
            fetch_fn=lambda: _compute_ground_track(minutes),
            ttl_seconds=300,  # 5 minute cache
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to compute ground track: {str(e)}'}), 500


def _compute_ground_track(minutes):
    """Call the ISS ground track computation (past + future)."""
    from app.services.astrometrics.iss_passes import get_ground_track
    result = get_ground_track(minutes=minutes, step_seconds=30, history_minutes=45)
    return result or {'points': [], 'current_index': 0}


@astrometrics_bp.route('/iss/passes', methods=['GET'])
def get_iss_passes():
    """
    Get predicted visible ISS passes for the configured home location.

    Uses Skyfield to calculate pass predictions. Requires home_latitude
    and home_longitude to be configured in settings.

    Query params:
      days (optional): Days ahead to predict (default 7, max 14)
    """
    settings = AstroSettings.get_settings()

    if settings.home_latitude == 0.0 and settings.home_longitude == 0.0:
        return jsonify({
            'passes': [],
            'message': 'Home location not configured. Set latitude/longitude in Astrometrics settings.',
        })

    days = min(int(request.args.get('days', 7)), 14)

    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='iss_passes',
            cache_key=f"{settings.home_latitude}_{settings.home_longitude}_{days}",
            fetch_fn=lambda: _compute_passes(settings, days),
            ttl_seconds=3600,  # Cache for 1 hour
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to compute ISS passes: {str(e)}'}), 500


def _compute_passes(settings, days):
    """Call the ISS pass prediction module."""
    from app.services.astrometrics.iss_passes import get_visible_passes
    passes = get_visible_passes(settings.home_latitude, settings.home_longitude, days_ahead=days)
    return {'passes': passes}


# ═══════════════════════════════════════════════════════════════════
# Launches
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/launches/upcoming', methods=['GET'])
def get_upcoming_launches():
    """
    Get upcoming rocket launches.

    Query params:
      limit (optional): Max results (default 10, max 25)
    """
    limit = min(int(request.args.get('limit', 10)), 25)

    client = _get_client()
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='launches_upcoming',
            cache_key='upcoming',
            fetch_fn=lambda: client.get_upcoming_launches(limit=limit),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch upcoming launches: {str(e)}'}), 502


@astrometrics_bp.route('/launches/past', methods=['GET'])
def get_past_launches():
    """
    Get recently completed launches.

    Query params:
      limit (optional): Max results (default 10, max 25)
    """
    limit = min(int(request.args.get('limit', 10)), 25)

    client = _get_client()
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='launches_past',
            cache_key='past',
            fetch_fn=lambda: client.get_past_launches(limit=limit),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch past launches: {str(e)}'}), 502


@astrometrics_bp.route('/launches/next', methods=['GET'])
def get_next_launch():
    """Get the single next upcoming launch."""
    client = _get_client()
    cache = _get_cache()

    try:
        result = cache.get_or_fetch(
            source='launches_next',
            cache_key='next',
            fetch_fn=lambda: client.get_next_launch(),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Failed to fetch next launch: {str(e)}'}), 502


# ═══════════════════════════════════════════════════════════════════
# Settings
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/settings', methods=['GET'])
def get_settings():
    """Get current Astrometrics module settings."""
    settings = AstroSettings.get_settings()
    return jsonify(settings.to_dict())


@astrometrics_bp.route('/settings', methods=['PUT'])
def update_settings():
    """
    Update Astrometrics module settings.

    Updatable fields: nasa_api_key, home_latitude, home_longitude,
    refresh intervals, notification thresholds.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    settings = AstroSettings.get_settings()

    updatable_fields = (
        'nasa_api_key', 'home_latitude', 'home_longitude',
        'refresh_apod', 'refresh_neo', 'refresh_iss_position',
        'refresh_people_in_space', 'refresh_launches',
        'launch_reminder_hours', 'launch_reminder_minutes_2',
        'neo_close_approach_threshold_ld',
    )

    for field in updatable_fields:
        if field in data:
            setattr(settings, field, data[field])

    db.session.commit()

    return jsonify(settings.to_dict())


# ═══════════════════════════════════════════════════════════════════
# Cache Status
# ═══════════════════════════════════════════════════════════════════

@astrometrics_bp.route('/status', methods=['GET'])
def get_cache_status():
    """Get freshness status for all cached data sources."""
    cache = _get_cache()
    status = cache.get_cache_status()
    return jsonify(status)


# ═══════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════

def _find_closest_neo(neo_data):
    """Find the NEO with the smallest miss distance this week."""
    closest = None
    closest_distance = float('inf')

    for date_str, neos in neo_data.get('near_earth_objects', {}).items():
        for neo in neos:
            for approach in neo.get('close_approach_data', []):
                miss_distance = approach.get('miss_distance', {})
                try:
                    ld = float(miss_distance.get('lunar', '999'))
                except (ValueError, TypeError):
                    continue

                if ld < closest_distance:
                    closest_distance = ld
                    diameter = neo.get('estimated_diameter', {}).get('meters', {})
                    closest = {
                        'name': neo.get('name', 'Unknown'),
                        'id': neo.get('id'),
                        'close_approach_date': approach.get('close_approach_date'),
                        'miss_distance_ld': round(ld, 4),
                        'miss_distance_km': miss_distance.get('kilometers'),
                        'relative_velocity_kps': approach.get('relative_velocity', {}).get('kilometers_per_second'),
                        'estimated_diameter_min_m': diameter.get('estimated_diameter_min'),
                        'estimated_diameter_max_m': diameter.get('estimated_diameter_max'),
                        'is_potentially_hazardous': neo.get('is_potentially_hazardous_asteroid', False),
                        'nasa_jpl_url': neo.get('nasa_jpl_url'),
                    }

    return closest


def _find_hazardous_neos(neo_data):
    """Filter NEO data for potentially hazardous asteroids only."""
    hazardous = []

    for date_str, neos in neo_data.get('near_earth_objects', {}).items():
        for neo in neos:
            if neo.get('is_potentially_hazardous_asteroid', False):
                for approach in neo.get('close_approach_data', []):
                    miss_distance = approach.get('miss_distance', {})
                    diameter = neo.get('estimated_diameter', {}).get('meters', {})
                    try:
                        ld = float(miss_distance.get('lunar', '999'))
                    except (ValueError, TypeError):
                        ld = None

                    hazardous.append({
                        'name': neo.get('name', 'Unknown'),
                        'id': neo.get('id'),
                        'close_approach_date': approach.get('close_approach_date'),
                        'miss_distance_ld': round(ld, 4) if ld else None,
                        'miss_distance_km': miss_distance.get('kilometers'),
                        'relative_velocity_kps': approach.get('relative_velocity', {}).get('kilometers_per_second'),
                        'estimated_diameter_min_m': diameter.get('estimated_diameter_min'),
                        'estimated_diameter_max_m': diameter.get('estimated_diameter_max'),
                        'nasa_jpl_url': neo.get('nasa_jpl_url'),
                    })

    return hazardous
