"""
Astrometrics API Client

Resilient HTTP client for fetching space/astronomy data from external APIs:
  - NASA APOD (Astronomy Picture of the Day)
  - NASA NEO (Near Earth Objects) via NeoWs
  - Open Notify (ISS position, people in space)
  - Launch Library 2 (rocket launches)

Uses requests.Session with urllib3 retry/backoff for automatic retries
on transient failures (429, 500, 502, 503, 504).
"""
import logging
from datetime import datetime, timezone

import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

# Base URLs for external APIs
NASA_API_BASE = 'https://api.nasa.gov'
OPEN_NOTIFY_BASE = 'http://api.open-notify.org'
LAUNCH_LIBRARY_BASE = 'https://ll.thespacedevs.com/2.2.0'


class AstroApiClient:
    """
    HTTP client for all Astrometrics external API calls.

    Features:
      - Automatic retries with exponential backoff (3 retries, 0.5s backoff)
      - 15-second default timeout
      - User-Agent header for API identification
      - All methods return dict or raise with logged error

    Usage:
        client = AstroApiClient(nasa_api_key='DEMO_KEY')
        apod = client.get_apod()
        neo = client.get_neo_feed('2026-02-17', '2026-02-23')
    """

    def __init__(self, nasa_api_key='DEMO_KEY', timeout=15):
        """
        Initialize the API client with retry-configured session.

        Args:
            nasa_api_key: NASA API key (DEMO_KEY has 30 req/hour limit)
            timeout: Default request timeout in seconds
        """
        self.nasa_api_key = nasa_api_key
        self.timeout = timeout

        # Configure retry strategy: retry on common transient errors
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=['GET'],
        )

        self.session = requests.Session()
        self.session.mount('https://', HTTPAdapter(max_retries=retry_strategy))
        self.session.mount('http://', HTTPAdapter(max_retries=retry_strategy))
        self.session.headers.update({
            'User-Agent': 'Datacore/1.0',
            'Accept': 'application/json',
        })

    # ═══════════════════════════════════════════════════════════════
    # NASA APOD (Astronomy Picture of the Day)
    # ═══════════════════════════════════════════════════════════════

    def get_apod(self, date=None):
        """
        Fetch the Astronomy Picture of the Day.

        Args:
            date: Optional date string 'YYYY-MM-DD'. Defaults to today.

        Returns:
            dict with keys: date, title, url, hdurl, media_type, explanation, etc.
        """
        params = {'api_key': self.nasa_api_key}
        if date:
            params['date'] = date

        try:
            resp = self.session.get(
                f'{NASA_API_BASE}/planetary/apod',
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"APOD fetch failed (date={date}): {e}")
            raise

    def get_random_apod(self):
        """
        Fetch a random APOD entry.

        Returns:
            dict: Single APOD entry (NASA returns a list, we take the first)
        """
        params = {
            'api_key': self.nasa_api_key,
            'count': 1,
        }

        try:
            resp = self.session.get(
                f'{NASA_API_BASE}/planetary/apod',
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            # NASA returns a list when using count parameter
            return data[0] if isinstance(data, list) else data
        except requests.RequestException as e:
            logger.error(f"Random APOD fetch failed: {e}")
            raise

    # ═══════════════════════════════════════════════════════════════
    # NASA NeoWs (Near Earth Objects)
    # ═══════════════════════════════════════════════════════════════

    def get_neo_feed(self, start_date, end_date):
        """
        Fetch Near Earth Objects for a date range (max 7 days per NASA API).

        Args:
            start_date: Start date 'YYYY-MM-DD'
            end_date: End date 'YYYY-MM-DD'

        Returns:
            dict with keys: element_count, near_earth_objects (keyed by date)
        """
        params = {
            'api_key': self.nasa_api_key,
            'start_date': start_date,
            'end_date': end_date,
        }

        try:
            resp = self.session.get(
                f'{NASA_API_BASE}/neo/rest/v1/feed',
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"NEO feed fetch failed ({start_date} to {end_date}): {e}")
            raise

    # ═══════════════════════════════════════════════════════════════
    # Open Notify (ISS tracking)
    # ═══════════════════════════════════════════════════════════════

    def get_iss_position(self):
        """
        Fetch the current ISS position (latitude/longitude).

        Returns:
            dict with keys: iss_position (lat, lng), timestamp, message
        """
        try:
            resp = self.session.get(
                f'{OPEN_NOTIFY_BASE}/iss-now.json',
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"ISS position fetch failed: {e}")
            raise

    def get_people_in_space(self):
        """
        Fetch the list of people currently in space using Launch Library 2.

        Uses the astronaut endpoint with in_space=true filter and detailed
        mode to get flight/spacecraft assignment data.  Falls back to Open
        Notify if LL2 fails.

        Returns:
            dict with keys: number (count), people (list of {name, craft})
            Normalised to the same shape regardless of source.
        """
        try:
            resp = self.session.get(
                f'{LAUNCH_LIBRARY_BASE}/astronaut/',
                params={
                    'in_space': 'true',
                    'format': 'json',
                    'mode': 'detailed',
                    'limit': 30,
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()

            # Normalise LL2 response to {number, people: [{name, craft}]}
            people = []
            for astro in data.get('results', []):
                name = astro.get('name', 'Unknown')
                craft = self._extract_craft(astro)
                # Filter out novelty entries (e.g. "Starman" mannequin)
                if astro.get('type', {}).get('name') == 'Non-Human':
                    continue
                people.append({'name': name, 'craft': craft})

            return {
                'number': len(people),
                'people': people,
            }
        except requests.RequestException:
            # Fall back to Open Notify
            logger.warning("LL2 astronaut fetch failed, falling back to Open Notify")
            return self._get_people_open_notify()

    def _extract_craft(self, astro):
        """
        Determine which station/craft an astronaut is currently on
        from their LL2 flight data.

        Checks multiple paths in order of reliability:
          1. landings[].destination (e.g. "International Space Station")
          2. flights[-1].program[].name (e.g. "International Space Station")
          3. Agency-based guess (CNSA → Tiangong, else ISS)
        """
        # 1. Check landings for destination (most recent first)
        landings = astro.get('landings', [])
        for landing in reversed(landings):
            dest = landing.get('destination', '')
            if dest:
                return self._normalize_station_name(dest)

        # 2. Check most recent flight's program names
        flights = astro.get('flights', [])
        if flights:
            latest = flights[-1]
            programs = latest.get('program', [])
            for prog in programs:
                prog_name = prog.get('name', '')
                normalized = self._normalize_station_name(prog_name)
                if normalized != prog_name:
                    # Only use it if we recognized it as a station
                    return normalized

        # 3. Agency-based guess
        agency = astro.get('agency', {}).get('abbrev', '')
        if agency == 'CNSA':
            return 'Tiangong'

        return 'ISS'

    @staticmethod
    def _normalize_station_name(name):
        """Shorten verbose station names for display."""
        if 'International Space Station' in name:
            return 'ISS'
        if 'Tiangong' in name or 'Chinese Space Station' in name:
            return 'Tiangong'
        return name

    def _get_people_open_notify(self):
        """Fallback: fetch crew from Open Notify (may be stale)."""
        try:
            resp = self.session.get(
                f'{OPEN_NOTIFY_BASE}/astros.json',
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"People in space fetch failed (both LL2 and Open Notify): {e}")
            raise

    # ═══════════════════════════════════════════════════════════════
    # Launch Library 2 (rocket launches)
    # ═══════════════════════════════════════════════════════════════

    def get_upcoming_launches(self, limit=10):
        """
        Fetch upcoming rocket launches from all providers.

        Args:
            limit: Maximum number of launches to return (default 10)

        Returns:
            dict with keys: count, results (list of launch objects)
        """
        params = {
            'limit': limit,
            'ordering': 'net',  # Sort by NET (No Earlier Than) date
        }

        try:
            resp = self.session.get(
                f'{LAUNCH_LIBRARY_BASE}/launch/upcoming/',
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"Upcoming launches fetch failed: {e}")
            raise

    def get_past_launches(self, limit=10):
        """
        Fetch recently completed launches.

        Args:
            limit: Maximum number of launches to return (default 10)

        Returns:
            dict with keys: count, results (list of launch objects)
        """
        params = {
            'limit': limit,
            'ordering': '-net',  # Most recent first
        }

        try:
            resp = self.session.get(
                f'{LAUNCH_LIBRARY_BASE}/launch/previous/',
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"Past launches fetch failed: {e}")
            raise

    def get_next_launch(self):
        """
        Fetch the single next upcoming launch.

        Returns:
            dict: Launch object for the next scheduled launch, or None
        """
        try:
            data = self.get_upcoming_launches(limit=1)
            results = data.get('results', [])
            return results[0] if results else None
        except Exception:
            return None
