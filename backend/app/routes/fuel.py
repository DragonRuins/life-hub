"""
Fuel Economy Module - API Routes

Dedicated endpoints for fuel tracking with API key authentication.
Designed for the Apple Shortcut integration + frontend stats/charts.

Reuses the existing FuelLog model from the vehicles module.
No new database tables needed.

Endpoints:
  POST   /api/fuel/entries              → Add a fuel entry (Apple Shortcut)
  GET    /api/fuel/entries?vehicle_id=X  → List fuel entries for a vehicle
  DELETE /api/fuel/entries/<id>          → Delete a fuel entry
  GET    /api/fuel/stats?vehicle_id=X   → Computed stats for a vehicle
  POST   /api/fuel/import               → Import Fuelly CSV data

The POST /entries endpoint requires an API key via the X-API-Key header
(for the Apple Shortcut). GET and DELETE are open (used by the
frontend on the local network).
"""
import csv
import io
from datetime import date, datetime, timezone
from functools import wraps

from flask import Blueprint, current_app, request, jsonify
from sqlalchemy import func

from app import db
from app.models.vehicle import Vehicle, FuelLog
from app.services.tire_mileage import update_equipped_tire_mileage
from app.services.event_bus import emit

fuel_bp = Blueprint('fuel', __name__)


# ── API Key Authentication ────────────────────────────────────

def require_api_key(f):
    """
    Decorator that checks the X-API-Key header against the
    FUEL_API_KEY config value. Returns 401 if missing or invalid.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = current_app.config.get('FUEL_API_KEY', '')

        # If no API key is configured, reject all requests
        # (forces the user to set one before the endpoint works)
        if not api_key:
            return jsonify({'error': 'API key not configured on server'}), 500

        provided_key = request.headers.get('X-API-Key', '')
        if not provided_key or provided_key != api_key:
            return jsonify({'error': 'Invalid or missing API key'}), 401

        return f(*args, **kwargs)
    return decorated


# ── Fuel Entries ──────────────────────────────────────────────

@fuel_bp.route('/entries', methods=['POST'])
@require_api_key
def create_entry():
    """
    Add a fuel entry. This is the endpoint the Apple Shortcut calls.

    Accepts JSON:
    {
        "vehicle_id": 1,
        "price_per_gallon": 3.299,
        "gallons": 18.5,
        "odometer": 45230,
        "notes": "optional"
    }

    Returns:
    {
        "success": true,
        "entry": { ... }
    }
    """
    # Accept JSON from any content type (Apple Shortcuts may not set
    # Content-Type: application/json). Also fall back to form data.
    data = request.get_json(force=True, silent=True)
    if not data:
        data = request.form.to_dict()
    if not data:
        return jsonify({'error': 'JSON body required'}), 400

    # Validate required fields
    # Accept both underscore and hyphen variants for field names
    # (Apple Shortcuts auto-converts underscores to hyphens in key names)
    vehicle_id = data.get('vehicle_id') or data.get('vehicle-id')
    price_per_gallon = data.get('price_per_gallon') or data.get('price-per-gallon')
    gallons = data.get('gallons')
    odometer = data.get('odometer')

    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400
    if price_per_gallon is None:
        return jsonify({'error': 'price_per_gallon is required'}), 400
    if gallons is None:
        return jsonify({'error': 'gallons is required'}), 400
    if odometer is None:
        return jsonify({'error': 'odometer is required'}), 400

    # Validate types — must be positive numbers
    try:
        price_per_gallon = float(price_per_gallon)
        gallons = float(gallons)
        odometer = float(odometer)
    except (ValueError, TypeError):
        return jsonify({'error': 'price_per_gallon, gallons, and odometer must be numbers'}), 400

    if price_per_gallon <= 0:
        return jsonify({'error': 'price_per_gallon must be positive'}), 400
    if gallons <= 0:
        return jsonify({'error': 'gallons must be positive'}), 400
    if odometer <= 0:
        return jsonify({'error': 'odometer must be positive'}), 400

    # Verify vehicle exists
    vehicle = Vehicle.query.get(vehicle_id)
    if not vehicle:
        return jsonify({'error': f'Vehicle {vehicle_id} not found'}), 404

    # Validate odometer is greater than previous entry
    previous_log = (
        FuelLog.query
        .filter_by(vehicle_id=vehicle_id)
        .order_by(FuelLog.mileage.desc())
        .first()
    )
    if previous_log and odometer <= previous_log.mileage:
        return jsonify({
            'error': f'Odometer ({odometer}) must be greater than previous entry ({previous_log.mileage})'
        }), 400

    # Calculate total cost
    total_cost = round(gallons * price_per_gallon, 2)

    # Check if user flagged a missed fill-up (skip MPG calculation)
    missed_previous = bool(data.get('missed_previous') or data.get('missed-previous'))

    # Calculate MPG from previous entry (skip if missed a fill-up)
    mpg = None
    if previous_log and not missed_previous:
        miles_driven = odometer - previous_log.mileage
        if miles_driven > 0 and gallons > 0:
            mpg = round(miles_driven / gallons, 1)

    # Parse date — accept ISO 8601 datetime or date-only string
    date_str = data.get('date')
    if date_str:
        try:
            entry_date = datetime.fromisoformat(date_str)
        except ValueError:
            entry_date = datetime.now(timezone.utc)
    else:
        entry_date = datetime.now(timezone.utc)

    # Parse optional fuel type and octane rating
    fuel_type = data.get('fuel_type') or data.get('fuel-type')
    octane_rating = data.get('octane_rating') or data.get('octane-rating')
    if octane_rating is not None:
        try:
            octane_rating = int(octane_rating)
        except (ValueError, TypeError):
            octane_rating = None

    # Create the fuel log entry
    log = FuelLog(
        vehicle_id=vehicle_id,
        date=entry_date,
        mileage=odometer,
        gallons_added=gallons,
        cost_per_gallon=price_per_gallon,
        total_cost=total_cost,
        location=data.get('location'),
        fuel_type=fuel_type,
        octane_rating=octane_rating,
        notes=data.get('notes'),
        mpg=mpg,
        missed_previous=missed_previous,
    )
    db.session.add(log)

    # Update equipped tire set and vehicle odometer
    if vehicle.current_mileage is None or odometer > vehicle.current_mileage:
        update_equipped_tire_mileage(vehicle, odometer)
        vehicle.current_mileage = odometer

    db.session.commit()

    # Notify: fuel entry created
    try:
        emit('fuel.created',
             vehicle_id=int(vehicle_id),
             date=log.date.isoformat() if log.date else None,
             mileage=log.mileage,
             gallons=log.gallons_added,
             cost_per_gallon=log.cost_per_gallon,
             total_cost=log.total_cost,
             mpg=log.mpg,
             location='')
    except Exception:
        pass  # Never let notifications break fuel entry creation

    # Check maintenance intervals after mileage update
    try:
        from app.services.interval_checker import check_and_notify_intervals
        check_and_notify_intervals(int(vehicle_id))
    except Exception:
        pass  # Never let interval checks break fuel entry creation

    # Return response in the format the Apple Shortcut expects
    return jsonify({
        'success': True,
        'entry': {
            'id': log.id,
            'vehicle_id': log.vehicle_id,
            'odometer': log.mileage,
            'gallons': log.gallons_added,
            'price_per_gallon': log.cost_per_gallon,
            'total_cost': log.total_cost,
            'mpg': log.mpg,
            'filled_at': log.date.isoformat() if log.date else None,
        }
    }), 201


@fuel_bp.route('/entries', methods=['GET'])
def list_entries():
    """
    List fuel entries for a vehicle, ordered by date descending.
    Requires ?vehicle_id=<id> query parameter.
    """
    vehicle_id = request.args.get('vehicle_id')
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id query parameter is required'}), 400

    Vehicle.query.get_or_404(int(vehicle_id))

    query = FuelLog.query.filter_by(vehicle_id=int(vehicle_id))

    # Optional fuel_type filter
    fuel_type = request.args.get('fuel_type')
    if fuel_type:
        query = query.filter(FuelLog.fuel_type == fuel_type)

    logs = query.order_by(FuelLog.date.desc(), FuelLog.id.desc()).all()
    return jsonify([log.to_dict() for log in logs])


@fuel_bp.route('/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a fuel entry by ID."""
    log = FuelLog.query.get_or_404(entry_id)
    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Fuel entry deleted'}), 200


# ── Fuelly CSV Import ─────────────────────────────────────────

@fuel_bp.route('/import', methods=['POST'])
def import_fuelly_csv():
    """
    Import fuel entries from a Fuelly CSV export.

    Expects multipart form data with:
      - file: the CSV file
      - vehicle_id: which vehicle to import into

    Fuelly CSV columns used:
      mpg, odometer, gallons, price, fuelup_date, notes, brand,
      missed_fuelup, partial_fuelup

    Entries are inserted in chronological order (oldest first).
    Skips rows where odometer <= the previous entry's odometer
    to avoid duplicates if re-importing.
    """
    vehicle_id = request.form.get('vehicle_id')
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400

    vehicle_id = int(vehicle_id)
    vehicle = Vehicle.query.get(vehicle_id)
    if not vehicle:
        return jsonify({'error': f'Vehicle {vehicle_id} not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a .csv'}), 400

    # Read and parse the CSV
    content = file.stream.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))

    # Collect all rows and sort by date ascending (oldest first)
    rows = []
    for row in reader:
        # Strip whitespace from keys (Fuelly CSVs have spaces after commas)
        row = {k.strip(): v.strip() for k, v in row.items()}
        rows.append(row)

    rows.sort(key=lambda r: r.get('fuelup_date', ''))

    # Find the highest existing odometer for this vehicle to skip duplicates
    existing_max = db.session.query(db.func.max(FuelLog.mileage)).filter_by(
        vehicle_id=vehicle_id
    ).scalar() or 0

    imported = 0
    skipped = 0

    for row in rows:
        try:
            odometer = float(row.get('odometer', 0))
            gallons = float(row.get('gallons', 0))
            price = float(row.get('price', 0))
            mpg_val = float(row.get('mpg', 0))
            fuelup_date = row.get('fuelup_date', '')

            # Skip rows with no odometer or gallons
            if odometer <= 0 or gallons <= 0:
                skipped += 1
                continue

            # Skip if this odometer reading already exists (duplicate)
            if odometer <= existing_max:
                skipped += 1
                continue

            # Parse the date
            entry_date = datetime.strptime(fuelup_date, '%Y-%m-%d').date()

            # Calculate total cost
            total_cost = round(gallons * price, 2)

            # Use Fuelly's MPG value (it already calculated it)
            # Set to None if 0 (first fill-up or missed fill-up)
            mpg = round(mpg_val, 1) if mpg_val > 0 else None

            # Build notes from Fuelly data
            notes_parts = []
            if row.get('brand'):
                notes_parts.append(row['brand'])
            if row.get('notes'):
                notes_parts.append(row['notes'])
            if row.get('partial_fuelup') == '1':
                notes_parts.append('Partial fill-up')
            if row.get('missed_fuelup') == '1':
                notes_parts.append('Missed fill-up')
            notes = ', '.join(notes_parts) if notes_parts else None

            log = FuelLog(
                vehicle_id=vehicle_id,
                date=entry_date,
                mileage=int(odometer),
                gallons_added=gallons,
                cost_per_gallon=price,
                total_cost=total_cost,
                mpg=mpg,
                notes=notes,
            )
            db.session.add(log)
            existing_max = odometer
            imported += 1

        except (ValueError, KeyError) as e:
            skipped += 1
            continue

    # Update vehicle mileage to the highest odometer reading
    if imported > 0:
        if vehicle.current_mileage is None or int(existing_max) > vehicle.current_mileage:
            vehicle.current_mileage = int(existing_max)

    db.session.commit()

    return jsonify({
        'success': True,
        'imported': imported,
        'skipped': skipped,
        'message': f'Imported {imported} fuel entries, skipped {skipped}',
    })


# ── Stats ─────────────────────────────────────────────────────

@fuel_bp.route('/stats', methods=['GET'])
def get_stats():
    """
    Computed fuel economy stats for a vehicle.
    Requires ?vehicle_id=<id> query parameter.

    Returns:
    {
        "avg_mpg": 24.5,
        "avg_mpg_last_5": 25.1,
        "total_gallons": 450.2,
        "total_spent": 1523.67,
        "best_mpg": 28.3,
        "worst_mpg": 19.8,
        "avg_cost_per_gallon": 3.384,
        "total_entries": 30
    }
    """
    vehicle_id = request.args.get('vehicle_id')
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id query parameter is required'}), 400

    vehicle_id = int(vehicle_id)
    Vehicle.query.get_or_404(vehicle_id)

    # Optional fuel_type filter
    fuel_type = request.args.get('fuel_type')

    # Build base query with optional fuel type filter
    base_query = FuelLog.query.filter_by(vehicle_id=vehicle_id)
    if fuel_type:
        base_query = base_query.filter(FuelLog.fuel_type == fuel_type)

    # Get all entries with MPG values (excludes first fill-up which has null MPG)
    entries_with_mpg = (
        base_query
        .filter(FuelLog.mpg.isnot(None))
        .order_by(FuelLog.date.desc(), FuelLog.id.desc())
        .all()
    )

    # Get all entries (for total gallons, total cost, etc.)
    all_entries = base_query.all()
    total_entries = len(all_entries)

    if total_entries == 0:
        return jsonify({
            'avg_mpg': None,
            'avg_mpg_last_5': None,
            'total_gallons': 0,
            'total_spent': 0,
            'best_mpg': None,
            'worst_mpg': None,
            'avg_cost_per_gallon': None,
            'total_entries': 0,
        })

    # Calculate aggregate stats
    total_gallons = sum(e.gallons_added or 0 for e in all_entries)
    total_spent = sum(e.total_cost or 0 for e in all_entries)
    avg_cost_per_gallon = round(total_spent / total_gallons, 3) if total_gallons > 0 else None

    # MPG stats (only from entries that have MPG calculated)
    mpg_values = [e.mpg for e in entries_with_mpg]
    avg_mpg = round(sum(mpg_values) / len(mpg_values), 1) if mpg_values else None
    best_mpg = round(max(mpg_values), 1) if mpg_values else None
    worst_mpg = round(min(mpg_values), 1) if mpg_values else None

    # Average MPG of last 5 fill-ups (most recent entries with MPG)
    last_5_mpg = mpg_values[:5]
    avg_mpg_last_5 = round(sum(last_5_mpg) / len(last_5_mpg), 1) if last_5_mpg else None

    return jsonify({
        'avg_mpg': avg_mpg,
        'avg_mpg_last_5': avg_mpg_last_5,
        'total_gallons': round(total_gallons, 1),
        'total_spent': round(total_spent, 2),
        'best_mpg': best_mpg,
        'worst_mpg': worst_mpg,
        'avg_cost_per_gallon': avg_cost_per_gallon,
        'total_entries': total_entries,
    })
