"""
AutoPi Telemetry Module - OBD Snapshot Model

Stores decoded OBD-II telemetry readings from AutoPi TMU CM4 devices.

Uses a tall/narrow schema (one row per PID per reading) so that new PIDs
appear automatically without any schema migrations.  The AutoPi cloud API
returns OBD data via /logbook/storage/read/ with field names like:
  - obd.bat.voltage  (battery voltage, V)
  - speed             (vehicle speed, mph)
  - coolant_temp      (engine coolant temperature, °F)
  - odometer          (odometer reading)
  - rpm               (engine RPM)
  - fuel_level, engine_load, intake_temp, ambiant_air_temp, etc.
"""
from datetime import datetime
from app import db


class AutoPiOBDSnapshot(db.Model):
    """A single decoded OBD-II PID reading from an AutoPi device."""
    __tablename__ = 'autopi_obd_snapshots'
    __table_args__ = (
        db.Index('idx_autopi_obd_device_pid_time', 'device_id', 'pid_name', 'recorded_at'),
        db.Index('idx_autopi_obd_device_time', 'device_id', 'recorded_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('autopi_devices.id', ondelete='CASCADE'),
                          nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)                       # device-side timestamp
    pid_name = db.Column(db.String(100), nullable=False)                       # e.g. "obd.bat.voltage", "speed", "rpm"
    pid_code = db.Column(db.String(20))                                        # OBD-II PID code if applicable (e.g. "01 0C")
    value = db.Column(db.Float, nullable=False)                                # decoded numeric value
    unit = db.Column(db.String(30))                                            # unit string (e.g. "V", "°F", "RPM", "mph")
    raw_value = db.Column(db.String(200))                                      # original value from API for debugging

    # Relationship
    device = db.relationship('AutoPiDevice', backref=db.backref('obd_snapshots', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'recorded_at': self.recorded_at.isoformat() + 'Z' if self.recorded_at else None,
            'pid_name': self.pid_name,
            'pid_code': self.pid_code,
            'value': self.value,
            'unit': self.unit,
            'raw_value': self.raw_value,
        }
