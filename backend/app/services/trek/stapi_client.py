"""
STAPI (Star Trek API) Client

HTTP client wrapping all STAPI calls with rate limiting, retry logic,
and timeout handling. STAPI is free and open (no API key needed) but
rate-limited to ~1 request per second.

API docs: https://stapi.co/api-documentation

Key patterns:
  - Search: POST /v1/rest/{entity}/search (form-encoded, paginated)
  - Detail: GET /v1/rest/{entity}?uid={uid} (full detail with nested relations)
  - UIDs: 4-letter prefix + 10 digits (e.g., CHMA0000215045)
"""
import logging
import random
import threading
import time

import requests

logger = logging.getLogger(__name__)

STAPI_BASE_URL = 'https://stapi.co/api/v1/rest'
STAPI_V2_BASE_URL = 'https://stapi.co/api/v2/rest'

# Entity types whose v1 detail endpoint is broken (500 error on STAPI's side).
# These use the v2 detail endpoint as a fallback.
V2_DETAIL_ENTITY_TYPES = {'spacecraft'}


class STAPIClient:
    """
    HTTP client for the Star Trek API (stapi.co).

    Rate-limited to 1 request/second via a threading lock + sleep.
    Retries failed requests up to 3 times with exponential backoff.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._last_request_time = 0.0
        self._session = requests.Session()
        self._session.headers.update({
            'User-Agent': 'Datacore/1.0 (Star Trek Database Module)',
            'Accept': 'application/json',
        })

    def _rate_limit(self):
        """Enforce 1 request/second rate limit using a lock."""
        with self._lock:
            now = time.time()
            elapsed = now - self._last_request_time
            if elapsed < 1.0:
                time.sleep(1.0 - elapsed)
            self._last_request_time = time.time()

    def _request_with_retry(self, method, url, max_retries=3, **kwargs):
        """
        Make an HTTP request with exponential backoff retry.

        Args:
            method: 'GET' or 'POST'
            url: Full URL
            max_retries: Number of retries on failure
            **kwargs: Passed to requests (params, data, etc.)

        Returns:
            dict: Parsed JSON response

        Raises:
            requests.RequestException: After all retries exhausted
        """
        kwargs.setdefault('timeout', 10)
        last_error = None

        for attempt in range(max_retries):
            self._rate_limit()
            try:
                if method == 'GET':
                    resp = self._session.get(url, **kwargs)
                else:
                    resp = self._session.post(url, **kwargs)
                resp.raise_for_status()
                return resp.json()
            except requests.RequestException as e:
                last_error = e
                if attempt < max_retries - 1:
                    backoff = 2 ** attempt
                    logger.warning(
                        f"STAPI request failed (attempt {attempt + 1}/{max_retries}): "
                        f"{e}. Retrying in {backoff}s..."
                    )
                    time.sleep(backoff)

        logger.error(f"STAPI request failed after {max_retries} attempts: {last_error}")
        raise last_error

    def search(self, entity_type, params=None, page=0, page_size=50):
        """
        Search for entities via STAPI POST search endpoint.

        Args:
            entity_type: STAPI entity type (e.g., 'character', 'spacecraft')
            params: Dict of search parameters (form-encoded)
            page: Page number (0-indexed)
            page_size: Results per page (max 100)

        Returns:
            dict with keys like 'characters' (list) and 'page' (pagination info)
        """
        url = f"{STAPI_BASE_URL}/{entity_type}/search"
        query_params = {'pageNumber': page, 'pageSize': page_size}
        form_data = params or {}
        return self._request_with_retry('POST', url, params=query_params, data=form_data)

    def get(self, entity_type, uid):
        """
        Get full detail for a single entity.

        Uses v2 API for entity types whose v1 detail endpoint is broken,
        falls back to v1 otherwise.

        Args:
            entity_type: STAPI entity type (e.g., 'character')
            uid: STAPI UID (e.g., 'CHMA0000215045')

        Returns:
            dict with the entity detail (key varies by type, e.g., 'character')
        """
        if entity_type in V2_DETAIL_ENTITY_TYPES:
            url = f"{STAPI_V2_BASE_URL}/{entity_type}"
        else:
            url = f"{STAPI_BASE_URL}/{entity_type}"
        return self._request_with_retry('GET', url, params={'uid': uid})

    def random_entity(self, entity_type):
        """
        Pick a random entity of the given type.

        Strategy: fetch page 0 to get totalPages, pick a random page,
        then pick a random entry from that page.

        Args:
            entity_type: STAPI entity type

        Returns:
            dict: A single entity from the search results, or None
        """
        from .entity_registry import ENTITY_TYPES

        type_config = ENTITY_TYPES.get(entity_type, {})
        stapi_key = type_config.get('stapi_key', f'{entity_type}s')

        # Fetch page 0 to get total page count
        result = self.search(entity_type, page=0, page_size=50)
        page_info = result.get('page', {})
        total_pages = page_info.get('totalPages', 1)

        if total_pages <= 0:
            return None

        # Pick a random page
        random_page = random.randint(0, total_pages - 1)

        if random_page == 0:
            # Reuse the result we already have
            entries = result.get(stapi_key, [])
        else:
            result = self.search(entity_type, page=random_page, page_size=50)
            entries = result.get(stapi_key, [])

        if not entries:
            return None

        return random.choice(entries)

    def check_connectivity(self):
        """
        Lightweight health check — fetch the series list (small dataset).

        Returns:
            dict with 'ok' bool and 'message' string
        """
        try:
            result = self.search('series', page=0, page_size=1)
            total = result.get('page', {}).get('totalElements', 0)
            return {'ok': True, 'message': f'Connected. {total} series available.'}
        except Exception as e:
            return {'ok': False, 'message': str(e)}
