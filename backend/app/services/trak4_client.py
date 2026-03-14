"""
Trak-4 API Client

Proxy layer for the Trak-4 GPS Tracking REST API v3.0.1.
All calls include the API key from the TRAK4_API_KEY env var.

API docs: https://api-v3.trak-4.com
All endpoints are POST with JSON bodies containing at minimum {"APIKey": "..."}.
Date range queries for GPS reports are clamped to 24-hour windows by the API.
"""
import logging
import re

import requests
from flask import current_app

logger = logging.getLogger(__name__)

# Timeout for Trak-4 API calls (seconds)
_TIMEOUT = 15


def _api_key():
    """Get the Trak-4 API key from Flask config."""
    return current_app.config.get('TRAK4_API_KEY', '')


def _base_url():
    return current_app.config.get('TRAK4_API_BASE', 'https://api-v3.trak-4.com')


def _post(path, payload=None):
    """Make a POST request to the Trak-4 API. Returns parsed JSON or raises."""
    url = f"{_base_url()}{path}"
    body = {'APIKey': _api_key()}
    if payload:
        body.update(payload)

    resp = requests.post(url, json=body, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


# -- Device Endpoints --------------------------------------------------------

def get_device_list(page=1):
    """Fetch all devices visible to the API key. Returns list of device dicts."""
    data = _post('/device_list', {'Page': page})
    return data.get('Devices', []), data.get('TotalPages', 1)


def get_device(device_id):
    """Fetch a single device by DeviceID."""
    data = _post('/device', {'DeviceID': device_id})
    return data.get('Device')


def set_device_label(device_id, label):
    """Set a device's user-customizable label (max 64 chars)."""
    return _post('/set_device_label', {'DeviceID': device_id, 'Label': label[:64]})


def set_device_note(device_id, note):
    """Set a device's user-customizable note (max 500 chars)."""
    return _post('/set_device_note', {'DeviceID': device_id, 'Note': note[:500]})


# -- GPS Report Endpoints ----------------------------------------------------

def get_gps_reports(device_id, start_dt, end_dt=None):
    """
    Fetch GPS reports for a device within a time range.
    The API clamps to 24-hour windows: if end_dt - start_dt > 24h,
    end_dt is clamped to start_dt + 24h.
    Returns list of GPS report dicts.
    """
    payload = {
        'DeviceID': device_id,
        'DateTime_Start': start_dt.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'FilterByReceivedTime': True,
    }
    if end_dt:
        payload['DateTime_End'] = end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    data = _post('/gps_report_list', payload)
    return data.get('GPS_Reports', [])


# -- Reporting Frequency Endpoints --------------------------------------------

def get_reporting_frequencies(device_id=None):
    """Fetch available reporting frequencies. Optionally filter by device."""
    payload = {}
    if device_id:
        payload['DeviceID'] = device_id
    data = _post('/reporting_frequency_list', payload)
    return data.get('Reporting_Frequencies', [])


def set_reporting_frequency(device_id, frequency_id):
    """Queue a reporting frequency change on the device."""
    return _post('/set_reporting_frequency', {
        'DeviceID': device_id,
        'ReportingFrequencyID': frequency_id,
    })


# -- Device Control Endpoints ------------------------------------------------

def request_update(device_id):
    """Send a signal to the tracker requesting an immediate GPS report."""
    return _post('/request_update', {'DeviceID': device_id})


def test_connection():
    """Test API connectivity. Returns True if the API responds with 'Test Success'."""
    try:
        data = _post('/test')
        return data.get('Message') == 'Test Success'
    except Exception as e:
        logger.error(f"Trak-4 API test failed: {e}")
        return False


# -- Helpers ------------------------------------------------------------------

def parse_reporting_interval_seconds(frequency_name):
    """
    Parse a Trak-4 reporting frequency name into seconds.
    Examples: '1d|10m Premium' -> 600, '1d|1m Elite' -> 60, '4h Standard' -> 14400
    Extracts the shortest interval component.
    Returns 600 (10 min) as a safe default if parsing fails.
    """
    if not frequency_name:
        return 600

    # Look for patterns like "10m", "1h", "4h", "30s", "1d"
    matches = re.findall(r'(\d+)\s*(s|m|h|d)', frequency_name.lower())
    if not matches:
        return 600

    multipliers = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}
    intervals = [int(val) * multipliers.get(unit, 60) for val, unit in matches]

    # Use the smallest interval (the reporting interval, not the sleep interval)
    return min(intervals) if intervals else 600
