"""
Star Trek Database Module - API Routes

Provides a comprehensive Star Trek encyclopedia powered by STAPI (stapi.co).
All data is cache-first: fetched from STAPI on demand or via background sync,
then stored in the astro_cache table for fast subsequent reads.

Route groups:
  - /api/trek/daily          Daily entry of the day
  - /api/trek/search         Global search across cached entities
  - /api/trek/browse         Paginated browse + entity detail
  - /api/trek/episodes       Episode guide (series > seasons > episodes)
  - /api/trek/ships          Starship registry
  - /api/trek/favorites      User bookmarks with notes
  - /api/trek/settings       Module configuration
  - /api/trek/status         STAPI health + cache stats
"""
import json
import logging
from datetime import date, datetime, timezone

from flask import Blueprint, jsonify, request

from app import db
from app.models.trek import TrekDailyEntry, TrekFavorite, TrekSettings
from app.services.trek.stapi_client import STAPIClient
from app.services.trek.entity_registry import ENTITY_TYPES, CATEGORIES, get_entity_config
from app.services.astrometrics.cache_manager import AstroCacheManager

logger = logging.getLogger(__name__)

trek_bp = Blueprint('trek', __name__)

# Shared instances (created per-request would be wasteful since
# STAPIClient holds a requests.Session with connection pooling)
_stapi_client = STAPIClient()
_cache_manager = AstroCacheManager()


# ═══════════════════════════════════════════════════════════════════════════
# Daily Entry
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/daily')
def get_daily_entry():
    """
    Get today's Star Trek entry of the day.

    If no entry exists for today, auto-picks one by calling the sync worker.
    Returns the entry with its summary data for card display.
    """
    today = date.today()
    entry = TrekDailyEntry.query.filter_by(entry_date=today).first()

    if not entry:
        # Auto-pick if scheduler hasn't run yet today
        try:
            from app.services.trek.sync_worker import pick_daily_entry_now
            entry = pick_daily_entry_now()
        except Exception as e:
            logger.error(f"Failed to auto-pick daily entry: {e}")
            return jsonify({'error': 'No daily entry available yet'}), 404

    if not entry:
        return jsonify({'error': 'No daily entry available'}), 404

    return jsonify(entry.to_dict())


@trek_bp.route('/daily/history')
def get_daily_history():
    """Get past daily entries. Query param: ?limit=30"""
    limit = request.args.get('limit', 30, type=int)
    entries = (
        TrekDailyEntry.query
        .order_by(TrekDailyEntry.entry_date.desc())
        .limit(limit)
        .all()
    )
    return jsonify([e.to_dict() for e in entries])


@trek_bp.route('/daily/shuffle')
def shuffle_daily_entry():
    """
    Get a random entry (doesn't replace today's pick).
    Returns a random entity from a random category.
    """
    try:
        settings = TrekSettings.get_settings()
        categories = settings.daily_entry_categories or ['character']

        import random
        entity_type = random.choice(categories)
        entity = _stapi_client.random_entity(entity_type)

        if not entity:
            return jsonify({'error': 'Could not fetch random entry'}), 502

        config = get_entity_config(entity_type)
        summary_data = {}
        for field in config.get('summary_fields', []):
            if field in entity:
                summary_data[field] = entity[field]

        return jsonify({
            'entity_type': entity_type,
            'entity_uid': entity.get('uid', ''),
            'entity_name': entity.get('name') or entity.get('title', 'Unknown'),
            'summary_data': summary_data,
        })
    except Exception as e:
        logger.error(f"Shuffle failed: {e}")
        return jsonify({'error': 'Failed to fetch random entry'}), 502


# ═══════════════════════════════════════════════════════════════════════════
# Search (live STAPI)
# ═══════════════════════════════════════════════════════════════════════════

# Entity types to search by default (the most useful/interesting ones)
SEARCH_ENTITY_TYPES = [
    'character', 'spacecraft', 'spacecraftClass', 'species',
    'astronomicalObject', 'episode', 'series', 'organization',
    'technology', 'performer', 'movie', 'location',
]

@trek_bp.route('/search')
def search_entities():
    """
    Search STAPI directly for entities by name. Query params: ?q=picard&type=all

    Queries the STAPI search endpoint with a name filter for each entity type
    (or a specific type if specified). Results are grouped by entity type.
    """
    query = request.args.get('q', '').strip()
    entity_type_filter = request.args.get('type', 'all')

    if not query or len(query) < 2:
        return jsonify({'error': 'Search query must be at least 2 characters'}), 400

    results = {}

    # Determine which entity types to search
    if entity_type_filter != 'all' and entity_type_filter in ENTITY_TYPES:
        types_to_search = [entity_type_filter]
    else:
        types_to_search = SEARCH_ENTITY_TYPES

    for etype in types_to_search:
        config = get_entity_config(etype)
        try:
            # Use STAPI's name filter via the search endpoint
            data = _stapi_client.search(etype, params={'name': query}, page=0, page_size=10)
            entries = data.get(config['stapi_key'], [])

            if entries:
                results[etype] = []
                for entry in entries:
                    name = entry.get('name') or entry.get('title', 'Unknown')
                    results[etype].append({
                        'uid': entry.get('uid', ''),
                        'name': name,
                        'entity_type': etype,
                        'summary_data': {
                            field: entry.get(field)
                            for field in config.get('summary_fields', [])
                            if field in entry
                        },
                    })
        except Exception as e:
            logger.warning(f"Search failed for {etype}: {e}")
            continue

    return jsonify({
        'query': query,
        'results': results,
        'total': sum(len(v) for v in results.values()),
    })


# ═══════════════════════════════════════════════════════════════════════════
# Browse
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/browse/<entity_type>')
def browse_entities(entity_type):
    """
    Paginated browse of an entity type. Cache-first, falls back to STAPI.
    Query params: ?page=0&pageSize=25&name=Enterprise

    When a name filter is provided, it queries STAPI directly (not cached)
    to return filtered results. Without a filter, uses the cache.
    """
    if entity_type not in ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    page = request.args.get('page', 0, type=int)
    page_size = request.args.get('pageSize', 25, type=int)
    name_filter = request.args.get('name', '').strip()
    config = get_entity_config(entity_type)

    try:
        if name_filter:
            # Filtered search — query STAPI directly (no cache, since
            # there are too many possible filter combinations to cache)
            data = _stapi_client.search(
                entity_type,
                params={'name': name_filter},
                page=page,
                page_size=page_size,
            )
            entries = data.get(config['stapi_key'], [])
            page_info = data.get('page', {})
        else:
            # Unfiltered browse — use cache
            settings = TrekSettings.get_settings()
            ttl = settings.cache_ttl_search_hours * 3600

            cache_source = f'stapi_browse_{entity_type}'
            cache_key = f'page_{page}_size_{page_size}'

            result = _cache_manager.get_or_fetch(
                source=cache_source,
                cache_key=cache_key,
                fetch_fn=lambda: _stapi_client.search(entity_type, page=page, page_size=page_size),
                ttl_seconds=ttl,
            )

            data = result.get('data', {})
            entries = data.get(config['stapi_key'], [])
            page_info = data.get('page', {})

        return jsonify({
            'entity_type': entity_type,
            'display_name': config['display_name'],
            'lcars_name': config['lcars_name'],
            'entries': entries,
            'page': page_info,
        })
    except Exception as e:
        logger.error(f"Browse {entity_type} failed: {e}")
        return jsonify({'error': f'Failed to fetch {entity_type} data'}), 502


@trek_bp.route('/browse/<entity_type>/<uid>')
def get_entity_detail(entity_type, uid):
    """
    Get full detail for a single entity. Cache-first.
    Caches under 'stapi_detail_{entity_type}' with the UID as cache_key.
    """
    if entity_type not in ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 400

    config = get_entity_config(entity_type)
    cache_source = f'stapi_detail_{entity_type}'

    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source=cache_source,
            cache_key=uid,
            fetch_fn=lambda: _stapi_client.get(entity_type, uid),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})

        # Check if this entity is favorited
        favorite = TrekFavorite.query.filter_by(
            entity_type=entity_type,
            entity_uid=uid,
        ).first()

        return jsonify({
            'entity_type': entity_type,
            'display_name': config['display_name'],
            'lcars_name': config['lcars_name'],
            'detail_key': config['stapi_detail_key'],
            'data': data,
            'is_favorite': favorite is not None,
            'favorite_id': favorite.id if favorite else None,
            'favorite_notes': favorite.notes if favorite else None,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Detail {entity_type}/{uid} failed: {e}")
        return jsonify({'error': f'Failed to fetch entity detail'}), 502


# ═══════════════════════════════════════════════════════════════════════════
# Episode Guide
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/episodes/series')
def get_all_series():
    """Get all Star Trek series (cached)."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_series',
            cache_key='all',
            fetch_fn=lambda: _stapi_client.search('series', page=0, page_size=100),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        series_list = data.get('series', [])

        return jsonify({
            'series': series_list,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Series fetch failed: {e}")
        return jsonify({'error': 'Failed to fetch series'}), 502


@trek_bp.route('/episodes/series/<uid>/seasons')
def get_series_seasons(uid):
    """Get seasons for a series."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_detail_series',
            cache_key=uid,
            fetch_fn=lambda: _stapi_client.get('series', uid),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        series_data = data.get('series', {})
        seasons = series_data.get('seasons', [])

        return jsonify({
            'series': {
                'uid': series_data.get('uid'),
                'title': series_data.get('title'),
                'abbreviation': series_data.get('abbreviation'),
            },
            'seasons': seasons,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Seasons fetch failed for {uid}: {e}")
        return jsonify({'error': 'Failed to fetch seasons'}), 502


@trek_bp.route('/episodes/season/<uid>')
def get_season_episodes(uid):
    """Get episodes in a season."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_detail_season',
            cache_key=uid,
            fetch_fn=lambda: _stapi_client.get('season', uid),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        season_data = data.get('season', {})
        episodes = season_data.get('episodes', [])

        return jsonify({
            'season': {
                'uid': season_data.get('uid'),
                'title': season_data.get('title'),
                'seasonNumber': season_data.get('seasonNumber'),
            },
            'episodes': episodes,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Episodes fetch for season {uid} failed: {e}")
        return jsonify({'error': 'Failed to fetch episodes'}), 502


@trek_bp.route('/episodes/on-this-day')
def on_this_day():
    """
    Find episodes that aired on today's date (any year).

    Uses the pre-fetched episode cache. Falls back to a fresh STAPI
    search if the cache is empty.
    """
    today = date.today()
    month_day = today.strftime('%m-%d')  # e.g., '02-19'

    from app.models.astrometrics import AstroCache

    # Check the pre-fetched episode cache
    matching_episodes = []

    episode_caches = AstroCache.query.filter(
        AstroCache.source == 'stapi_episodes_all'
    ).all()

    for cache_entry in episode_caches:
        data = cache_entry.data
        if not isinstance(data, dict):
            continue
        episodes = data.get('episodes', [])
        for ep in episodes:
            air_date = ep.get('usAirDate', '')
            if air_date and air_date[5:] == month_day:
                matching_episodes.append(ep)

    # Sort by air date
    matching_episodes.sort(key=lambda e: e.get('usAirDate', ''))

    return jsonify({
        'date': today.isoformat(),
        'month_day': month_day,
        'episodes': matching_episodes,
        'count': len(matching_episodes),
    })


# ═══════════════════════════════════════════════════════════════════════════
# Starship Registry
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/ships')
def list_ships():
    """
    List spacecraft. Query params: ?page=0&classUid=X
    """
    page = request.args.get('page', 0, type=int)
    class_uid = request.args.get('classUid')

    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_search_hours * 3600

        cache_key = f'ships_page_{page}'
        if class_uid:
            cache_key += f'_class_{class_uid}'

        params = {}
        if class_uid:
            params['spacecraftClassUid'] = class_uid

        result = _cache_manager.get_or_fetch(
            source='stapi_ships',
            cache_key=cache_key,
            fetch_fn=lambda: _stapi_client.search('spacecraft', params=params, page=page),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        return jsonify({
            'ships': data.get('spacecrafts', []),
            'page': data.get('page', {}),
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Ships list failed: {e}")
        return jsonify({'error': 'Failed to fetch ships'}), 502


@trek_bp.route('/ships/classes')
def list_ship_classes():
    """Get all spacecraft classes."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_search_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_ship_classes',
            cache_key='all',
            fetch_fn=lambda: _stapi_client.search('spacecraftClass', page=0, page_size=100),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        return jsonify({
            'classes': data.get('spacecraftClasses', []),
            'page': data.get('page', {}),
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Ship classes failed: {e}")
        return jsonify({'error': 'Failed to fetch ship classes'}), 502


@trek_bp.route('/ships/<uid>')
def get_ship_detail(uid):
    """Get detail for a single spacecraft."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_detail_spacecraft',
            cache_key=uid,
            fetch_fn=lambda: _stapi_client.get('spacecraft', uid),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        favorite = TrekFavorite.query.filter_by(
            entity_type='spacecraft', entity_uid=uid
        ).first()

        return jsonify({
            'data': data,
            'is_favorite': favorite is not None,
            'favorite_id': favorite.id if favorite else None,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Ship detail {uid} failed: {e}")
        return jsonify({'error': 'Failed to fetch ship detail'}), 502


@trek_bp.route('/ships/classes/<uid>')
def get_ship_class_detail(uid):
    """Get detail for a spacecraft class, including ships of that class."""
    try:
        settings = TrekSettings.get_settings()
        ttl = settings.cache_ttl_detail_hours * 3600

        result = _cache_manager.get_or_fetch(
            source='stapi_detail_spacecraftClass',
            cache_key=uid,
            fetch_fn=lambda: _stapi_client.get('spacecraftClass', uid),
            ttl_seconds=ttl,
        )

        data = result.get('data', {})
        return jsonify({
            'data': data,
            'stale': result.get('stale', False),
        })
    except Exception as e:
        logger.error(f"Ship class detail {uid} failed: {e}")
        return jsonify({'error': 'Failed to fetch ship class detail'}), 502


# ═══════════════════════════════════════════════════════════════════════════
# Favorites
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/favorites')
def list_favorites():
    """List favorites. Query param: ?type=all or ?type=character"""
    type_filter = request.args.get('type', 'all')

    query = TrekFavorite.query.order_by(TrekFavorite.created_at.desc())
    if type_filter != 'all' and type_filter in ENTITY_TYPES:
        query = query.filter_by(entity_type=type_filter)

    favorites = query.all()
    return jsonify([f.to_dict() for f in favorites])


@trek_bp.route('/favorites', methods=['POST'])
def add_favorite():
    """Add a favorite. Body: {entity_type, entity_uid, entity_name, summary_data?, notes?}"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    entity_type = data.get('entity_type')
    entity_uid = data.get('entity_uid')
    entity_name = data.get('entity_name')

    if not all([entity_type, entity_uid, entity_name]):
        return jsonify({'error': 'entity_type, entity_uid, and entity_name are required'}), 400

    # Check for duplicate
    existing = TrekFavorite.query.filter_by(
        entity_type=entity_type,
        entity_uid=entity_uid,
    ).first()
    if existing:
        return jsonify({'error': 'Already favorited', 'id': existing.id}), 409

    favorite = TrekFavorite(
        entity_type=entity_type,
        entity_uid=entity_uid,
        entity_name=entity_name,
        summary_data=data.get('summary_data', {}),
        notes=data.get('notes'),
    )
    db.session.add(favorite)
    db.session.commit()

    return jsonify(favorite.to_dict()), 201


@trek_bp.route('/favorites/<int:id>', methods=['PUT'])
def update_favorite(id):
    """Update favorite notes. Body: {notes}"""
    favorite = TrekFavorite.query.get_or_404(id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    if 'notes' in data:
        favorite.notes = data['notes']

    db.session.commit()
    return jsonify(favorite.to_dict())


@trek_bp.route('/favorites/<int:id>', methods=['DELETE'])
def remove_favorite(id):
    """Remove a favorite."""
    favorite = TrekFavorite.query.get_or_404(id)
    db.session.delete(favorite)
    db.session.commit()
    return jsonify({'message': 'Favorite removed'})


# ═══════════════════════════════════════════════════════════════════════════
# Settings
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/settings')
def get_settings():
    """Get current trek module settings."""
    settings = TrekSettings.get_settings()
    return jsonify(settings.to_dict())


@trek_bp.route('/settings', methods=['PUT'])
def update_settings():
    """Update trek module settings."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    settings = TrekSettings.get_settings()

    if 'daily_entry_categories' in data:
        settings.daily_entry_categories = data['daily_entry_categories']
    if 'cache_ttl_detail_hours' in data:
        settings.cache_ttl_detail_hours = data['cache_ttl_detail_hours']
    if 'cache_ttl_search_hours' in data:
        settings.cache_ttl_search_hours = data['cache_ttl_search_hours']

    db.session.commit()
    return jsonify(settings.to_dict())


# ═══════════════════════════════════════════════════════════════════════════
# Status
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/status')
def get_status():
    """
    STAPI health check + cache statistics.
    Shows connectivity status, cache freshness, and entity counts.
    """
    # STAPI connectivity
    connectivity = _stapi_client.check_connectivity()

    # Cache stats for STAPI sources
    all_status = _cache_manager.get_cache_status()
    stapi_status = {
        k: v for k, v in all_status.items()
        if k.startswith('stapi_')
    }

    # Count cached entities
    from app.models.astrometrics import AstroCache
    cached_details = AstroCache.query.filter(
        AstroCache.source.like('stapi_detail_%')
    ).count()

    # Count favorites
    favorites_count = TrekFavorite.query.count()

    # Daily entry info
    today_entry = TrekDailyEntry.query.filter_by(entry_date=date.today()).first()

    return jsonify({
        'stapi': connectivity,
        'cache': stapi_status,
        'stats': {
            'cached_entities': cached_details,
            'favorites': favorites_count,
            'daily_entry': today_entry.entity_name if today_entry else None,
        },
    })


# ═══════════════════════════════════════════════════════════════════════════
# Entity Types / Categories (for frontend)
# ═══════════════════════════════════════════════════════════════════════════

@trek_bp.route('/entity-types')
def get_entity_types():
    """Return the entity type registry for the frontend."""
    return jsonify({
        'entity_types': {
            k: {
                'display_name': v['display_name'],
                'lcars_name': v['lcars_name'],
                'category': v['category'],
            }
            for k, v in ENTITY_TYPES.items()
        },
        'categories': CATEGORIES,
    })
