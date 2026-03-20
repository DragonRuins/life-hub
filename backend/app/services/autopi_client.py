"""
AutoPi Cloud API Client

Thin wrapper around the AutoPi REST API (https://api.autopi.io).
Uses APIToken authentication via the AUTOPI_API_TOKEN env var.
The AUTOPI_DEVICE_ID env var identifies the specific AutoPi TMU CM4 device.

This mirrors the pattern established in trak4_client.py but uses
GET/POST with APIToken auth headers instead of API-key-in-body.
"""
import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)

# Timeout for AutoPi API calls (seconds)
_TIMEOUT = 15


def _api_token():
    """Get the AutoPi API token from Flask config."""
    return current_app.config.get('AUTOPI_API_TOKEN', '')


def _device_id():
    """Get the AutoPi device ID from Flask config."""
    return current_app.config.get('AUTOPI_DEVICE_ID', '')


def _base_url():
    """Return the AutoPi Cloud API base URL."""
    return 'https://api.autopi.io'


def _headers():
    """Build request headers with APIToken authorization."""
    return {
        'Authorization': f'APIToken {_api_token()}',
        'Content-Type': 'application/json',
    }


def _get(path, params=None):
    """Make a GET request to the AutoPi API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    resp = requests.get(url, headers=_headers(), params=params, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _post(path, payload=None):
    """Make a POST request to the AutoPi API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    resp = requests.post(url, headers=_headers(), json=payload, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()
