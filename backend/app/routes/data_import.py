"""
Data Import Routes

Provides CSV import endpoints for Fuelly exports:
  - POST /maintenance — Import services.csv as maintenance logs
  - POST /fuel — Import fuelups.csv as fuel logs

Both endpoints accept multipart/form-data with a CSV file and vehicle_id.
Duplicate detection prevents re-importing the same records.
"""
import csv
import io
from datetime import date
from flask import Blueprint, request, jsonify
from app import db
from app.models.vehicle import Vehicle, MaintenanceLog, FuelLog

import_bp = Blueprint('data_import', __name__)


# ── Service Name Mapping ───────────────────────────────────────────
# Maps Fuelly sub_service_types to friendly display names.
# Compound keys (comma-separated) are checked first, then individual terms.

_SERVICE_NAME_MAP = {
    # Compound matches (sorted longest-first so specific combos match before subsets)
    'engine_oil,oil_filter': 'Oil Change',
    'oil_filter,engine_oil': 'Oil Change',
    'tire_a,tire_b,tire_c,tire_d,tire_pressure': 'New Tires',
    'tire_a,tire_b,tire_c,tire_d': 'New Tires',
    # Single matches
    'tire_rotation': 'Tire Rotation',
    'tire_pressure': 'Tire Pressure Check',
    'engine_oil': 'Oil Change',
    'oil_filter': 'Oil Filter',
    'air_filter': 'Air Filter',
    'cabin_air_filter': 'Cabin Air Filter',
    'brake_pads': 'Brake Pads',
    'brake_rotors': 'Brake Rotors',
    'spark_plugs': 'Spark Plugs',
    'battery': 'Battery',
    'wiper_blades': 'Wiper Blades',
    'transmission_fluid': 'Transmission Fluid',
    'coolant': 'Coolant Flush',
    'brake_fluid': 'Brake Fluid',
    'alignment': 'Wheel Alignment',
    'tire_balance': 'Tire Balancing',
}


def _map_service_name(sub_service_types, service_type_col):
    """
    Convert Fuelly sub_service_types string to a friendly service name.

    Args:
        sub_service_types: comma-separated string like "engine_oil,oil_filter"
        service_type_col: the service_type column value ("service" or "expense")

    Returns:
        Human-readable service name string
    """
    if not sub_service_types or not sub_service_types.strip():
        return service_type_col.title() if service_type_col else 'Service'

    raw = sub_service_types.strip()

    # Try exact compound match first (normalized: sorted, stripped)
    parts = [p.strip() for p in raw.split(',') if p.strip()]
    normalized = ','.join(sorted(parts))

    # Check normalized compound key
    for key, name in _SERVICE_NAME_MAP.items():
        key_normalized = ','.join(sorted(k.strip() for k in key.split(',')))
        if normalized == key_normalized:
            return name

    # Try single-part match if only one part
    if len(parts) == 1:
        single = parts[0].lower()
        if single in _SERVICE_NAME_MAP:
            return _SERVICE_NAME_MAP[single]
        # Title-case the raw value as fallback
        return single.replace('_', ' ').title()

    # Multiple parts with no compound match — title-case them
    return ', '.join(p.replace('_', ' ').title() for p in parts)


# ── Maintenance CSV Import ─────────────────────────────────────────

@import_bp.route('/maintenance', methods=['POST'])
def import_maintenance():
    """
    Import maintenance logs from a Fuelly services.csv export.

    Expects multipart/form-data with:
      - file: CSV file
      - vehicle_id: target vehicle ID

    Skips rows where service_type is 'note'.
    Detects duplicates by (vehicle_id, date, mileage, service_type).
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    vehicle_id = request.form.get('vehicle_id')
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400

    vehicle = Vehicle.query.get(int(vehicle_id))
    if not vehicle:
        return jsonify({'error': f'Vehicle {vehicle_id} not found'}), 404

    file = request.files['file']
    try:
        content = file.read().decode('utf-8')
    except UnicodeDecodeError:
        return jsonify({'error': 'File must be UTF-8 encoded CSV'}), 400

    reader = csv.DictReader(io.StringIO(content))

    imported = 0
    skipped = 0
    duplicates = 0
    errors = []

    for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        try:
            # Strip whitespace from keys (Fuelly CSV has leading spaces)
            row = {k.strip(): v.strip() if v else '' for k, v in row.items()}

            svc_type = row.get('service_type', '').lower()

            # Skip notes
            if svc_type == 'note':
                skipped += 1
                continue

            # Parse fields
            service_date = row.get('service_date', '')
            if not service_date:
                errors.append(f"Row {i}: missing service_date")
                continue

            log_date = date.fromisoformat(service_date)
            mileage = int(float(row.get('odometer', '0') or '0'))
            cost = float(row.get('price', '0') or '0')
            sub_types = row.get('sub_service_types', '')
            notes = row.get('notes', '')
            service_name = _map_service_name(sub_types, svc_type)

            # Duplicate check: same vehicle, date, mileage (rounded), and service type
            existing = MaintenanceLog.query.filter_by(
                vehicle_id=int(vehicle_id),
                date=log_date,
                service_type=service_name,
            ).filter(
                db.func.abs(MaintenanceLog.mileage - mileage) < 5
            ).first()

            if existing:
                duplicates += 1
                continue

            log = MaintenanceLog(
                vehicle_id=int(vehicle_id),
                service_type=service_name,
                description=notes if notes else None,
                date=log_date,
                mileage=mileage,
                cost=cost,
            )
            db.session.add(log)
            imported += 1

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            continue

    db.session.commit()

    return jsonify({
        'imported': imported,
        'skipped': skipped,
        'duplicates': duplicates,
        'errors': errors[:10],  # Limit error messages returned
    })


# ── Fuel CSV Import ────────────────────────────────────────────────

@import_bp.route('/fuel', methods=['POST'])
def import_fuel():
    """
    Import fuel logs from a Fuelly fuelups.csv export.

    Expects multipart/form-data with:
      - file: CSV file
      - vehicle_id: target vehicle ID

    Treats both missed_fuelup and partial_fuelup as missed_previous=True.
    Detects duplicates by (vehicle_id, date, mileage).
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    vehicle_id = request.form.get('vehicle_id')
    if not vehicle_id:
        return jsonify({'error': 'vehicle_id is required'}), 400

    vehicle = Vehicle.query.get(int(vehicle_id))
    if not vehicle:
        return jsonify({'error': f'Vehicle {vehicle_id} not found'}), 404

    file = request.files['file']
    try:
        content = file.read().decode('utf-8')
    except UnicodeDecodeError:
        return jsonify({'error': 'File must be UTF-8 encoded CSV'}), 400

    reader = csv.DictReader(io.StringIO(content))

    imported = 0
    duplicates = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            # Strip whitespace from keys
            row = {k.strip(): v.strip() if v else '' for k, v in row.items()}

            fuelup_date = row.get('fuelup_date', '')
            if not fuelup_date:
                errors.append(f"Row {i}: missing fuelup_date")
                continue

            log_date = date.fromisoformat(fuelup_date)
            mileage = int(float(row.get('odometer', '0') or '0'))
            gallons = float(row.get('gallons', '0') or '0')
            cpg = float(row.get('price', '0') or '0')
            mpg = float(row.get('mpg', '0') or '0') or None
            notes = row.get('notes', '') or None
            brand = row.get('brand', '') or None

            # Treat both missed_fuelup and partial_fuelup as missed_previous
            missed = (
                str(row.get('missed_fuelup', '0')) == '1' or
                str(row.get('partial_fuelup', '0')) == '1'
            )

            # If mpg is 0 or missed, null it out (will be recalculated or skipped)
            if missed or (mpg is not None and mpg <= 0):
                mpg = None

            total_cost = round(gallons * cpg, 2)

            # Duplicate check: same vehicle, date, and mileage
            existing = FuelLog.query.filter_by(
                vehicle_id=int(vehicle_id),
                date=log_date,
            ).filter(
                db.func.abs(FuelLog.mileage - mileage) < 5
            ).first()

            if existing:
                duplicates += 1
                continue

            log = FuelLog(
                vehicle_id=int(vehicle_id),
                date=log_date,
                mileage=mileage,
                gallons_added=gallons,
                cost_per_gallon=cpg,
                total_cost=total_cost,
                mpg=mpg,
                missed_previous=missed,
                notes=notes,
                location=brand,  # Use brand as location
            )
            db.session.add(log)
            imported += 1

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
            continue

    db.session.commit()

    return jsonify({
        'imported': imported,
        'duplicates': duplicates,
        'errors': errors[:10],
    })
