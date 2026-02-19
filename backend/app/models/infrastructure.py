"""
Infrastructure Module - Database Models

Defines seven tables for homelab/infrastructure monitoring:
  - infra_hosts: Physical/virtual servers (HexOS, VPS, etc.)
  - infra_network_devices: Routers, switches, APs, etc.
  - infra_containers: Docker containers running on hosts
  - infra_services: Monitored web services/endpoints
  - infra_metrics: Time-series metrics (CPU, RAM, response times, etc.)
  - infra_incidents: Outage/incident tracking
  - infra_integration_configs: Docker/HomeAssistant/Portainer integration settings

SQLAlchemy models map Python classes to database tables.
Each attribute becomes a column. You interact with the database
using Python objects instead of writing raw SQL.
"""
from datetime import datetime, timezone
from app import db


class InfraHost(db.Model):
    """A physical or virtual server/machine in your infrastructure."""
    __tablename__ = 'infra_hosts'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)         # e.g., "HexOS Thinkpad"
    hostname = db.Column(db.String(255))                      # e.g., "hexos.local"
    host_type = db.Column(db.String(50), nullable=False)      # server, vm, vps, raspberry_pi, nas
    ip_address = db.Column(db.String(45))                     # IPv4 or IPv6
    mac_address = db.Column(db.String(17))                    # e.g., "AA:BB:CC:DD:EE:FF"
    os_name = db.Column(db.String(100))                       # e.g., "TrueNAS SCALE"
    os_version = db.Column(db.String(50))                     # e.g., "24.10"
    location = db.Column(db.String(200))                      # e.g., "Office closet"
    status = db.Column(db.String(20), default='unknown')      # online, offline, degraded, unknown
    hardware = db.Column(db.JSON, default=dict)               # {cpu, ram_gb, disk_gb, gpu, etc.}
    tags = db.Column(db.JSON, default=list)                   # ["production", "docker-host"]
    notes = db.Column(db.Text)
    last_seen_at = db.Column(db.DateTime)                     # Updated by integrations
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    containers = db.relationship('InfraContainer', backref='host', cascade='all, delete-orphan')
    network_devices = db.relationship('InfraNetworkDevice', backref='parent_host',
                                      foreign_keys='InfraNetworkDevice.parent_host_id')

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'hostname': self.hostname,
            'host_type': self.host_type,
            'ip_address': self.ip_address,
            'mac_address': self.mac_address,
            'os_name': self.os_name,
            'os_version': self.os_version,
            'location': self.location,
            'status': self.status,
            'hardware': self.hardware or {},
            'tags': self.tags or [],
            'notes': self.notes,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'container_count': len(self.containers),
        }


class InfraNetworkDevice(db.Model):
    """A network device like a router, switch, or access point."""
    __tablename__ = 'infra_network_devices'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)          # e.g., "Main Router"
    device_type = db.Column(db.String(50), nullable=False)    # router, switch, ap, firewall, modem
    ip_address = db.Column(db.String(45))
    mac_address = db.Column(db.String(17))
    manufacturer = db.Column(db.String(100))                  # e.g., "Ubiquiti"
    model = db.Column(db.String(100))                         # e.g., "USW-24-POE"
    firmware_version = db.Column(db.String(50))
    location = db.Column(db.String(200))
    status = db.Column(db.String(20), default='unknown')      # online, offline, unknown
    config = db.Column(db.JSON, default=dict)                 # {vlan, subnet, ports, etc.}
    parent_host_id = db.Column(db.Integer, db.ForeignKey('infra_hosts.id', ondelete='SET NULL'))
    tags = db.Column(db.JSON, default=list)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'device_type': self.device_type,
            'ip_address': self.ip_address,
            'mac_address': self.mac_address,
            'manufacturer': self.manufacturer,
            'model': self.model,
            'firmware_version': self.firmware_version,
            'location': self.location,
            'status': self.status,
            'config': self.config or {},
            'parent_host_id': self.parent_host_id,
            'tags': self.tags or [],
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class InfraContainer(db.Model):
    """A Docker container running on a host."""
    __tablename__ = 'infra_containers'

    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey('infra_hosts.id', ondelete='CASCADE'), nullable=False)
    container_id = db.Column(db.String(64))                   # Docker short ID (12 chars) or full SHA
    name = db.Column(db.String(200), nullable=False)          # Container name
    image = db.Column(db.String(500))                         # e.g., "nginx:latest"
    status = db.Column(db.String(30), default='unknown')      # running, stopped, restarting, exited, unknown
    state = db.Column(db.String(30))                          # Docker state detail
    compose_project = db.Column(db.String(200))               # Docker Compose project name
    compose_service = db.Column(db.String(200))               # Docker Compose service name
    ports = db.Column(db.JSON, default=list)                  # [{host_port, container_port, protocol}]
    volumes = db.Column(db.JSON, default=list)                # [{source, destination, mode}]
    environment = db.Column(db.JSON, default=dict)            # Key environment variables (sanitized)
    extra_data = db.Column(db.JSON, default=dict)              # Labels, extra docker inspect data
    started_at = db.Column(db.DateTime)                       # Container start time
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Unique constraint: one container per host (by Docker container_id)
    __table_args__ = (
        db.UniqueConstraint('host_id', 'container_id', name='uq_infra_containers_host_container'),
        db.Index('idx_infra_containers_host', 'host_id'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'host_id': self.host_id,
            'container_id': self.container_id,
            'name': self.name,
            'image': self.image,
            'status': self.status,
            'state': self.state,
            'compose_project': self.compose_project,
            'compose_service': self.compose_service,
            'ports': self.ports or [],
            'volumes': self.volumes or [],
            'environment': self.environment or {},
            'extra_data': self.extra_data or {},
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class InfraService(db.Model):
    """A monitored web service or endpoint."""
    __tablename__ = 'infra_services'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)          # e.g., "Dockge"
    url = db.Column(db.String(500))                           # Health check URL
    service_type = db.Column(db.String(50), default='http')   # http, tcp, ping, docker
    host_id = db.Column(db.Integer, db.ForeignKey('infra_hosts.id', ondelete='SET NULL'))
    container_id = db.Column(db.Integer, db.ForeignKey('infra_containers.id', ondelete='SET NULL'))
    status = db.Column(db.String(20), default='unknown')      # up, down, degraded, unknown
    is_monitored = db.Column(db.Boolean, default=True)        # Whether uptime checking is enabled
    check_interval_seconds = db.Column(db.Integer, default=300)  # How often to check (default 5 min)
    expected_status = db.Column(db.Integer, default=200)      # Expected HTTP status code
    last_check_at = db.Column(db.DateTime)
    last_response_time_ms = db.Column(db.Integer)             # Last recorded response time
    consecutive_failures = db.Column(db.Integer, default=0)
    tags = db.Column(db.JSON, default=list)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    host = db.relationship('InfraHost', foreign_keys=[host_id])
    container = db.relationship('InfraContainer', foreign_keys=[container_id])

    __table_args__ = (
        db.Index('idx_infra_services_status', 'status'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'service_type': self.service_type,
            'host_id': self.host_id,
            'container_id': self.container_id,
            'status': self.status,
            'is_monitored': self.is_monitored,
            'check_interval_seconds': self.check_interval_seconds,
            'expected_status': self.expected_status,
            'last_check_at': self.last_check_at.isoformat() if self.last_check_at else None,
            'last_response_time_ms': self.last_response_time_ms,
            'consecutive_failures': self.consecutive_failures,
            'tags': self.tags or [],
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class InfraMetric(db.Model):
    """A single time-series metric data point (CPU %, RAM, response time, etc.)."""
    __tablename__ = 'infra_metrics'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)  # BIGSERIAL for high volume
    source_type = db.Column(db.String(30), nullable=False)    # host, container, service, homeassistant
    source_id = db.Column(db.Integer, nullable=False)         # FK to the source record (polymorphic)
    metric_name = db.Column(db.String(100), nullable=False)   # e.g., "cpu_percent", "ram_percent"
    value = db.Column(db.Float, nullable=False)               # The metric value
    unit = db.Column(db.String(20))                           # %, MB, ms, etc.
    tags = db.Column(db.JSON, default=dict)                   # Extra metadata (resolution, etc.)
    recorded_at = db.Column(db.DateTime, nullable=False,
                            default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_infra_metrics_source', 'source_type', 'source_id', 'metric_name',
                 recorded_at.desc()),
        db.Index('idx_infra_metrics_time', recorded_at.desc()),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'metric_name': self.metric_name,
            'value': self.value,
            'unit': self.unit,
            'tags': self.tags or {},
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
        }


class InfraIncident(db.Model):
    """An outage or incident affecting infrastructure."""
    __tablename__ = 'infra_incidents'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)         # e.g., "HexOS unresponsive"
    description = db.Column(db.Text)                          # What happened
    severity = db.Column(db.String(20), default='medium')     # critical, high, medium, low
    status = db.Column(db.String(20), default='active')       # active, investigating, resolved
    started_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    resolved_at = db.Column(db.DateTime)
    resolution = db.Column(db.Text)                           # How it was fixed
    affected_hosts = db.Column(db.JSON, default=list)         # [host_id, ...]
    affected_services = db.Column(db.JSON, default=list)      # [service_id, ...]
    affected_containers = db.Column(db.JSON, default=list)    # [container_id, ...]
    tags = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_infra_incidents_status', 'status'),
        db.Index('idx_infra_incidents_started', started_at.desc()),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolution': self.resolution,
            'affected_hosts': self.affected_hosts or [],
            'affected_services': self.affected_services or [],
            'affected_containers': self.affected_containers or [],
            'tags': self.tags or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class InfraIntegrationConfig(db.Model):
    """Configuration for a Docker/HomeAssistant/Portainer integration."""
    __tablename__ = 'infra_integration_configs'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)          # e.g., "HexOS Docker"
    integration_type = db.Column(db.String(50), nullable=False)  # docker, homeassistant, portainer
    host_id = db.Column(db.Integer, db.ForeignKey('infra_hosts.id', ondelete='SET NULL'))
    is_enabled = db.Column(db.Boolean, default=True)
    config = db.Column(db.JSON, default=dict)                 # Type-specific config (url, token, etc.)
    sync_interval_seconds = db.Column(db.Integer, default=60) # How often to sync
    last_sync_at = db.Column(db.DateTime)
    last_sync_status = db.Column(db.String(20))               # success, error, pending
    last_sync_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationship
    host = db.relationship('InfraHost', foreign_keys=[host_id])

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        # Sanitize config — don't expose tokens/passwords in list responses
        safe_config = dict(self.config or {})
        for key in ('token', 'password', 'secret', 'api_key'):
            if key in safe_config:
                safe_config[key] = '***'
        return {
            'id': self.id,
            'name': self.name,
            'integration_type': self.integration_type,
            'host_id': self.host_id,
            'is_enabled': self.is_enabled,
            'config': safe_config,
            'sync_interval_seconds': self.sync_interval_seconds,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'last_sync_status': self.last_sync_status,
            'last_sync_error': self.last_sync_error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
