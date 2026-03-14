"""
GPS Tracking Module - Database Models

Two tables:
  - trak4_devices: Mirrors Trak-4 device objects, linked 1:1 to vehicles
  - trak4_gps_reports: Every GPS report ever received, stored permanently

The backend proxies the Trak-4 REST API. The API key is stored as an
env var (TRAK4_API_KEY) and never exposed to the iOS app.
"""
from datetime import datetime, timezone
from app import db


class Trak4Device(db.Model):
    """A Trak-4 GPS tracker device, optionally linked to a vehicle."""
    __tablename__ = 'trak4_devices'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, unique=True, nullable=False)          # Trak-4's DeviceID
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='SET NULL'),
                           nullable=True, unique=True)                       # 1:1 assignment
    key_code = db.Column(db.String(10))                                      # e.g. "VQA-493"
    label = db.Column(db.String(64))                                         # user-customizable
    note = db.Column(db.String(500))                                         # user-customizable
    imei = db.Column(db.String(50))
    firmware = db.Column(db.String(50))
    generation = db.Column(db.Integer)
    product_id = db.Column(db.Integer)
    product_name = db.Column(db.String(255))
    image_url = db.Column(db.String(500))

    # Reporting frequency
    reporting_frequency_id = db.Column(db.Integer)
    reporting_frequency_name = db.Column(db.String(255))
    pending_frequency_id = db.Column(db.Integer)
    pending_frequency_name = db.Column(db.String(255))

    # Last known position (from latest device_list poll)
    last_latitude = db.Column(db.Float)
    last_longitude = db.Column(db.Float)
    last_position_source = db.Column(db.String(10))                          # gps/wifi/cell/bluetooth/none
    last_voltage = db.Column(db.Float)
    last_voltage_percent = db.Column(db.Integer)
    last_report_time = db.Column(db.DateTime)                                # device-side CreateTime
    last_received_time = db.Column(db.DateTime)                              # server-side ReceivedTime

    last_synced_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    # Relationship
    vehicle = db.relationship('Vehicle', backref=db.backref('trak4_device', uselist=False))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'vehicle_id': self.vehicle_id,
            'vehicle_name': self.vehicle.to_dict().get('display_name') if self.vehicle else None,
            'vehicle_type': self.vehicle.vehicle_type if self.vehicle else None,
            'key_code': self.key_code,
            'label': self.label,
            'note': self.note,
            'imei': self.imei,
            'firmware': self.firmware,
            'generation': self.generation,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'image_url': self.image_url,
            'reporting_frequency_id': self.reporting_frequency_id,
            'reporting_frequency_name': self.reporting_frequency_name,
            'pending_frequency_id': self.pending_frequency_id,
            'pending_frequency_name': self.pending_frequency_name,
            'last_latitude': self.last_latitude,
            'last_longitude': self.last_longitude,
            'last_position_source': self.last_position_source,
            'last_voltage': self.last_voltage,
            'last_voltage_percent': self.last_voltage_percent,
            'last_report_time': self.last_report_time.isoformat() + 'Z' if self.last_report_time else None,
            'last_received_time': self.last_received_time.isoformat() + 'Z' if self.last_received_time else None,
            'last_synced_at': self.last_synced_at.isoformat() + 'Z' if self.last_synced_at else None,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }


class Trak4GPSReport(db.Model):
    """A single GPS report from a Trak-4 device. Stored permanently."""
    __tablename__ = 'trak4_gps_reports'
    __table_args__ = (
        db.Index('idx_trak4_reports_device_received', 'device_id', 'received_time'),
    )

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, nullable=False)                        # Trak-4's DeviceID
    report_id = db.Column(db.String(20), unique=True, nullable=False)        # Trak-4's ReportID (dedup)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    heading = db.Column(db.Integer)                                          # degrees, GPS only
    speed = db.Column(db.Integer)                                            # km/h, GPS only
    temperature = db.Column(db.Integer)                                      # Celsius
    voltage = db.Column(db.Float)
    voltage_percent = db.Column(db.Integer)
    hdop = db.Column(db.Float)                                               # GPS signal quality
    rssi = db.Column(db.Integer)                                             # cell signal strength
    accuracy = db.Column(db.Integer)                                         # meters, non-GPS sources
    position_source = db.Column(db.String(10))                               # gps/wifi/cell/bluetooth/none
    device_state = db.Column(db.String(100))                                 # Moving_Charging, etc.
    report_reason = db.Column(db.String(50))                                 # PeriodicReport, etc.
    reporting_frequency = db.Column(db.String(255))
    create_time = db.Column(db.DateTime)                                     # device-side timestamp
    received_time = db.Column(db.DateTime)                                   # server-side timestamp

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'report_id': self.report_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'heading': self.heading,
            'speed': self.speed,
            'temperature': self.temperature,
            'voltage': self.voltage,
            'voltage_percent': self.voltage_percent,
            'hdop': self.hdop,
            'rssi': self.rssi,
            'accuracy': self.accuracy,
            'position_source': self.position_source,
            'device_state': self.device_state,
            'report_reason': self.report_reason,
            'reporting_frequency': self.reporting_frequency,
            'create_time': self.create_time.isoformat() + 'Z' if self.create_time else None,
            'received_time': self.received_time.isoformat() + 'Z' if self.received_time else None,
        }

    def to_route_point(self):
        """Lightweight dict for route polyline rendering (lat/lng/time/speed only)."""
        return {
            'lat': self.latitude,
            'lng': self.longitude,
            'time': self.create_time.isoformat() + 'Z' if self.create_time else None,
            'speed': self.speed,
            'heading': self.heading,
        }
