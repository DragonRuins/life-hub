"""
Star Trek Entity Type Registry

Configuration-driven mapping of all STAPI entity types to their metadata.
This avoids hardcoding entity names throughout the codebase and provides
a single source of truth for display names, LCARS labels, STAPI response
keys, and summary fields.

Used by:
  - Routes: to validate entity types and extract response data
  - Sync worker: to rotate daily entry categories
  - Frontend helpers: mirrored in trekHelpers.js
"""

# ── Entity Types ─────────────────────────────────────────────────────────
#
# Each key is the STAPI entity type name (used in URLs and cache keys).
# Fields:
#   display_name   - Human-readable plural name
#   lcars_name     - LCARS-style uppercase label for the Trek theme
#   category       - Which category group this belongs to
#   stapi_key      - Key in STAPI search response containing the results list
#   stapi_detail_key - Key in STAPI detail response containing the entity
#   summary_fields - Fields to extract for card display / daily entry summary
#   sort_default   - Default sort field

ENTITY_TYPES = {
    'character': {
        'display_name': 'Characters',
        'lcars_name': 'PERSONNEL FILES',
        'category': 'personnel',
        'stapi_key': 'characters',
        'stapi_detail_key': 'character',
        'summary_fields': ['gender', 'yearOfBirth', 'yearOfDeath'],
        'sort_default': 'name',
    },
    'performer': {
        'display_name': 'Performers',
        'lcars_name': 'PERFORMER DATABASE',
        'category': 'production',
        'stapi_key': 'performers',
        'stapi_detail_key': 'performer',
        'summary_fields': ['birthName', 'dateOfBirth', 'placeOfBirth'],
        'sort_default': 'name',
    },
    'staff': {
        'display_name': 'Staff',
        'lcars_name': 'PRODUCTION STAFF',
        'category': 'production',
        'stapi_key': 'staff',
        'stapi_detail_key': 'staff',
        'summary_fields': ['birthName', 'dateOfBirth'],
        'sort_default': 'name',
    },
    'spacecraft': {
        'display_name': 'Spacecraft',
        'lcars_name': 'VESSEL REGISTRY',
        'category': 'starships',
        'stapi_key': 'spacecrafts',
        'stapi_detail_key': 'spacecraft',
        'summary_fields': ['registry', 'status'],
        'sort_default': 'name',
    },
    'spacecraftClass': {
        'display_name': 'Spacecraft Classes',
        'lcars_name': 'VESSEL CLASS DATABASE',
        'category': 'starships',
        'stapi_key': 'spacecraftClasses',
        'stapi_detail_key': 'spacecraftClass',
        'summary_fields': ['numberOfDecks', 'activeFrom', 'activeTo'],
        'sort_default': 'name',
    },
    'species': {
        'display_name': 'Species',
        'lcars_name': 'XENOBIOLOGY DATABASE',
        'category': 'species',
        'stapi_key': 'species',
        'stapi_detail_key': 'species',
        'summary_fields': ['homeworld', 'quadrant'],
        'sort_default': 'name',
    },
    'astronomicalObject': {
        'display_name': 'Astronomical Objects',
        'lcars_name': 'STELLAR CARTOGRAPHY',
        'category': 'worlds',
        'stapi_key': 'astronomicalObjects',
        'stapi_detail_key': 'astronomicalObject',
        'summary_fields': ['astronomicalObjectType'],
        'sort_default': 'name',
    },
    'location': {
        'display_name': 'Locations',
        'lcars_name': 'LOCATION DATABASE',
        'category': 'worlds',
        'stapi_key': 'locations',
        'stapi_detail_key': 'location',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'technology': {
        'display_name': 'Technology',
        'lcars_name': 'TECHNICAL DATABASE',
        'category': 'science',
        'stapi_key': 'technology',
        'stapi_detail_key': 'technology',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'weapon': {
        'display_name': 'Weapons',
        'lcars_name': 'TACTICAL DATABASE',
        'category': 'science',
        'stapi_key': 'weapons',
        'stapi_detail_key': 'weapon',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'material': {
        'display_name': 'Materials',
        'lcars_name': 'MATERIALS DATABASE',
        'category': 'science',
        'stapi_key': 'materials',
        'stapi_detail_key': 'material',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'series': {
        'display_name': 'Series',
        'lcars_name': 'SERIES DATABASE',
        'category': 'media',
        'stapi_key': 'series',
        'stapi_detail_key': 'series',
        'summary_fields': ['abbreviation', 'productionStartYear', 'productionEndYear', 'seasonsCount', 'episodesCount'],
        'sort_default': 'title',
    },
    'season': {
        'display_name': 'Seasons',
        'lcars_name': 'SEASON DATABASE',
        'category': 'media',
        'stapi_key': 'seasons',
        'stapi_detail_key': 'season',
        'summary_fields': ['seasonNumber', 'numberOfEpisodes'],
        'sort_default': 'title',
    },
    'episode': {
        'display_name': 'Episodes',
        'lcars_name': 'EPISODE DATABASE',
        'category': 'media',
        'stapi_key': 'episodes',
        'stapi_detail_key': 'episode',
        'summary_fields': ['seasonNumber', 'episodeNumber', 'stardateFrom', 'stardateTo', 'usAirDate'],
        'sort_default': 'title',
    },
    'movie': {
        'display_name': 'Movies',
        'lcars_name': 'FILM DATABASE',
        'category': 'media',
        'stapi_key': 'movies',
        'stapi_detail_key': 'movie',
        'summary_fields': ['usReleaseDate', 'stardateFrom', 'stardateTo'],
        'sort_default': 'title',
    },
    'organization': {
        'display_name': 'Organizations',
        'lcars_name': 'ORGANIZATIONS DATABASE',
        'category': 'organizations',
        'stapi_key': 'organizations',
        'stapi_detail_key': 'organization',
        'summary_fields': ['government', 'militaryOrganization'],
        'sort_default': 'name',
    },
    'food': {
        'display_name': 'Food & Beverages',
        'lcars_name': 'REPLICATOR DATABASE',
        'category': 'culture',
        'stapi_key': 'foods',
        'stapi_detail_key': 'food',
        'summary_fields': ['earthlyOrigin'],
        'sort_default': 'name',
    },
    'animal': {
        'display_name': 'Animals',
        'lcars_name': 'FAUNA DATABASE',
        'category': 'culture',
        'stapi_key': 'animals',
        'stapi_detail_key': 'animal',
        'summary_fields': ['earthAnimal'],
        'sort_default': 'name',
    },
    'occupation': {
        'display_name': 'Occupations',
        'lcars_name': 'OCCUPATIONS',
        'category': 'culture',
        'stapi_key': 'occupations',
        'stapi_detail_key': 'occupation',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'title': {
        'display_name': 'Titles',
        'lcars_name': 'TITLES & RANKS',
        'category': 'culture',
        'stapi_key': 'titles',
        'stapi_detail_key': 'title',
        'summary_fields': ['militaryRank', 'religiousTitle'],
        'sort_default': 'name',
    },
    'company': {
        'display_name': 'Companies',
        'lcars_name': 'COMPANIES',
        'category': 'production',
        'stapi_key': 'companies',
        'stapi_detail_key': 'company',
        'summary_fields': [],
        'sort_default': 'name',
    },
    'book': {
        'display_name': 'Books',
        'lcars_name': 'PUBLICATIONS',
        'category': 'production',
        'stapi_key': 'books',
        'stapi_detail_key': 'book',
        'summary_fields': ['publishedYear', 'numberOfPages'],
        'sort_default': 'title',
    },
    'comicSeries': {
        'display_name': 'Comic Series',
        'lcars_name': 'COMIC SERIES',
        'category': 'production',
        'stapi_key': 'comicSeries',
        'stapi_detail_key': 'comicSeries',
        'summary_fields': ['publishedYearFrom', 'publishedYearTo'],
        'sort_default': 'title',
    },
    'videoGame': {
        'display_name': 'Video Games',
        'lcars_name': 'VIDEO GAMES',
        'category': 'production',
        'stapi_key': 'videoGames',
        'stapi_detail_key': 'videoGame',
        'summary_fields': ['releaseDate'],
        'sort_default': 'title',
    },
    'soundtrack': {
        'display_name': 'Soundtracks',
        'lcars_name': 'AUDIO DATABASE',
        'category': 'production',
        'stapi_key': 'soundtracks',
        'stapi_detail_key': 'soundtrack',
        'summary_fields': ['releaseDate'],
        'sort_default': 'title',
    },
}


# ── Categories ───────────────────────────────────────────────────────────
#
# Groups of entity types for the browse UI. Each category gets a section
# on the landing page and a filter option in search results.

CATEGORIES = {
    'personnel': {
        'label': 'Personnel',
        'lcars_label': 'PERSONNEL DATABASE',
        'types': ['character', 'performer'],
    },
    'starships': {
        'label': 'Starships',
        'lcars_label': 'VESSEL REGISTRY',
        'types': ['spacecraft', 'spacecraftClass'],
    },
    'species': {
        'label': 'Species & Cultures',
        'lcars_label': 'XENOBIOLOGY',
        'types': ['species'],
    },
    'worlds': {
        'label': 'Worlds & Places',
        'lcars_label': 'STELLAR CARTOGRAPHY',
        'types': ['astronomicalObject', 'location'],
    },
    'science': {
        'label': 'Science & Tech',
        'lcars_label': 'TECHNICAL DATABASE',
        'types': ['technology', 'weapon', 'material'],
    },
    'media': {
        'label': 'Series & Episodes',
        'lcars_label': 'MEDIA DATABASE',
        'types': ['series', 'season', 'episode', 'movie'],
    },
    'production': {
        'label': 'Production',
        'lcars_label': 'PRODUCTION FILES',
        'types': ['performer', 'staff', 'company', 'book', 'comicSeries', 'videoGame', 'soundtrack'],
    },
    'organizations': {
        'label': 'Organizations',
        'lcars_label': 'ORGANIZATIONS',
        'types': ['organization'],
    },
    'culture': {
        'label': 'Culture',
        'lcars_label': 'CULTURAL DATABASE',
        'types': ['food', 'animal', 'occupation', 'title'],
    },
}


def get_entity_config(entity_type):
    """
    Get configuration for an entity type, with safe defaults.

    Args:
        entity_type: STAPI entity type string

    Returns:
        dict: Entity type configuration
    """
    return ENTITY_TYPES.get(entity_type, {
        'display_name': entity_type.replace('_', ' ').title(),
        'lcars_name': entity_type.upper(),
        'category': 'other',
        'stapi_key': f'{entity_type}s',
        'stapi_detail_key': entity_type,
        'summary_fields': [],
        'sort_default': 'name',
    })
