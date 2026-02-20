"""
ISS Visible Pass Predictions

Uses the Skyfield astronomy library to calculate when the International
Space Station will be visible from a given location on Earth.

A pass is "visible" when three conditions are met simultaneously:
  1. The ISS is above the observer's horizon
  2. The observer is in twilight or darkness (Sun below -6 deg)
  3. The ISS is illuminated by the Sun (not in Earth's shadow)

This module downloads the ISS TLE (Two-Line Element set) from CelesTrak
and uses Skyfield's satellite propagation to predict pass events.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# CelesTrak URL for ISS TLE data
ISS_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'


def get_visible_passes(lat, lng, days_ahead=7):
    """
    Calculate visible ISS passes for a location.

    Args:
        lat: Observer latitude (decimal degrees, positive = North)
        lng: Observer longitude (decimal degrees, positive = East)
        days_ahead: How many days ahead to predict (default 7)

    Returns:
        list of dicts, each with:
          - rise_time: ISO timestamp when ISS rises above horizon
          - peak_time: ISO timestamp of highest elevation
          - set_time: ISO timestamp when ISS sets below horizon
          - peak_elevation: Maximum elevation in degrees
          - rise_azimuth: Compass direction at rise (e.g., "NW")
          - set_azimuth: Compass direction at set (e.g., "SE")
          - duration_seconds: Total pass duration
          - is_visible: Whether the pass meets visibility criteria

    Returns empty list if Skyfield or TLE data is unavailable.
    """
    try:
        from skyfield.api import load, wgs84, EarthSatellite
        from skyfield.api import Topos
    except ImportError:
        logger.error("Skyfield not installed — ISS pass predictions unavailable")
        return []

    if lat == 0.0 and lng == 0.0:
        logger.warning("Home location not configured (0,0) — skipping ISS pass predictions")
        return []

    try:
        # Load timescale and ISS TLE
        ts = load.timescale()
        tle_lines = _fetch_iss_tle()
        if not tle_lines:
            return []

        satellite = EarthSatellite(tle_lines[1], tle_lines[2], tle_lines[0], ts)
        observer = wgs84.latlon(lat, lng)

        # Time range for prediction
        t0 = ts.now()
        t1 = ts.utc(t0.utc_datetime() + timedelta(days=days_ahead))

        # Find all events (rise, culmination, set)
        t_events, events = satellite.find_events(observer, t0, t1, altitude_degrees=10.0)

        if len(t_events) == 0:
            return []

        passes = []
        current_pass = {}

        for ti, event in zip(t_events, events):
            if event == 0:  # Rise
                current_pass = {
                    'rise_time': ti.utc_iso(),
                    'rise_t': ti,
                }
            elif event == 1:  # Culmination (peak)
                if current_pass:
                    # Calculate peak elevation
                    diff = satellite - observer
                    topocentric = diff.at(ti)
                    alt, az, _ = topocentric.altaz()
                    current_pass['peak_time'] = ti.utc_iso()
                    current_pass['peak_elevation'] = round(alt.degrees, 1)
                    current_pass['peak_azimuth'] = _degrees_to_compass(az.degrees)
            elif event == 2:  # Set
                if current_pass and 'rise_time' in current_pass:
                    # Calculate set azimuth
                    diff = satellite - observer
                    topocentric = diff.at(ti)
                    _, az, _ = topocentric.altaz()

                    # Calculate rise azimuth
                    if 'rise_t' in current_pass:
                        topocentric_rise = diff.at(current_pass['rise_t'])
                        _, rise_az, _ = topocentric_rise.altaz()
                        current_pass['rise_azimuth'] = _degrees_to_compass(rise_az.degrees)

                    current_pass['set_time'] = ti.utc_iso()
                    current_pass['set_azimuth'] = _degrees_to_compass(az.degrees)

                    # Calculate duration
                    if 'rise_t' in current_pass:
                        rise_dt = current_pass['rise_t'].utc_datetime()
                        set_dt = ti.utc_datetime()
                        current_pass['duration_seconds'] = round((set_dt - rise_dt).total_seconds())

                    # Check visibility (simplified: just check if pass is during night)
                    current_pass['is_visible'] = _check_visibility(
                        satellite, observer, current_pass.get('rise_t'), ti, ts
                    )

                    # Clean up internal fields before adding to results
                    current_pass.pop('rise_t', None)
                    passes.append(current_pass)
                    current_pass = {}

        return passes

    except Exception as e:
        logger.error(f"ISS pass prediction failed: {e}")
        return []


def get_ground_track(minutes=50, step_seconds=30, history_minutes=45):
    """
    Compute the ISS ground track (sub-satellite points) spanning both past
    and future positions so the station appears in the middle of the track.

    Uses Skyfield to propagate the ISS TLE and sample lat/lng positions at
    regular intervals.

    Args:
        minutes: How far ahead to compute (default 45 ~ half orbit)
        step_seconds: Interval between sample points (default 30s)
        history_minutes: How far back to compute (default 45 ~ half orbit)

    Returns:
        dict with:
          - points: list of [lat, lng] pairs (floats), past through future
          - current_index: index of the point closest to "now"
        Or empty dict on failure.
    """
    try:
        from skyfield.api import load, wgs84, EarthSatellite
    except ImportError:
        logger.error("Skyfield not installed — ground track unavailable")
        return {}

    try:
        ts = load.timescale()
        tle_lines = _fetch_iss_tle()
        if not tle_lines:
            return {}

        satellite = EarthSatellite(tle_lines[1], tle_lines[2], tle_lines[0], ts)

        points = []
        now = datetime.now(timezone.utc)

        # Compute backward steps (past track)
        back_steps = (history_minutes * 60) // step_seconds
        # Compute forward steps (future track)
        fwd_steps = (minutes * 60) // step_seconds

        for i in range(-back_steps, fwd_steps + 1):
            dt = now + timedelta(seconds=i * step_seconds)
            t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
            geocentric = satellite.at(t)
            subpoint = wgs84.subpoint(geocentric)
            points.append([
                round(subpoint.latitude.degrees, 4),
                round(subpoint.longitude.degrees, 4),
            ])

        return {
            'points': points,
            'current_index': back_steps,
        }

    except Exception as e:
        logger.error(f"Ground track computation failed: {e}")
        return {}


def _fetch_iss_tle():
    """
    Fetch the current ISS TLE from CelesTrak.

    Returns:
        list of 3 strings [name, line1, line2], or None on failure
    """
    import requests

    try:
        resp = requests.get(ISS_TLE_URL, timeout=10)
        resp.raise_for_status()
        lines = resp.text.strip().split('\n')
        if len(lines) >= 3:
            return [line.strip() for line in lines[:3]]
        return None
    except Exception as e:
        logger.error(f"Failed to fetch ISS TLE: {e}")
        return None


def _degrees_to_compass(degrees):
    """
    Convert azimuth degrees to compass direction.

    Args:
        degrees: Azimuth in degrees (0-360, 0=North)

    Returns:
        str: Compass direction (N, NNE, NE, ENE, E, etc.)
    """
    directions = [
        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
    ]
    index = round(degrees / 22.5) % 16
    return directions[index]


def _check_visibility(satellite, observer, rise_t, set_t, ts):
    """
    Simplified visibility check: verify the pass happens during
    local twilight/night. A full implementation would also check
    if the ISS is sunlit, but this approximation works for most cases.

    Returns True if the pass midpoint is during civil twilight or darker
    (sun below -6 degrees).
    """
    try:
        from skyfield.api import load as sf_load
        from skyfield.almanac import find_discrete, dark_twilight_day

        # Check sun altitude at pass midpoint
        if rise_t and set_t:
            mid_dt = rise_t.utc_datetime() + (set_t.utc_datetime() - rise_t.utc_datetime()) / 2
            mid_t = ts.utc(mid_dt)

            eph = sf_load('de421.bsp')
            sun = eph['sun']
            earth = eph['earth']

            from skyfield.api import wgs84
            obs_pos = earth + wgs84.latlon(observer.latitude.degrees, observer.longitude.degrees)
            sun_apparent = obs_pos.at(mid_t).observe(sun).apparent()
            sun_alt, _, _ = sun_apparent.altaz()

            # Visible if sun is below -6 degrees (civil twilight or darker)
            return sun_alt.degrees < -6.0

        return False
    except Exception:
        # If we can't determine visibility, assume visible
        return True
