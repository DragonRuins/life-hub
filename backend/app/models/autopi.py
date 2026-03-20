"""
AutoPi Telemetry Module - Database Models

Tables:
  - autopi_obd_snapshots: Decoded OBD-II / CAN readings (tall/narrow schema)
  - autopi_webhook_logs: Raw webhook delivery log (auto-purged after 30 days)

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


class AutoPiWebhookLog(db.Model):
    """Raw webhook delivery log entry. Auto-purged after 30 days."""
    __tablename__ = 'autopi_webhook_logs'

    id = db.Column(db.Integer, primary_key=True)
    received_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    source_ip = db.Column(db.String(45))
    success = db.Column(db.Boolean, nullable=False, default=True)
    record_count = db.Column(db.Integer, nullable=False, default=0)     # records in payload
    new_count = db.Column(db.Integer, nullable=False, default=0)        # actually new (not dupes)
    position_count = db.Column(db.Integer, nullable=False, default=0)   # track.pos records ingested
    obd_count = db.Column(db.Integer, nullable=False, default=0)        # obd.* records ingested
    event_count = db.Column(db.Integer, nullable=False, default=0)      # event.* records seen
    record_types = db.Column(db.String(500), nullable=True)             # comma-separated @t values
    error_message = db.Column(db.Text, nullable=True)
    raw_payload = db.Column(db.Text, nullable=True)                     # full JSON body (capped)

    def to_dict(self):
        return {
            'id': self.id,
            'received_at': self.received_at.isoformat() + 'Z' if self.received_at else None,
            'source_ip': self.source_ip,
            'success': self.success,
            'record_count': self.record_count,
            'new_count': self.new_count,
            'position_count': self.position_count,
            'obd_count': self.obd_count,
            'event_count': self.event_count,
            'record_types': self.record_types,
            'error_message': self.error_message,
            'raw_payload': self.raw_payload,
        }
