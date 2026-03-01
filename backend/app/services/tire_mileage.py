"""
Tire Mileage Tracking Service

Updates the accumulated mileage on the currently equipped tire set
whenever a vehicle's odometer increases. Called from any code path
that bumps vehicle.current_mileage (maintenance logs, fuel logs,
direct vehicle edits).
"""
from app import db
from app.models.vehicle import TireSet, VehicleComponent


def update_equipped_tire_mileage(vehicle, new_mileage):
    """
    Add the odometer delta to the currently equipped tire set.

    Args:
        vehicle: The Vehicle ORM object (must still have the OLD
                 current_mileage — call this BEFORE updating it).
        new_mileage: The new odometer reading (int).

    Does NOT update vehicle.current_mileage or commit.
    The caller is responsible for both.
    """
    if new_mileage is None:
        return

    old_mileage = vehicle.current_mileage or 0
    mileage_delta = new_mileage - old_mileage

    if mileage_delta <= 0:
        return

    # Find the active tire/rim component for this vehicle
    equipped_component = VehicleComponent.query.filter(
        VehicleComponent.vehicle_id == vehicle.id,
        VehicleComponent.component_type.in_(['tire', 'rim']),
        VehicleComponent.is_active == True
    ).first()

    if equipped_component and equipped_component.tire_set_id:
        equipped_set = TireSet.query.get(equipped_component.tire_set_id)
        if equipped_set:
            old_accum = equipped_set.accumulated_mileage or 0
            equipped_set.accumulated_mileage = old_accum + mileage_delta
