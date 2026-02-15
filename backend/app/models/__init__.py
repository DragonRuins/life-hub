# Models package - import all models here so they're registered with SQLAlchemy
from .vehicle import Vehicle, MaintenanceLog, VehicleComponent, ComponentLog, TireSet, FuelLog
from .notification import (
    NotificationChannel, NotificationRule, NotificationRuleChannel,
    NotificationLog, NotificationSettings
)
from .maintenance_interval import MaintenanceItem, VehicleMaintenanceInterval, MaintenanceLogItem
