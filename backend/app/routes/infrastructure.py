"""
Infrastructure Module - API Routes

Full CRUD for infrastructure monitoring: hosts, network devices,
containers, services, incidents, integrations, metrics, and
an aggregated dashboard endpoint.

Endpoints:
  Hosts:
    GET    /api/infrastructure/hosts          -> List all hosts
    POST   /api/infrastructure/hosts          -> Add a host
    GET    /api/infrastructure/hosts/<id>     -> Get host with containers/services
    PUT    /api/infrastructure/hosts/<id>     -> Update a host
    DELETE /api/infrastructure/hosts/<id>     -> Delete a host and its containers

  Network Devices:
    GET    /api/infrastructure/network        -> List all network devices
    POST   /api/infrastructure/network        -> Add a device
    GET    /api/infrastructure/network/<id>   -> Get one device
    PUT    /api/infrastructure/network/<id>   -> Update a device
    DELETE /api/infrastructure/network/<id>   -> Delete a device

  Containers:
    GET    /api/infrastructure/containers          -> List (filterable by host, status, project)
    POST   /api/infrastructure/containers          -> Add manually
    GET    /api/infrastructure/containers/<id>     -> Get one
    PUT    /api/infrastructure/containers/<id>     -> Update
    DELETE /api/infrastructure/containers/<id>     -> Delete

  Services:
    GET    /api/infrastructure/services            -> List all services
    POST   /api/infrastructure/services            -> Add a service
    GET    /api/infrastructure/services/<id>       -> Get one
    PUT    /api/infrastructure/services/<id>       -> Update
    DELETE /api/infrastructure/services/<id>       -> Delete
    POST   /api/infrastructure/services/<id>/check -> Manual health check

  Incidents:
    GET    /api/infrastructure/incidents            -> List (filterable)
    POST   /api/infrastructure/incidents            -> Create
    GET    /api/infrastructure/incidents/<id>       -> Get one
    PUT    /api/infrastructure/incidents/<id>       -> Update / resolve
    DELETE /api/infrastructure/incidents/<id>       -> Delete

  Integrations:
    GET    /api/infrastructure/integrations             -> List
    POST   /api/infrastructure/integrations             -> Create
    GET    /api/infrastructure/integrations/<id>        -> Get one
    PUT    /api/infrastructure/integrations/<id>        -> Update
    DELETE /api/infrastructure/integrations/<id>        -> Delete
    POST   /api/infrastructure/integrations/<id>/test   -> Test connection
    POST   /api/infrastructure/integrations/<id>/sync   -> Trigger manual sync
    GET    /api/infrastructure/integrations/schemas     -> Config schemas per type

  Metrics:
    GET    /api/infrastructure/metrics                           -> Query metrics
    GET    /api/infrastructure/metrics/latest/<source>/<id>     -> Latest metrics

  Dashboard:
    GET    /api/infrastructure/dashboard       -> Aggregated summary

  Container Sync:
    POST   /api/infrastructure/containers/sync/<host_id>  -> Manual Docker sync
"""
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import func, text
from app import db
from app.models.infrastructure import (
    InfraHost, InfraNetworkDevice, InfraContainer, InfraService,
    InfraMetric, InfraIncident, InfraIntegrationConfig,
)

infrastructure_bp = Blueprint('infrastructure', __name__)


# ── Helper ──────────────────────────────────────────────────────────

def parse_datetime(value):
    """Parse an ISO datetime string, returning None for empty/null."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    return datetime.fromisoformat(value)


# ══════════════════════════════════════════════════════════════════════
#  HOSTS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/hosts', methods=['GET'])
def list_hosts():
    """Get all infrastructure hosts."""
    hosts = InfraHost.query.order_by(InfraHost.name).all()
    return jsonify([h.to_dict() for h in hosts])


@infrastructure_bp.route('/hosts', methods=['POST'])
def create_host():
    """Add a new infrastructure host."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('host_type'):
        return jsonify({'error': 'name and host_type are required'}), 400

    host = InfraHost(
        name=data['name'],
        hostname=data.get('hostname'),
        host_type=data['host_type'],
        ip_address=data.get('ip_address'),
        mac_address=data.get('mac_address'),
        os_name=data.get('os_name'),
        os_version=data.get('os_version'),
        location=data.get('location'),
        status=data.get('status', 'unknown'),
        hardware=data.get('hardware', {}),
        tags=data.get('tags', []),
        notes=data.get('notes'),
    )
    db.session.add(host)
    db.session.commit()
    return jsonify(host.to_dict()), 201


@infrastructure_bp.route('/hosts/<int:host_id>', methods=['GET'])
def get_host(host_id):
    """Get a host with its containers, services, and network devices."""
    host = InfraHost.query.get_or_404(host_id)
    result = host.to_dict()

    # Include containers on this host
    result['containers'] = [
        c.to_dict() for c in
        sorted(host.containers, key=lambda c: c.name)
    ]

    # Include services linked to this host
    services = InfraService.query.filter_by(host_id=host_id).order_by(InfraService.name).all()
    result['services'] = [s.to_dict() for s in services]

    # Include network devices under this host
    result['network_devices'] = [d.to_dict() for d in host.network_devices]

    return jsonify(result)


@infrastructure_bp.route('/hosts/<int:host_id>', methods=['PUT'])
def update_host(host_id):
    """Update a host's info."""
    host = InfraHost.query.get_or_404(host_id)
    data = request.get_json()

    for field in ('name', 'hostname', 'host_type', 'ip_address', 'mac_address',
                  'os_name', 'os_version', 'location', 'status', 'hardware',
                  'tags', 'notes'):
        if field in data:
            setattr(host, field, data[field])

    if 'last_seen_at' in data:
        host.last_seen_at = parse_datetime(data['last_seen_at'])

    db.session.commit()
    return jsonify(host.to_dict())


@infrastructure_bp.route('/hosts/<int:host_id>', methods=['DELETE'])
def delete_host(host_id):
    """Delete a host and all its containers (cascade)."""
    host = InfraHost.query.get_or_404(host_id)
    db.session.delete(host)
    db.session.commit()
    return jsonify({'message': 'Host deleted'}), 200


# ══════════════════════════════════════════════════════════════════════
#  NETWORK DEVICES
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/network', methods=['GET'])
def list_network_devices():
    """Get all network devices."""
    devices = InfraNetworkDevice.query.order_by(InfraNetworkDevice.name).all()
    return jsonify([d.to_dict() for d in devices])


@infrastructure_bp.route('/network', methods=['POST'])
def create_network_device():
    """Add a network device."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('device_type'):
        return jsonify({'error': 'name and device_type are required'}), 400

    device = InfraNetworkDevice(
        name=data['name'],
        device_type=data['device_type'],
        ip_address=data.get('ip_address'),
        mac_address=data.get('mac_address'),
        manufacturer=data.get('manufacturer'),
        model=data.get('model'),
        firmware_version=data.get('firmware_version'),
        location=data.get('location'),
        status=data.get('status', 'unknown'),
        config=data.get('config', {}),
        parent_host_id=data.get('parent_host_id'),
        tags=data.get('tags', []),
        notes=data.get('notes'),
    )
    db.session.add(device)
    db.session.commit()
    return jsonify(device.to_dict()), 201


@infrastructure_bp.route('/network/<int:device_id>', methods=['GET'])
def get_network_device(device_id):
    """Get a single network device."""
    device = InfraNetworkDevice.query.get_or_404(device_id)
    return jsonify(device.to_dict())


@infrastructure_bp.route('/network/<int:device_id>', methods=['PUT'])
def update_network_device(device_id):
    """Update a network device."""
    device = InfraNetworkDevice.query.get_or_404(device_id)
    data = request.get_json()

    for field in ('name', 'device_type', 'ip_address', 'mac_address', 'manufacturer',
                  'model', 'firmware_version', 'location', 'status', 'config',
                  'parent_host_id', 'tags', 'notes'):
        if field in data:
            setattr(device, field, data[field])

    db.session.commit()
    return jsonify(device.to_dict())


@infrastructure_bp.route('/network/<int:device_id>', methods=['DELETE'])
def delete_network_device(device_id):
    """Delete a network device."""
    device = InfraNetworkDevice.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()
    return jsonify({'message': 'Network device deleted'}), 200


# ══════════════════════════════════════════════════════════════════════
#  CONTAINERS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/containers', methods=['GET'])
def list_containers():
    """
    List containers. Supports filters:
      ?host_id=1
      ?status=running
      ?compose_project=datacore
    """
    query = InfraContainer.query

    if request.args.get('host_id'):
        query = query.filter_by(host_id=int(request.args['host_id']))
    if request.args.get('status'):
        query = query.filter_by(status=request.args['status'])
    if request.args.get('compose_project'):
        query = query.filter_by(compose_project=request.args['compose_project'])

    containers = query.order_by(InfraContainer.name).all()
    return jsonify([c.to_dict() for c in containers])


@infrastructure_bp.route('/containers', methods=['POST'])
def create_container():
    """Manually add a container record."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('host_id'):
        return jsonify({'error': 'name and host_id are required'}), 400

    # Verify host exists
    InfraHost.query.get_or_404(data['host_id'])

    container = InfraContainer(
        host_id=data['host_id'],
        container_id=data.get('container_id'),
        name=data['name'],
        image=data.get('image'),
        status=data.get('status', 'unknown'),
        state=data.get('state'),
        compose_project=data.get('compose_project'),
        compose_service=data.get('compose_service'),
        ports=data.get('ports', []),
        volumes=data.get('volumes', []),
        environment=data.get('environment', {}),
        extra_data=data.get('extra_data', {}),
    )
    db.session.add(container)
    db.session.commit()
    return jsonify(container.to_dict()), 201


@infrastructure_bp.route('/containers/<int:container_id>', methods=['GET'])
def get_container(container_id):
    """Get a single container."""
    container = InfraContainer.query.get_or_404(container_id)
    return jsonify(container.to_dict())


@infrastructure_bp.route('/containers/<int:container_id>', methods=['PUT'])
def update_container(container_id):
    """Update a container record."""
    container = InfraContainer.query.get_or_404(container_id)
    data = request.get_json()

    for field in ('name', 'container_id', 'image', 'status', 'state',
                  'compose_project', 'compose_service', 'ports', 'volumes',
                  'environment', 'extra_data'):
        if field in data:
            setattr(container, field, data[field])

    if 'started_at' in data:
        container.started_at = parse_datetime(data['started_at'])

    db.session.commit()
    return jsonify(container.to_dict())


@infrastructure_bp.route('/containers/<int:container_id>', methods=['DELETE'])
def delete_container(container_id):
    """Delete a container record."""
    container = InfraContainer.query.get_or_404(container_id)
    db.session.delete(container)
    db.session.commit()
    return jsonify({'message': 'Container deleted'}), 200


@infrastructure_bp.route('/containers/sync/<int:host_id>', methods=['POST'])
def sync_containers(host_id):
    """Trigger manual Docker sync for a host."""
    host = InfraHost.query.get_or_404(host_id)

    try:
        from app.services.infrastructure.sync_worker import sync_host_containers
        result = sync_host_containers(host_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


# ══════════════════════════════════════════════════════════════════════
#  SERVICES
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/services', methods=['GET'])
def list_services():
    """Get all monitored services."""
    services = InfraService.query.order_by(InfraService.name).all()
    return jsonify([s.to_dict() for s in services])


@infrastructure_bp.route('/services', methods=['POST'])
def create_service():
    """Add a monitored service."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    service = InfraService(
        name=data['name'],
        url=data.get('url'),
        service_type=data.get('service_type', 'http'),
        host_id=data.get('host_id'),
        container_id=data.get('container_id'),
        status=data.get('status', 'unknown'),
        is_monitored=data.get('is_monitored', True),
        check_interval_seconds=data.get('check_interval_seconds', 300),
        expected_status=data.get('expected_status', 200),
        tags=data.get('tags', []),
        notes=data.get('notes'),
    )
    db.session.add(service)
    db.session.commit()
    return jsonify(service.to_dict()), 201


@infrastructure_bp.route('/services/<int:service_id>', methods=['GET'])
def get_service(service_id):
    """Get a single service."""
    service = InfraService.query.get_or_404(service_id)
    return jsonify(service.to_dict())


@infrastructure_bp.route('/services/<int:service_id>', methods=['PUT'])
def update_service(service_id):
    """Update a service."""
    service = InfraService.query.get_or_404(service_id)
    data = request.get_json()

    for field in ('name', 'url', 'service_type', 'host_id', 'container_id',
                  'status', 'is_monitored', 'check_interval_seconds',
                  'expected_status', 'tags', 'notes'):
        if field in data:
            setattr(service, field, data[field])

    db.session.commit()
    return jsonify(service.to_dict())


@infrastructure_bp.route('/services/<int:service_id>', methods=['DELETE'])
def delete_service(service_id):
    """Delete a service."""
    service = InfraService.query.get_or_404(service_id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({'message': 'Service deleted'}), 200


@infrastructure_bp.route('/services/<int:service_id>/check', methods=['POST'])
def check_service(service_id):
    """Manually trigger a health check for a single service."""
    service = InfraService.query.get_or_404(service_id)

    if not service.url:
        return jsonify({'error': f'Service "{service.name}" has no URL configured'}), 400

    import requests as http_requests
    from app.models.infrastructure import InfraMetric
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    response_time_ms = None

    try:
        resp = http_requests.get(
            service.url,
            timeout=30,
            allow_redirects=True,
            verify=False,
        )
        response_time_ms = int(resp.elapsed.total_seconds() * 1000)

        expected = service.expected_status or 200
        if resp.status_code == expected:
            service.status = 'up'
            service.consecutive_failures = 0
        else:
            service.status = 'degraded'
            service.consecutive_failures = (service.consecutive_failures or 0) + 1

    except http_requests.exceptions.Timeout:
        service.status = 'down'
        service.consecutive_failures = (service.consecutive_failures or 0) + 1

    except http_requests.exceptions.ConnectionError:
        service.status = 'down'
        service.consecutive_failures = (service.consecutive_failures or 0) + 1

    except Exception:
        service.status = 'down'
        service.consecutive_failures = (service.consecutive_failures or 0) + 1

    service.last_check_at = now
    if response_time_ms is not None:
        service.last_response_time_ms = response_time_ms
        db.session.add(InfraMetric(
            source_type='service',
            source_id=service.id,
            metric_name='response_time_ms',
            value=float(response_time_ms),
            unit='ms',
            recorded_at=now,
        ))

    db.session.commit()
    return jsonify(service.to_dict()), 200


# ══════════════════════════════════════════════════════════════════════
#  INCIDENTS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/incidents', methods=['GET'])
def list_incidents():
    """
    List incidents. Supports filters:
      ?status=active
      ?severity=critical
      ?from=2026-01-01T00:00:00
      ?to=2026-02-01T00:00:00
    """
    query = InfraIncident.query

    if request.args.get('status'):
        query = query.filter_by(status=request.args['status'])
    if request.args.get('severity'):
        query = query.filter_by(severity=request.args['severity'])
    if request.args.get('from'):
        query = query.filter(InfraIncident.started_at >= parse_datetime(request.args['from']))
    if request.args.get('to'):
        query = query.filter(InfraIncident.started_at <= parse_datetime(request.args['to']))

    incidents = query.order_by(InfraIncident.started_at.desc()).all()
    return jsonify([i.to_dict() for i in incidents])


@infrastructure_bp.route('/incidents', methods=['POST'])
def create_incident():
    """Create an incident."""
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'error': 'title is required'}), 400

    incident = InfraIncident(
        title=data['title'],
        description=data.get('description'),
        severity=data.get('severity', 'medium'),
        status=data.get('status', 'active'),
        started_at=parse_datetime(data.get('started_at')) or datetime.now(timezone.utc),
        affected_hosts=data.get('affected_hosts', []),
        affected_services=data.get('affected_services', []),
        affected_containers=data.get('affected_containers', []),
        tags=data.get('tags', []),
    )
    db.session.add(incident)
    db.session.commit()
    return jsonify(incident.to_dict()), 201


@infrastructure_bp.route('/incidents/<int:incident_id>', methods=['GET'])
def get_incident(incident_id):
    """Get a single incident."""
    incident = InfraIncident.query.get_or_404(incident_id)
    return jsonify(incident.to_dict())


@infrastructure_bp.route('/incidents/<int:incident_id>', methods=['PUT'])
def update_incident(incident_id):
    """Update / resolve an incident."""
    incident = InfraIncident.query.get_or_404(incident_id)
    data = request.get_json()

    for field in ('title', 'description', 'severity', 'status', 'resolution',
                  'affected_hosts', 'affected_services', 'affected_containers', 'tags'):
        if field in data:
            setattr(incident, field, data[field])

    if 'started_at' in data:
        incident.started_at = parse_datetime(data['started_at'])
    if 'resolved_at' in data:
        incident.resolved_at = parse_datetime(data['resolved_at'])

    # Auto-set resolved_at when marking as resolved
    if data.get('status') == 'resolved' and not incident.resolved_at:
        incident.resolved_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(incident.to_dict())


@infrastructure_bp.route('/incidents/<int:incident_id>', methods=['DELETE'])
def delete_incident(incident_id):
    """Delete an incident."""
    incident = InfraIncident.query.get_or_404(incident_id)
    db.session.delete(incident)
    db.session.commit()
    return jsonify({'message': 'Incident deleted'}), 200


# ══════════════════════════════════════════════════════════════════════
#  INTEGRATIONS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/integrations', methods=['GET'])
def list_integrations():
    """Get all integration configs."""
    integrations = InfraIntegrationConfig.query.order_by(InfraIntegrationConfig.name).all()
    return jsonify([i.to_dict() for i in integrations])


@infrastructure_bp.route('/integrations', methods=['POST'])
def create_integration():
    """Create an integration config."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('integration_type'):
        return jsonify({'error': 'name and integration_type are required'}), 400

    valid_types = ['docker', 'homeassistant', 'portainer']
    if data['integration_type'] not in valid_types:
        return jsonify({'error': f'integration_type must be one of: {valid_types}'}), 400

    integration = InfraIntegrationConfig(
        name=data['name'],
        integration_type=data['integration_type'],
        host_id=data.get('host_id'),
        is_enabled=data.get('is_enabled', True),
        config=data.get('config', {}),
        sync_interval_seconds=data.get('sync_interval_seconds', 60),
    )
    db.session.add(integration)
    db.session.commit()
    return jsonify(integration.to_dict()), 201


@infrastructure_bp.route('/integrations/<int:integration_id>', methods=['GET'])
def get_integration(integration_id):
    """Get a single integration config."""
    integration = InfraIntegrationConfig.query.get_or_404(integration_id)
    return jsonify(integration.to_dict())


@infrastructure_bp.route('/integrations/<int:integration_id>', methods=['PUT'])
def update_integration(integration_id):
    """Update an integration config."""
    integration = InfraIntegrationConfig.query.get_or_404(integration_id)
    data = request.get_json()

    for field in ('name', 'integration_type', 'host_id', 'is_enabled',
                  'config', 'sync_interval_seconds'):
        if field in data:
            setattr(integration, field, data[field])

    db.session.commit()
    return jsonify(integration.to_dict())


@infrastructure_bp.route('/integrations/<int:integration_id>', methods=['DELETE'])
def delete_integration(integration_id):
    """Delete an integration config."""
    integration = InfraIntegrationConfig.query.get_or_404(integration_id)
    db.session.delete(integration)
    db.session.commit()
    return jsonify({'message': 'Integration deleted'}), 200


@infrastructure_bp.route('/integrations/<int:integration_id>/test', methods=['POST'])
def test_integration(integration_id):
    """Test connection for an integration."""
    InfraIntegrationConfig.query.get_or_404(integration_id)

    try:
        from app.services.infrastructure.sync_worker import test_single_integration
        result = test_single_integration(integration_id)
        status_code = 200 if result.get('success') else 400
        return jsonify(result), status_code
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': f'Test failed: {str(e)}'}), 500


@infrastructure_bp.route('/integrations/<int:integration_id>/sync', methods=['POST'])
def sync_integration(integration_id):
    """Trigger a manual sync for an integration."""
    InfraIntegrationConfig.query.get_or_404(integration_id)

    try:
        from app.services.infrastructure.sync_worker import sync_single_integration
        result = sync_single_integration(integration_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500


@infrastructure_bp.route('/integrations/schemas', methods=['GET'])
def get_integration_schemas():
    """
    Return config schemas for each integration type.
    Tells the frontend what fields to show in the config form.
    Schemas are defined in each integration class via get_config_schema().
    """
    from app.services.infrastructure.registry import get_all_schemas
    return jsonify(get_all_schemas())


# ══════════════════════════════════════════════════════════════════════
#  METRICS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/metrics', methods=['GET'])
def query_metrics():
    """
    Query time-series metrics with optional downsampling.

    Params:
      ?source_type=host&source_id=1&metric_name=cpu_percent
      ?from=2026-02-01T00:00:00&to=2026-02-18T00:00:00
      ?resolution=auto   (raw, 5min, hourly, daily, auto)
      ?limit=500

    When resolution=auto (default), the time range determines granularity:
      <= 6h  -> raw
      <= 24h -> 5-min averages
      <= 7d  -> hourly averages
      > 7d   -> daily averages
    """
    source_type = request.args.get('source_type')
    source_id = request.args.get('source_id')
    metric_name = request.args.get('metric_name')
    from_dt = parse_datetime(request.args.get('from'))
    to_dt = parse_datetime(request.args.get('to'))
    resolution = request.args.get('resolution', 'auto')
    limit = min(int(request.args.get('limit', 500)), 5000)

    # Determine effective resolution when auto
    if resolution == 'auto' and from_dt and to_dt:
        span = to_dt - from_dt
        if span <= timedelta(hours=6):
            resolution = 'raw'
        elif span <= timedelta(hours=24):
            resolution = '5min'
        elif span <= timedelta(days=7):
            resolution = 'hourly'
        else:
            resolution = 'daily'
    elif resolution == 'auto':
        resolution = 'raw'

    # Raw: use ORM query directly
    if resolution == 'raw':
        query = InfraMetric.query
        if source_type:
            query = query.filter_by(source_type=source_type)
        if source_id:
            query = query.filter_by(source_id=int(source_id))
        if metric_name:
            query = query.filter_by(metric_name=metric_name)
        if from_dt:
            query = query.filter(InfraMetric.recorded_at >= from_dt)
        if to_dt:
            query = query.filter(InfraMetric.recorded_at <= to_dt)

        metrics = query.order_by(InfraMetric.recorded_at.desc()).limit(limit).all()
        return jsonify([m.to_dict() for m in metrics])

    # Downsampled: use SQL GROUP BY with time buckets
    bucket_map = {
        '5min':   "date_trunc('hour', recorded_at) + "
                  "INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM recorded_at) / 5)",
        'hourly': "date_trunc('hour', recorded_at)",
        'daily':  "date_trunc('day', recorded_at)",
    }
    bucket_expr = bucket_map.get(resolution)
    if not bucket_expr:
        return jsonify({'error': f'Invalid resolution: {resolution}'}), 400

    # Build WHERE clause filters
    conditions = []
    params = {}
    if source_type:
        conditions.append("source_type = :source_type")
        params['source_type'] = source_type
    if source_id:
        conditions.append("source_id = :source_id")
        params['source_id'] = int(source_id)
    if metric_name:
        conditions.append("metric_name = :metric_name")
        params['metric_name'] = metric_name
    if from_dt:
        conditions.append("recorded_at >= :from_dt")
        params['from_dt'] = from_dt
    if to_dt:
        conditions.append("recorded_at <= :to_dt")
        params['to_dt'] = to_dt

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = text(f"""
        SELECT
            source_type,
            source_id,
            metric_name,
            AVG(value)  AS value,
            MIN(unit)   AS unit,
            ({bucket_expr}) AS bucket_time
        FROM infra_metrics
        {where}
        GROUP BY source_type, source_id, metric_name, bucket_time
        ORDER BY bucket_time DESC
        LIMIT :limit
    """)
    params['limit'] = limit

    rows = db.session.execute(sql, params).fetchall()
    results = [
        {
            'source_type': r.source_type,
            'source_id': r.source_id,
            'metric_name': r.metric_name,
            'value': round(r.value, 2) if r.value is not None else None,
            'unit': r.unit,
            'tags': {'resolution': resolution},
            'recorded_at': r.bucket_time.isoformat() if r.bucket_time else None,
        }
        for r in rows
    ]
    return jsonify(results)


@infrastructure_bp.route('/metrics/latest/<source_type>/<int:source_id>', methods=['GET'])
def get_latest_metrics(source_type, source_id):
    """
    Get the most recent metric for each metric_name for a given source.
    Returns one entry per distinct metric_name.
    """
    # Subquery: get the max recorded_at per metric_name for this source
    subquery = (
        db.session.query(
            InfraMetric.metric_name,
            func.max(InfraMetric.recorded_at).label('max_time')
        )
        .filter_by(source_type=source_type, source_id=source_id)
        .group_by(InfraMetric.metric_name)
        .subquery()
    )

    metrics = (
        db.session.query(InfraMetric)
        .join(subquery, db.and_(
            InfraMetric.metric_name == subquery.c.metric_name,
            InfraMetric.recorded_at == subquery.c.max_time,
            InfraMetric.source_type == source_type,
            InfraMetric.source_id == source_id,
        ))
        .all()
    )

    return jsonify([m.to_dict() for m in metrics])


# ══════════════════════════════════════════════════════════════════════
#  DASHBOARD (aggregated summary)
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """
    Aggregated infrastructure summary for the dashboard.
    Returns counts, status breakdowns, and recent incidents.
    """
    hosts = InfraHost.query.all()
    containers = InfraContainer.query.all()
    services = InfraService.query.all()
    network_devices = InfraNetworkDevice.query.all()
    active_incidents = InfraIncident.query.filter_by(status='active').all()
    recent_incidents = (
        InfraIncident.query
        .order_by(InfraIncident.started_at.desc())
        .limit(5)
        .all()
    )
    integrations = InfraIntegrationConfig.query.all()

    # Status breakdowns
    host_by_status = {}
    host_by_type = {}
    for h in hosts:
        host_by_status[h.status] = host_by_status.get(h.status, 0) + 1
        host_by_type[h.host_type] = host_by_type.get(h.host_type, 0) + 1

    container_by_status = {}
    for c in containers:
        container_by_status[c.status] = container_by_status.get(c.status, 0) + 1

    service_by_status = {}
    for s in services:
        service_by_status[s.status] = service_by_status.get(s.status, 0) + 1

    return jsonify({
        'hosts': {
            'total': len(hosts),
            'by_status': host_by_status,
            'by_type': host_by_type,
        },
        'containers': {
            'total': len(containers),
            'by_status': container_by_status,
        },
        'services': {
            'total': len(services),
            'by_status': service_by_status,
        },
        'network_devices': {
            'total': len(network_devices),
        },
        'incidents': {
            'active': len(active_incidents),
            'recent': [i.to_dict() for i in recent_incidents],
        },
        'integrations': {
            'total': len(integrations),
            'enabled': sum(1 for i in integrations if i.is_enabled),
        },
    })
