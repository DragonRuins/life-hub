"""
AutoPi Cloud API Discovery Script

Interactive tooling for probing the AutoPi REST API to learn endpoint
response structures. Run these functions from a Flask shell session
to see what data is available before building sync/storage logic.

Usage:
    flask shell
    >>> from app.services.autopi_discovery import *
    >>> discover_device_info()           # List all devices on your account
    >>> discover_device_detail()         # Detail for your configured device
    >>> discover_obd_pids()             # All known OBD-II PIDs
    >>> discover_can_loggers()          # CAN bus logger configurations
    >>> discover_can_channels()         # CAN bus channel definitions
    >>> discover_output_handlers()      # Output handler configs
    >>> discover_position_data()        # Try location/trip endpoints
    >>> discover_storage_data()         # Try alert/query endpoints
    >>> discover_all()                  # Run everything and collect results

Each function pretty-prints the JSON response and returns the raw data,
so you can inspect it further in the REPL (e.g., assign to a variable).
"""
import json
import logging
import traceback

from app.services.autopi_client import _get, _device_id

logger = logging.getLogger(__name__)


def _pretty(label, data):
    """Pretty-print a labeled JSON blob to the console."""
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(json.dumps(data, indent=2, default=str))
    print()


def _try_get(label, path, params=None):
    """
    Attempt a GET request, pretty-print the result or the error.
    Returns the parsed JSON on success, or None on failure.
    """
    try:
        data = _get(path, params=params)
        _pretty(label, data)
        return data
    except Exception as exc:
        print(f"\n[FAIL] {label}")
        print(f"  Path:  {path}")
        print(f"  Error: {exc}")
        traceback.print_exc()
        return None


# ------------------------------------------------------------------
# Discovery functions
# ------------------------------------------------------------------

def discover_device_info():
    """GET /dongle/devices/ -- list all devices on the account."""
    return _try_get("Device List", "/dongle/devices/")


def discover_device_detail(device_id=None):
    """GET /dongle/devices/{id}/ -- full detail for one device."""
    did = device_id or _device_id()
    if not did:
        print("[ERROR] No device_id provided and AUTOPI_DEVICE_ID is not set.")
        return None
    return _try_get(f"Device Detail ({did})", f"/dongle/devices/{did}/")


def discover_position_data(device_id=None):
    """
    Probe multiple potential position/location/trip endpoints.
    We don't know the exact path yet, so try several variations.
    Returns a dict of {endpoint_label: response_or_None}.
    """
    did = device_id or _device_id()
    results = {}

    # Candidate endpoints for position/trip data
    candidates = [
        ("Logbook Trips", "/logbook/trips/", {"device_id": did}),
        ("Logbook Locations", "/logbook/locations/", {"device_id": did}),
        ("Logbook Positions", "/logbook/positions/", {"device_id": did}),
        ("Device Positions", f"/dongle/devices/{did}/positions/", None),
        ("Device Trips", f"/dongle/devices/{did}/trips/", None),
        ("Logbook Trips (no param)", "/logbook/trips/", None),
    ]

    print(f"\n{'#' * 60}")
    print(f"  Probing position/location endpoints (device={did})")
    print(f"{'#' * 60}")

    for label, path, params in candidates:
        data = _try_get(label, path, params=params)
        results[label] = data

    return results


def discover_obd_pids():
    """GET /can_logging/pids/ -- list all known OBD-II PIDs."""
    return _try_get("OBD-II PIDs", "/can_logging/pids/")


def discover_can_loggers():
    """GET /can_logging/loggers/ -- CAN bus logger configurations."""
    return _try_get("CAN Loggers", "/can_logging/loggers/")


def discover_can_channels():
    """GET /can_logging/channels/ -- CAN bus channel definitions."""
    return _try_get("CAN Channels", "/can_logging/channels/")


def discover_storage_data(device_id=None):
    """
    Probe alert and storage/query endpoints.
    Returns a dict of {endpoint_label: response_or_None}.
    """
    did = device_id or _device_id()
    results = {}

    candidates = [
        ("Alerts", "/alert/events/", {"device_id": did}),
        ("Storage List", "/storage/list/", {"device_id": did}),
        ("Storage Query", "/storage/query/", {"device_id": did}),
        ("Device Events", f"/dongle/devices/{did}/events/", None),
    ]

    print(f"\n{'#' * 60}")
    print(f"  Probing storage/alert endpoints (device={did})")
    print(f"{'#' * 60}")

    for label, path, params in candidates:
        data = _try_get(label, path, params=params)
        results[label] = data

    return results


def discover_output_handlers():
    """GET /can_logging/output_handlers/ -- output handler configs."""
    return _try_get("Output Handlers", "/can_logging/output_handlers/")


def discover_all():
    """
    Run every discovery function and collect results into a single dict.
    Useful for a one-shot dump of everything the API exposes.
    """
    print("\n" + "#" * 60)
    print("  AutoPi API Full Discovery")
    print("#" * 60)

    results = {
        "device_info": discover_device_info(),
        "device_detail": discover_device_detail(),
        "obd_pids": discover_obd_pids(),
        "can_loggers": discover_can_loggers(),
        "can_channels": discover_can_channels(),
        "output_handlers": discover_output_handlers(),
        "position_data": discover_position_data(),
        "storage_data": discover_storage_data(),
    }

    # Summary of what worked vs. what failed
    print(f"\n{'=' * 60}")
    print("  Discovery Summary")
    print(f"{'=' * 60}")
    for key, value in results.items():
        if isinstance(value, dict):
            # For multi-endpoint probes, count successes
            hits = sum(1 for v in value.values() if v is not None)
            total = len(value)
            status = f"{hits}/{total} endpoints responded"
        else:
            status = "OK" if value is not None else "FAILED"
        print(f"  {key:25s} {status}")
    print()

    return results
