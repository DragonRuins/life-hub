"""
Infrastructure Module - API Routes

Full CRUD for infrastructure monitoring: hosts, network devices,
containers, services, incidents, integrations, metrics, and
an aggregated dashboard endpoint.

Endpoints:
  Hosts:
    GET    /api/infrastructure/hosts                    -> List all hosts
    POST   /api/infrastructure/hosts                    -> Add a host (with optional Docker setup)
    GET    /api/infrastructure/hosts/<id>               -> Get host with containers/services
    PUT    /api/infrastructure/hosts/<id>               -> Update a host
    DELETE /api/infrastructure/hosts/<id>               -> Delete a host and its containers
    POST   /api/infrastructure/hosts/<id>/setup-docker  -> Set up Docker for existing host

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
    InfraSmarthomeRoom, InfraSmarthomeDevice, InfraPrinterJob,
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
    """
    Add a new infrastructure host.

    Optionally accepts a 'setup_docker' object to auto-create a Docker
    integration, test the connection, and run an immediate container sync.

    Example request body with Docker setup:
    {
      "name": "HexOS Server",
      "host_type": "nas",
      "setup_docker": {
        "connection_type": "socket",
        "socket_path": "/var/run/docker.sock",
        "collect_stats": true
      }
    }
    """
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

    result = host.to_dict()

    # If setup_docker is provided, auto-create Docker integration and sync
    setup_docker = data.get('setup_docker')
    if setup_docker:
        result['docker_setup'] = _setup_docker_for_host(host, setup_docker)

    return jsonify(result), 201


def _setup_docker_for_host(host, setup_docker):
    """
    Create a Docker integration for a host, test it, and run an initial sync.

    Args:
        host: The InfraHost instance (already committed).
        setup_docker: Dict with connection_type, socket_path/tcp_url, collect_stats.

    Returns:
        dict: Docker setup result with integration_id, connection_ok, and sync_result or error.
    """
    connection_type = setup_docker.get('connection_type', 'socket')
    socket_path = setup_docker.get('socket_path', '/var/run/docker.sock')
    tcp_url = setup_docker.get('tcp_url', '')
    collect_stats = setup_docker.get('collect_stats', True)

    # Build integration config based on connection type
    config = {
        'connection_type': connection_type,
        'sync_stats': collect_stats,
    }
    if connection_type == 'socket':
        config['socket_path'] = socket_path
    else:
        config['tcp_url'] = tcp_url

    integration = InfraIntegrationConfig(
        name=f"{host.name} - Docker",
        integration_type='docker',
        host_id=host.id,
        is_enabled=True,
        config=config,
        sync_interval_seconds=60,
    )
    db.session.add(integration)
    db.session.commit()

    docker_result = {
        'integration_id': integration.id,
        'connection_ok': False,
    }

    # Test connection
    try:
        from app.services.infrastructure.sync_worker import test_single_integration
        test_result = test_single_integration(integration.id)
        docker_result['connection_ok'] = test_result.get('success', False)

        if not docker_result['connection_ok']:
            docker_result['error'] = test_result.get('message', 'Connection test failed')
            return docker_result
    except Exception as e:
        docker_result['error'] = str(e)
        return docker_result

    # Connection succeeded — run immediate sync
    try:
        from app.services.infrastructure.sync_worker import sync_single_integration
        sync_result = sync_single_integration(integration.id)
        docker_result['sync_result'] = {
            'total_containers': sync_result.get('total', 0),
            'created': sync_result.get('created', 0),
            'updated': sync_result.get('updated', 0),
            'metrics_recorded': sync_result.get('metrics_recorded', 0),
        }
    except Exception as e:
        # Sync failed but connection was OK — still useful info
        docker_result['sync_result'] = {'error': str(e)}

    return docker_result


@infrastructure_bp.route('/hosts/<int:host_id>/setup-docker', methods=['POST'])
def setup_docker_for_existing_host(host_id):
    """
    Set up Docker integration for an existing host.

    Creates a Docker integration config, tests the connection, and runs
    an immediate sync. Returns 409 if the host already has a Docker integration.

    Request body:
    {
      "connection_type": "socket",
      "socket_path": "/var/run/docker.sock",
      "collect_stats": true
    }
    """
    host = InfraHost.query.get_or_404(host_id)

    # Check if host already has a Docker integration
    existing = InfraIntegrationConfig.query.filter_by(
        host_id=host_id,
        integration_type='docker',
    ).first()
    if existing:
        return jsonify({
            'error': 'This host already has a Docker integration configured',
            'integration_id': existing.id,
        }), 409

    data = request.get_json() or {}
    result = _setup_docker_for_host(host, data)
    return jsonify(result), 200


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

    # Check if host has a Docker integration configured
    docker_integration = InfraIntegrationConfig.query.filter_by(
        host_id=host_id,
        integration_type='docker',
    ).first()
    result['has_docker_integration'] = docker_integration is not None

    # Check if host /proc stats are available (mounted into container)
    from app.services.infrastructure.host_stats import is_available
    result['host_stats_available'] = is_available()

    return jsonify(result)


@infrastructure_bp.route('/hosts/<int:host_id>/hardware-detect', methods=['POST'])
def detect_host_hardware(host_id):
    """
    Auto-detect hardware specs by reading /host/proc and /host/sys.

    Merges detected values into the host's hardware JSON field (preserving
    any manually-set values that detection didn't find).

    Returns 503 if /host/proc is not mounted.
    """
    host = InfraHost.query.get_or_404(host_id)

    from app.services.infrastructure.host_stats import is_available, detect_hardware

    if not is_available():
        return jsonify({
            'error': 'Host /proc not mounted. Add /proc:/host/proc:ro and '
                     '/sys:/host/sys:ro to your Docker Compose volumes and restart.'
        }), 503

    try:
        detected = detect_hardware()
    except Exception as e:
        return jsonify({'error': f'Detection failed: {str(e)}'}), 500

    # Merge detected values into existing hardware (don't overwrite with None)
    current_hw = dict(host.hardware or {})
    for key, value in detected.items():
        if value is not None:
            current_hw[key] = value

    host.hardware = current_hw
    db.session.commit()

    return jsonify({
        'hardware': host.hardware,
        'detected': detected,
    })


@infrastructure_bp.route('/hosts/<int:host_id>/live-stats', methods=['GET'])
def get_host_live_stats(host_id):
    """
    Get a live snapshot of system metrics (CPU, RAM, disk, load, uptime).

    Takes ~1 second due to CPU sampling (two /proc/stat reads 1s apart).
    Returns the snapshot directly — not recorded to the database.

    Returns 503 if /host/proc is not mounted.
    """
    InfraHost.query.get_or_404(host_id)

    from app.services.infrastructure.host_stats import is_available, get_live_metrics

    if not is_available():
        return jsonify({
            'error': 'Host /proc not mounted. Add /proc:/host/proc:ro and '
                     '/sys:/host/sys:ro to your Docker Compose volumes and restart.'
        }), 503

    try:
        metrics = get_live_metrics()
    except Exception as e:
        return jsonify({'error': f'Failed to read metrics: {str(e)}'}), 500

    return jsonify(metrics)


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


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — ROOMS
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/rooms', methods=['GET'])
def list_smarthome_rooms():
    """Get all smart home rooms ordered by sort_order, including device counts."""
    rooms = InfraSmarthomeRoom.query.order_by(InfraSmarthomeRoom.sort_order, InfraSmarthomeRoom.name).all()
    return jsonify([r.to_dict() for r in rooms])


@infrastructure_bp.route('/smarthome/rooms', methods=['POST'])
def create_smarthome_room():
    """Create a new room."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    room = InfraSmarthomeRoom(
        name=data['name'],
        icon=data.get('icon', 'home'),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(room)
    db.session.commit()
    return jsonify(room.to_dict()), 201


@infrastructure_bp.route('/smarthome/rooms/<int:room_id>', methods=['PUT'])
def update_smarthome_room(room_id):
    """Update a room."""
    room = InfraSmarthomeRoom.query.get_or_404(room_id)
    data = request.get_json()

    for field in ('name', 'icon', 'sort_order'):
        if field in data:
            setattr(room, field, data[field])

    db.session.commit()
    return jsonify(room.to_dict())


@infrastructure_bp.route('/smarthome/rooms/<int:room_id>', methods=['DELETE'])
def delete_smarthome_room(room_id):
    """Delete a room. Devices become unassigned (room_id set to NULL via ON DELETE SET NULL)."""
    room = InfraSmarthomeRoom.query.get_or_404(room_id)
    db.session.delete(room)
    db.session.commit()
    return jsonify({'message': 'Room deleted'}), 200


@infrastructure_bp.route('/smarthome/rooms/reorder', methods=['PUT'])
def reorder_smarthome_rooms():
    """Bulk update sort_order for rooms. Expects [{id, sort_order}, ...]."""
    data = request.get_json()
    if not data or not isinstance(data, list):
        return jsonify({'error': 'Expected a list of {id, sort_order} objects'}), 400

    for item in data:
        room = InfraSmarthomeRoom.query.get(item.get('id'))
        if room:
            room.sort_order = item.get('sort_order', 0)

    db.session.commit()
    return jsonify({'message': 'Rooms reordered'}), 200


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — DEVICES
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/devices', methods=['GET'])
def list_smarthome_devices():
    """
    List registered smart home devices. Supports filters:
      ?room_id=1
      ?category=climate
      ?domain=sensor
      ?is_visible=true
    """
    query = InfraSmarthomeDevice.query

    if request.args.get('room_id'):
        query = query.filter_by(room_id=int(request.args['room_id']))
    if request.args.get('category'):
        query = query.filter_by(category=request.args['category'])
    if request.args.get('domain'):
        query = query.filter_by(domain=request.args['domain'])
    if request.args.get('is_visible') is not None:
        vis = request.args['is_visible'].lower() == 'true'
        query = query.filter_by(is_visible=vis)

    devices = query.order_by(InfraSmarthomeDevice.sort_order, InfraSmarthomeDevice.friendly_name).all()
    return jsonify([d.to_dict() for d in devices])


@infrastructure_bp.route('/smarthome/devices', methods=['POST'])
def create_smarthome_device():
    """Register a single smart home device."""
    data = request.get_json()
    if not data or not data.get('entity_id') or not data.get('integration_config_id'):
        return jsonify({'error': 'entity_id and integration_config_id are required'}), 400

    # Verify integration exists and is HomeAssistant type
    integration = InfraIntegrationConfig.query.get_or_404(data['integration_config_id'])
    if integration.integration_type != 'homeassistant':
        return jsonify({'error': 'Integration must be of type homeassistant'}), 400

    # Check for duplicate
    existing = InfraSmarthomeDevice.query.filter_by(
        integration_config_id=data['integration_config_id'],
        entity_id=data['entity_id'],
    ).first()
    if existing:
        return jsonify({'error': f'Device {data["entity_id"]} is already registered', 'device_id': existing.id}), 409

    device = InfraSmarthomeDevice(
        integration_config_id=data['integration_config_id'],
        entity_id=data['entity_id'],
        friendly_name=data.get('friendly_name'),
        domain=data.get('domain'),
        device_class=data.get('device_class'),
        room_id=data.get('room_id'),
        category=data.get('category', 'general'),
        is_visible=data.get('is_visible', True),
        is_tracked=data.get('is_tracked', False),
        track_interval_seconds=data.get('track_interval_seconds', 300),
        config=data.get('config', {}),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(device)
    db.session.commit()
    return jsonify(device.to_dict()), 201


@infrastructure_bp.route('/smarthome/devices/<int:device_id>', methods=['PUT'])
def update_smarthome_device(device_id):
    """Update a smart home device's config, room, category, or tracking settings."""
    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    data = request.get_json()

    for field in ('friendly_name', 'domain', 'device_class', 'room_id', 'category',
                  'is_visible', 'is_tracked', 'is_favorited', 'track_interval_seconds', 'config', 'sort_order'):
        if field in data:
            setattr(device, field, data[field])

    db.session.commit()
    return jsonify(device.to_dict())


@infrastructure_bp.route('/smarthome/devices/<int:device_id>', methods=['DELETE'])
def delete_smarthome_device(device_id):
    """Unregister a smart home device."""
    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()
    return jsonify({'message': 'Device unregistered'}), 200


@infrastructure_bp.route('/smarthome/devices/<int:device_id>/history', methods=['GET'])
def get_smarthome_device_history(device_id):
    """
    Get metric history for a tracked device.
    Uses infra_metrics with source_type='smarthome'.
      ?hours=24 (default)
      ?metric_name=temperature (optional filter)
    """
    InfraSmarthomeDevice.query.get_or_404(device_id)

    hours = int(request.args.get('hours', 24))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    query = InfraMetric.query.filter(
        InfraMetric.source_type == 'smarthome',
        InfraMetric.source_id == device_id,
        InfraMetric.recorded_at >= since,
    )

    if request.args.get('metric_name'):
        query = query.filter_by(metric_name=request.args['metric_name'])

    metrics = query.order_by(InfraMetric.recorded_at.desc()).limit(1000).all()
    return jsonify([m.to_dict() for m in metrics])


@infrastructure_bp.route('/smarthome/devices/bulk-import', methods=['POST'])
def bulk_import_smarthome_devices():
    """
    Register multiple devices from discovery.
    Expects: [{entity_id, friendly_name, domain, device_class, room_id, category, integration_config_id}, ...]
    Skips duplicates and returns counts.
    """
    data = request.get_json()
    if not data or not isinstance(data, list):
        return jsonify({'error': 'Expected a list of device objects'}), 400

    created = 0
    skipped = 0
    errors = []

    for item in data:
        entity_id = item.get('entity_id')
        config_id = item.get('integration_config_id')
        if not entity_id or not config_id:
            errors.append(f'Missing entity_id or integration_config_id')
            continue

        # Skip duplicates
        existing = InfraSmarthomeDevice.query.filter_by(
            integration_config_id=config_id,
            entity_id=entity_id,
        ).first()
        if existing:
            skipped += 1
            continue

        device = InfraSmarthomeDevice(
            integration_config_id=config_id,
            entity_id=entity_id,
            friendly_name=item.get('friendly_name'),
            domain=item.get('domain'),
            device_class=item.get('device_class'),
            room_id=item.get('room_id'),
            category=item.get('category', 'general'),
            is_visible=item.get('is_visible', True),
            is_tracked=item.get('is_tracked', False),
        )
        db.session.add(device)
        created += 1

    db.session.commit()
    return jsonify({'created': created, 'skipped': skipped, 'errors': errors}), 201


@infrastructure_bp.route('/smarthome/devices/bulk-update', methods=['PUT'])
def bulk_update_smarthome_devices():
    """
    Apply partial updates to multiple smart home devices at once.

    Expects:
    {
      "device_ids": [1, 2, 3],
      "updates": { "category": "general", "room_id": 5, "is_visible": true }
    }

    Only whitelisted fields are applied: category, room_id, is_visible,
    is_tracked, is_favorited. Returns counts of updated/failed.
    """
    data = request.get_json()
    if not data or not isinstance(data.get('device_ids'), list) or not isinstance(data.get('updates'), dict):
        return jsonify({'error': 'device_ids (list) and updates (object) are required'}), 400

    device_ids = data['device_ids']
    updates = data['updates']
    if not device_ids:
        return jsonify({'error': 'device_ids cannot be empty'}), 400

    # Only allow safe fields to be bulk-updated
    allowed_fields = {'category', 'room_id', 'is_visible', 'is_tracked', 'is_favorited'}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    if not filtered:
        return jsonify({'error': f'No valid update fields. Allowed: {sorted(allowed_fields)}'}), 400

    updated = 0
    failed = 0
    errors = []

    for device_id in device_ids:
        try:
            device = InfraSmarthomeDevice.query.get(device_id)
            if not device:
                errors.append(f'Device {device_id} not found')
                failed += 1
                continue
            for field, value in filtered.items():
                setattr(device, field, value)
            updated += 1
        except Exception as e:
            errors.append(f'Device {device_id}: {str(e)}')
            failed += 1

    db.session.commit()
    result = {'updated': updated, 'failed': failed}
    if errors:
        result['errors'] = errors
    return jsonify(result), 200


@infrastructure_bp.route('/smarthome/devices/bulk-delete', methods=['DELETE'])
def bulk_delete_smarthome_devices():
    """
    Delete multiple smart home devices at once.

    Expects: { "device_ids": [1, 2, 3] }
    Returns counts of deleted/failed.
    """
    data = request.get_json()
    if not data or not isinstance(data.get('device_ids'), list):
        return jsonify({'error': 'device_ids (list) is required'}), 400

    device_ids = data['device_ids']
    if not device_ids:
        return jsonify({'error': 'device_ids cannot be empty'}), 400

    deleted = 0
    failed = 0
    errors = []

    for device_id in device_ids:
        try:
            device = InfraSmarthomeDevice.query.get(device_id)
            if not device:
                errors.append(f'Device {device_id} not found')
                failed += 1
                continue
            db.session.delete(device)
            deleted += 1
        except Exception as e:
            errors.append(f'Device {device_id}: {str(e)}')
            failed += 1

    db.session.commit()
    result = {'deleted': deleted, 'failed': failed}
    if errors:
        result['errors'] = errors
    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — DISCOVERY & SYNC
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/discover', methods=['GET'])
def discover_smarthome_entities():
    """
    Fetch all HA entities via the configured HomeAssistant integration,
    group by domain, and mark which ones are already registered.
    ?integration_id=1 (optional — uses first HA integration if omitted)
    """
    import requests as http_requests

    integration_id = request.args.get('integration_id')

    if integration_id:
        integration = InfraIntegrationConfig.query.get_or_404(int(integration_id))
    else:
        integration = InfraIntegrationConfig.query.filter_by(
            integration_type='homeassistant',
            is_enabled=True,
        ).first()

    if not integration:
        return jsonify({'error': 'No HomeAssistant integration configured. Add one in Infrastructure > Integrations.'}), 404

    # Fetch all states from HA
    config = integration.config or {}
    base_url = config.get('url', '').rstrip('/')
    token = config.get('token', '')

    if not base_url or not token:
        return jsonify({'error': 'HomeAssistant URL or token not configured'}), 400

    try:
        resp = http_requests.get(
            f'{base_url}/api/states',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            timeout=30,
        )
        resp.raise_for_status()
        states = resp.json()
    except http_requests.exceptions.ConnectionError:
        return jsonify({'error': 'Cannot connect to HomeAssistant'}), 502
    except Exception as e:
        return jsonify({'error': f'Failed to fetch HA states: {str(e)}'}), 500

    # Get already-registered entity IDs for this integration
    registered = {d.entity_id for d in InfraSmarthomeDevice.query.filter_by(
        integration_config_id=integration.id
    ).all()}

    # Group by domain
    by_domain = {}
    for entity in states:
        entity_id = entity.get('entity_id', '')
        domain = entity_id.split('.')[0] if '.' in entity_id else 'unknown'
        attrs = entity.get('attributes', {})

        if domain not in by_domain:
            by_domain[domain] = []

        by_domain[domain].append({
            'entity_id': entity_id,
            'friendly_name': attrs.get('friendly_name', entity_id),
            'state': entity.get('state'),
            'domain': domain,
            'device_class': attrs.get('device_class'),
            'unit_of_measurement': attrs.get('unit_of_measurement'),
            'is_registered': entity_id in registered,
        })

    # Sort entities within each domain by friendly name
    for domain in by_domain:
        by_domain[domain].sort(key=lambda e: e.get('friendly_name', '').lower())

    return jsonify({
        'integration_id': integration.id,
        'integration_name': integration.name,
        'total_entities': len(states),
        'registered_count': len(registered),
        'domains': by_domain,
    })


@infrastructure_bp.route('/smarthome/sync', methods=['POST'])
def sync_smarthome_devices():
    """
    Force refresh cached states for all registered smart home devices.
    Fetches current states from HA and updates last_state/last_attributes.
    """
    import requests as http_requests

    devices = InfraSmarthomeDevice.query.all()
    if not devices:
        return jsonify({'message': 'No devices registered', 'updated': 0}), 200

    # Group devices by integration
    by_integration = {}
    for d in devices:
        by_integration.setdefault(d.integration_config_id, []).append(d)

    updated = 0
    errors = []

    for config_id, device_list in by_integration.items():
        integration = InfraIntegrationConfig.query.get(config_id)
        if not integration or not integration.is_enabled:
            continue

        config = integration.config or {}
        base_url = config.get('url', '').rstrip('/')
        token = config.get('token', '')

        if not base_url or not token:
            errors.append(f'Integration {config_id}: missing URL or token')
            continue

        try:
            resp = http_requests.get(
                f'{base_url}/api/states',
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                timeout=30,
            )
            resp.raise_for_status()
            states = {s['entity_id']: s for s in resp.json()}
        except Exception as e:
            errors.append(f'Integration {config_id}: {str(e)}')
            continue

        now = datetime.now(timezone.utc)
        for device in device_list:
            state_data = states.get(device.entity_id)
            if state_data:
                device.last_state = state_data.get('state')
                device.last_attributes = state_data.get('attributes', {})
                device.last_updated_at = now
                updated += 1

    db.session.commit()
    result = {'updated': updated, 'total': len(devices)}
    if errors:
        result['errors'] = errors
    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — DASHBOARD
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/dashboard', methods=['GET'])
def get_smarthome_dashboard():
    """
    Rooms with nested devices and cached states.
    Returns rooms ordered by sort_order, each with its devices.
    Includes an "unassigned" group for roomless devices.
    """
    rooms = InfraSmarthomeRoom.query.order_by(InfraSmarthomeRoom.sort_order, InfraSmarthomeRoom.name).all()
    unassigned = InfraSmarthomeDevice.query.filter_by(room_id=None, is_visible=True).order_by(
        InfraSmarthomeDevice.sort_order, InfraSmarthomeDevice.friendly_name
    ).all()

    result = {
        'rooms': [],
        'unassigned': [d.to_dict() for d in unassigned],
        'total_devices': InfraSmarthomeDevice.query.count(),
        'visible_devices': InfraSmarthomeDevice.query.filter_by(is_visible=True).count(),
    }

    for room in rooms:
        visible_devices = [d for d in room.devices if d.is_visible]
        visible_devices.sort(key=lambda d: (d.sort_order, d.friendly_name or ''))
        result['rooms'].append({
            **room.to_dict(),
            'devices': [d.to_dict() for d in visible_devices],
        })

    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — DEVICE CONTROL
# ══════════════════════════════════════════════════════════════════════

# Mapping of domain -> allowed actions -> HA service name
DOMAIN_SERVICES = {
    'light':        {'toggle': 'toggle', 'turn_on': 'turn_on', 'turn_off': 'turn_off'},
    'switch':       {'toggle': 'toggle', 'turn_on': 'turn_on', 'turn_off': 'turn_off'},
    'fan':          {'toggle': 'toggle', 'turn_on': 'turn_on', 'turn_off': 'turn_off',
                     'set_percentage': 'set_percentage'},
    'lock':         {'lock': 'lock', 'unlock': 'unlock'},
    'cover':        {'open_cover': 'open_cover', 'close_cover': 'close_cover', 'stop_cover': 'stop_cover'},
    'climate':      {'set_temperature': 'set_temperature'},
    'media_player': {'media_play_pause': 'media_play_pause', 'volume_set': 'volume_set'},
    'button':       {'press': 'press'},
    'number':       {'set_value': 'set_value'},
}


@infrastructure_bp.route('/smarthome/devices/<int:device_id>/control', methods=['POST'])
def control_smarthome_device(device_id):
    """
    Control a smart home device via HomeAssistant service calls.

    Request body:
      {"action": "toggle"}              — for light/switch/fan
      {"action": "lock"} / {"action": "unlock"}  — for locks
      {"action": "set_temperature", "temperature": 72}  — for climate
    """
    import requests as http_requests

    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    data = request.get_json() or {}
    action = data.get('action')

    if not action:
        return jsonify({'error': 'action is required'}), 400

    domain = device.domain
    if not domain:
        return jsonify({'error': 'Device has no domain set'}), 400

    # Check if this domain/action combo is valid
    allowed = DOMAIN_SERVICES.get(domain)
    if not allowed:
        return jsonify({'error': f'Domain "{domain}" does not support control actions'}), 400

    service = allowed.get(action)
    if not service:
        return jsonify({'error': f'Action "{action}" not supported for domain "{domain}". '
                        f'Allowed: {list(allowed.keys())}'}), 400

    # Get HA integration config
    integration = InfraIntegrationConfig.query.get(device.integration_config_id)
    if not integration:
        return jsonify({'error': 'Integration not found'}), 404

    config = integration.config or {}
    base_url = config.get('url', '').rstrip('/')
    token = config.get('token', '')

    if not base_url or not token:
        return jsonify({'error': 'HomeAssistant URL or token not configured'}), 400

    # Build HA service call payload
    service_data = {'entity_id': device.entity_id}

    # Add extra parameters for specific actions
    if action == 'set_temperature' and 'temperature' in data:
        service_data['temperature'] = data['temperature']
    if action == 'volume_set' and 'volume_level' in data:
        service_data['volume_level'] = data['volume_level']
    if action == 'set_percentage' and 'percentage' in data:
        service_data['percentage'] = data['percentage']
    if action == 'set_value' and 'value' in data:
        service_data['value'] = data['value']

    try:
        resp = http_requests.post(
            f'{base_url}/api/services/{domain}/{service}',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=service_data,
            timeout=10,
        )
        resp.raise_for_status()
    except http_requests.exceptions.ConnectionError:
        return jsonify({'error': 'Cannot connect to HomeAssistant'}), 502
    except http_requests.exceptions.HTTPError as e:
        return jsonify({'error': f'HA returned error: {e.response.status_code}'}), 502
    except Exception as e:
        return jsonify({'error': f'Service call failed: {str(e)}'}), 500

    # HA service call returns the updated state(s) — refresh device cache
    try:
        states = resp.json()
        if isinstance(states, list):
            for s in states:
                if s.get('entity_id') == device.entity_id:
                    device.last_state = s.get('state')
                    device.last_attributes = s.get('attributes', {})
                    device.last_updated_at = datetime.now(timezone.utc)
                    break
    except Exception:
        pass  # Response parsing is best-effort

    db.session.commit()
    return jsonify(device.to_dict())


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — FAVORITES
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/favorites', methods=['GET'])
def list_smarthome_favorites():
    """Get all favorited smart home devices with cached state."""
    devices = InfraSmarthomeDevice.query.filter_by(
        is_favorited=True,
    ).order_by(
        InfraSmarthomeDevice.sort_order,
        InfraSmarthomeDevice.friendly_name,
    ).all()
    return jsonify([d.to_dict() for d in devices])


@infrastructure_bp.route('/smarthome/devices/<int:device_id>/favorite', methods=['PUT'])
def toggle_smarthome_favorite(device_id):
    """Toggle the is_favorited flag on a smart home device."""
    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    data = request.get_json() or {}

    # Allow explicit set or toggle
    if 'is_favorited' in data:
        device.is_favorited = bool(data['is_favorited'])
    else:
        device.is_favorited = not device.is_favorited

    db.session.commit()
    return jsonify(device.to_dict())


# ══════════════════════════════════════════════════════════════════════
#  3D PRINTER
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/printer/status', methods=['GET'])
def get_printer_status():
    """
    Get one entry per physical printer.

    Multiple entities can have category='printer' (e.g. all 50+ K2 Plus
    entities). We group them by their entity prefix and return the best
    representative per group — preferring the _print_status sensor, then
    the lowest-ID device as a fallback. This prevents the UI from showing
    50 printer-selector buttons.
    """
    printers = InfraSmarthomeDevice.query.filter_by(category='printer').order_by(
        InfraSmarthomeDevice.id
    ).all()

    if not printers:
        return jsonify([])

    # Group devices by derived entity prefix
    groups = {}  # prefix -> list of devices
    for p in printers:
        bare = p.entity_id.split('.', 1)[1] if '.' in p.entity_id else p.entity_id
        prefix = (p.config or {}).get('entity_prefix')
        if not prefix:
            # Auto-detect prefix using K2_ROLE_MAP suffixes
            for suffix in K2_ROLE_MAP:
                suffix_bare = suffix.lstrip('_')
                if bare.endswith(suffix_bare):
                    prefix = bare[:len(bare) - len(suffix_bare)].rstrip('_')
                    break
            if not prefix:
                # Fallback: everything before the last underscore
                prefix = bare.rsplit('_', 1)[0] if '_' in bare else bare
        groups.setdefault(prefix, []).append(p)

    # Pick the best representative per group
    result = []
    for prefix, devices in groups.items():
        # Prefer _print_status sensor, then lowest ID
        primary = None
        for d in devices:
            if d.entity_id.endswith('_print_status'):
                primary = d
                break
        if not primary:
            primary = devices[0]

        data = primary.to_dict()
        active_job = InfraPrinterJob.query.filter_by(
            device_id=primary.id, status='printing'
        ).first()
        data['active_job'] = active_job.to_dict() if active_job else None
        result.append(data)

    return jsonify(result)


@infrastructure_bp.route('/printer/<int:device_id>/current', methods=['GET'])
def get_printer_current(device_id):
    """
    Get the current state of a printer: active job + live temperatures.
    Assembles a unified view from the printer device and its related
    smart home entity states (via config.printer_entities mapping).
    """
    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    if device.category != 'printer':
        return jsonify({'error': 'Device is not a printer'}), 400

    # Get active job
    active_job = InfraPrinterJob.query.filter_by(
        device_id=device_id, status='printing'
    ).first()

    # Build temperature readings from related entities' cached states
    printer_entities = device.config.get('printer_entities', {})
    temps = {}
    for role, entity_id in printer_entities.items():
        if role in ('nozzle_temp', 'bed_temp', 'chamber_temp'):
            # Look up the related smart home device by entity_id
            related = InfraSmarthomeDevice.query.filter_by(
                integration_config_id=device.integration_config_id,
                entity_id=entity_id,
            ).first()
            if related and related.last_state:
                try:
                    temps[role] = float(related.last_state)
                except (ValueError, TypeError):
                    temps[role] = None

    return jsonify({
        'device': device.to_dict(),
        'active_job': active_job.to_dict() if active_job else None,
        'temperatures': temps,
        'printer_entities': printer_entities,
    })


@infrastructure_bp.route('/printer/<int:device_id>/jobs', methods=['GET'])
def list_printer_jobs(device_id):
    """
    Get print job history for a printer device.
      ?limit=20 (default)
      ?status=completed (optional filter)
    """
    InfraSmarthomeDevice.query.get_or_404(device_id)

    limit = min(int(request.args.get('limit', 20)), 100)
    query = InfraPrinterJob.query.filter_by(device_id=device_id)

    if request.args.get('status'):
        query = query.filter_by(status=request.args['status'])

    jobs = query.order_by(InfraPrinterJob.started_at.desc()).limit(limit).all()
    return jsonify([j.to_dict() for j in jobs])


@infrastructure_bp.route('/printer/<int:device_id>/jobs/<int:job_id>', methods=['GET'])
def get_printer_job(device_id, job_id):
    """Get a single print job detail."""
    job = InfraPrinterJob.query.filter_by(id=job_id, device_id=device_id).first_or_404()
    return jsonify(job.to_dict())


@infrastructure_bp.route('/printer/<int:device_id>/metrics', methods=['GET'])
def get_printer_metrics(device_id):
    """
    Get temperature metrics for a printer device.
      ?hours=24 (default)
    """
    InfraSmarthomeDevice.query.get_or_404(device_id)

    hours = int(request.args.get('hours', 24))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Get metrics for all entities related to this printer
    device = InfraSmarthomeDevice.query.get(device_id)
    printer_entities = device.config.get('printer_entities', {})

    # Collect source IDs for temp-related entities
    source_ids = [device_id]
    for role, entity_id in printer_entities.items():
        if role in ('nozzle_temp', 'bed_temp', 'chamber_temp'):
            related = InfraSmarthomeDevice.query.filter_by(
                integration_config_id=device.integration_config_id,
                entity_id=entity_id,
            ).first()
            if related:
                source_ids.append(related.id)

    metrics = InfraMetric.query.filter(
        InfraMetric.source_type == 'smarthome',
        InfraMetric.source_id.in_(source_ids),
        InfraMetric.recorded_at >= since,
    ).order_by(InfraMetric.recorded_at.desc()).limit(2000).all()

    return jsonify([m.to_dict() for m in metrics])


# ══════════════════════════════════════════════════════════════════════
#  K2 PLUS — DEDICATED PRINTER DASHBOARD
# ══════════════════════════════════════════════════════════════════════

# Role mappings: entity_id suffix -> semantic role
# The K2 Plus exposes 50+ entities; we map known suffixes to roles.
K2_ROLE_MAP = {
    # Buttons (require importing button.* entities from HA)
    '_home':                ('button', 'home'),            # Bambu Lab naming
    '_home_xy_then_z':      ('button', 'home'),            # Creality naming
    '_pause_print':         ('button', 'pause'),
    '_resume_print':        ('button', 'resume'),
    '_stop_print':          ('button', 'stop'),
    # Numbers (require importing number.* entities from HA)
    '_nozzle_target_temperature':  ('number', 'nozzle_target'),  # Bambu Lab
    '_hot_bed_target_temperature': ('number', 'bed_target'),     # Bambu Lab
    '_target_chamber_temperature': ('number', 'chamber_target'), # Bambu Lab
    '_nozzle_target':              ('number', 'nozzle_target'),  # Creality
    '_bed_target':                 ('number', 'bed_target'),     # Creality
    '_chamber_target':             ('number', 'chamber_target'), # Creality
    # Light (requires importing light.* entities from HA)
    '_led':             ('light', 'chamber_light'),        # Bambu Lab
    '_light':           ('light', 'chamber_light'),        # Creality
    # Fans (require importing fan.* entities from HA)
    '_case_fan_speed':      ('fan', 'case_fan'),           # Bambu Lab
    '_auxiliary_fan_speed': ('fan', 'aux_fan'),             # Bambu Lab
    '_chamber_fan_speed':   ('fan', 'chamber_fan'),        # Bambu Lab
    '_case_fan':            ('fan', 'case_fan'),           # Creality
    '_side_fan':            ('fan', 'aux_fan'),            # Creality
    '_model_fan':           ('fan', 'chamber_fan'),        # Creality
    # Temperatures (sensors)
    '_nozzle_temperature':  ('sensor', 'nozzle_temp'),
    '_hotbed_temperature':  ('sensor', 'bed_temp'),       # Bambu Lab naming
    '_bed_temperature':     ('sensor', 'bed_temp'),        # Creality alt naming
    '_chamber_temperature': ('sensor', 'chamber_temp'),
    # Max temperatures (used for gauge scales)
    '_max_nozzle_temperature':  ('sensor', 'max_nozzle_temp'),
    '_max_bed_temperature':     ('sensor', 'max_bed_temp'),
    '_max_chamber_temperature': ('sensor', 'max_chamber_temp'),
    # Print status sensors
    '_print_status':        ('sensor', 'print_status'),
    '_print_progress':      ('sensor', 'print_progress'),
    '_printing_file_name':  ('sensor', 'filename'),
    '_print_job_time':      ('sensor', 'job_time'),
    '_remaining_time':      ('sensor', 'time_remaining'),  # Bambu Lab naming
    '_print_time_left':     ('sensor', 'time_remaining'),  # Creality naming
    '_print_speed':         ('sensor', 'speed'),
    '_flow_rate':           ('sensor', 'flow_rate'),
    '_real_time_flow':      ('sensor', 'real_time_flow'),
    '_current_print_object': ('sensor', 'current_object'), # Bambu Lab naming
    '_current_object':       ('sensor', 'current_object'), # Creality naming
    '_object_count':        ('sensor', 'object_count'),
    '_print_control':       ('sensor', 'print_control'),
    # Position
    '_x_axis':              ('sensor', 'pos_x'),           # Bambu Lab naming
    '_y_axis':              ('sensor', 'pos_y'),
    '_z_axis':              ('sensor', 'pos_z'),
    '_position_x':          ('sensor', 'pos_x'),           # Creality naming
    '_position_y':          ('sensor', 'pos_y'),
    '_position_z':          ('sensor', 'pos_z'),
    # Layers
    '_working_layer':       ('sensor', 'layer_current'),
    '_total_layers':        ('sensor', 'layer_total'),
    '_material_used':       ('sensor', 'material_used'),       # Bambu Lab naming
    '_used_material_length': ('sensor', 'material_used'),      # Creality naming
    # CFS (filament system) — Bambu Lab naming
    '_cfs_filament_1_color':   ('sensor', 'cfs_slot_1_color'),
    '_cfs_filament_2_color':   ('sensor', 'cfs_slot_2_color'),
    '_cfs_filament_3_color':   ('sensor', 'cfs_slot_3_color'),
    '_cfs_filament_4_color':   ('sensor', 'cfs_slot_4_color'),
    '_cfs_filament_1_material_type': ('sensor', 'cfs_slot_1_type'),
    '_cfs_filament_2_material_type': ('sensor', 'cfs_slot_2_type'),
    '_cfs_filament_3_material_type': ('sensor', 'cfs_slot_3_type'),
    '_cfs_filament_4_material_type': ('sensor', 'cfs_slot_4_type'),
    '_cfs_filament_1_material_name': ('sensor', 'cfs_slot_1_name'),
    '_cfs_filament_2_material_name': ('sensor', 'cfs_slot_2_name'),
    '_cfs_filament_3_material_name': ('sensor', 'cfs_slot_3_name'),
    '_cfs_filament_4_material_name': ('sensor', 'cfs_slot_4_name'),
    '_cfs_filament_1_remaining': ('sensor', 'cfs_slot_1_remaining'),
    '_cfs_filament_2_remaining': ('sensor', 'cfs_slot_2_remaining'),
    '_cfs_filament_3_remaining': ('sensor', 'cfs_slot_3_remaining'),
    '_cfs_filament_4_remaining': ('sensor', 'cfs_slot_4_remaining'),
    # CFS (filament system) — Creality naming (cfs_box_1_slot_N)
    '_cfs_box_1_slot_1_color':    ('sensor', 'cfs_slot_1_color'),
    '_cfs_box_1_slot_2_color':    ('sensor', 'cfs_slot_2_color'),
    '_cfs_box_1_slot_3_color':    ('sensor', 'cfs_slot_3_color'),
    '_cfs_box_1_slot_4_color':    ('sensor', 'cfs_slot_4_color'),
    '_cfs_box_1_slot_1_filament': ('sensor', 'cfs_slot_1_name'),
    '_cfs_box_1_slot_2_filament': ('sensor', 'cfs_slot_2_name'),
    '_cfs_box_1_slot_3_filament': ('sensor', 'cfs_slot_3_name'),
    '_cfs_box_1_slot_4_filament': ('sensor', 'cfs_slot_4_name'),
    '_cfs_box_1_slot_1_percent':  ('sensor', 'cfs_slot_1_remaining'),
    '_cfs_box_1_slot_2_percent':  ('sensor', 'cfs_slot_2_remaining'),
    '_cfs_box_1_slot_3_percent':  ('sensor', 'cfs_slot_3_remaining'),
    '_cfs_box_1_slot_4_percent':  ('sensor', 'cfs_slot_4_remaining'),
    # External filament — Bambu Lab naming
    '_external_filament_color':        ('sensor', 'ext_color'),
    '_external_filament_material_type': ('sensor', 'ext_type'),
    '_external_filament_material_name': ('sensor', 'ext_name'),
    '_external_filament_remaining':     ('sensor', 'ext_remaining'),
    # External filament — Creality naming
    '_cfs_external_color':    ('sensor', 'ext_color'),
    '_cfs_external_filament': ('sensor', 'ext_name'),
    '_cfs_external_percent':  ('sensor', 'ext_remaining'),
    # CFS system status
    '_cfs_status':          ('sensor', 'cfs_status'),          # Bambu Lab
    '_filament_status':     ('sensor', 'cfs_status'),          # Creality
    '_cfs_humidity':            ('sensor', 'cfs_humidity'),       # Bambu Lab
    '_cfs_box_1_humidity':      ('sensor', 'cfs_humidity'),       # Creality
    '_cfs_temperature':         ('sensor', 'cfs_temp'),           # Bambu Lab
    '_cfs_box_1_temp':          ('sensor', 'cfs_temp'),           # Creality
    # Camera (requires importing camera.* entities from HA)
    '_camera':              ('camera', 'camera'),            # Bambu Lab
    '_printer_camera':      ('camera', 'camera'),            # Creality
}


def _get_float(val, default=None):
    """Safely parse a float from a string state value."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


@infrastructure_bp.route('/printer/<int:device_id>/k2plus', methods=['GET'])
def get_k2plus_data(device_id):
    """
    Aggregated K2 Plus dashboard data.

    Finds all registered entities matching the printer's entity_id prefix,
    maps them to semantic roles, and returns a structured response with
    temperatures, controls, filament, position, and print status.
    """
    device = InfraSmarthomeDevice.query.get_or_404(device_id)
    if device.category != 'printer':
        return jsonify({'error': 'Device is not a printer'}), 400

    # Derive the entity prefix from the printer's entity_id
    # e.g., "sensor.k2plus_print_status" -> "k2plus"
    entity_id = device.entity_id
    # Strip the domain prefix (sensor., switch., etc.)
    bare = entity_id.split('.', 1)[1] if '.' in entity_id else entity_id
    # Use a configured prefix, or auto-detect from known suffixes
    prefix = (device.config or {}).get('entity_prefix')
    if not prefix:
        for suffix in K2_ROLE_MAP:
            if bare.endswith(suffix.lstrip('_')):
                prefix = bare[:len(bare) - len(suffix.lstrip('_'))].rstrip('_')
                break
        if not prefix:
            prefix = bare.rsplit('_', 1)[0] if '_' in bare else bare

    # Find all entities from the same integration
    all_devices = InfraSmarthomeDevice.query.filter_by(
        integration_config_id=device.integration_config_id,
    ).all()

    # Build role -> device mapping
    role_map = {}
    for d in all_devices:
        d_bare = d.entity_id.split('.', 1)[1] if '.' in d.entity_id else d.entity_id
        for suffix, (expected_domain, role) in K2_ROLE_MAP.items():
            if d_bare == prefix + suffix:
                role_map[role] = d
                break

    # Helper to get value from a role
    def val(role):
        d = role_map.get(role)
        return d.last_state if d else None

    def fval(role, default=None):
        return _get_float(val(role), default)

    def dev_dict(role):
        d = role_map.get(role)
        if not d:
            return None
        return {
            'id': d.id, 'entity_id': d.entity_id,
            'state': d.last_state,
            'attributes': d.last_attributes or {},
        }

    # Get active job
    active_job = InfraPrinterJob.query.filter_by(
        device_id=device_id, status='printing'
    ).first()

    # Build number/target info with min/max from attributes
    def number_info(role):
        d = role_map.get(role)
        if not d:
            return None
        a = d.last_attributes or {}
        return {
            'id': d.id, 'entity_id': d.entity_id, 'role': role,
            'last_state': d.last_state,
            'min': _get_float(a.get('min'), 0),
            'max': _get_float(a.get('max'), 0),
            'step': _get_float(a.get('step'), 1),
        }

    def fan_info(role):
        d = role_map.get(role)
        if not d:
            return None
        a = d.last_attributes or {}
        return {
            'id': d.id, 'entity_id': d.entity_id, 'role': role,
            'state': d.last_state,
            'percentage': _get_float(a.get('percentage'), 0),
        }

    def button_info(role):
        d = role_map.get(role)
        if not d:
            return None
        return {
            'id': d.id, 'entity_id': d.entity_id, 'role': role,
            'state': d.last_state,
        }

    # Build CFS slot data
    slots = []
    for i in range(1, 5):
        slot = {
            'slot': i,
            'color': val(f'cfs_slot_{i}_color') or '#333333',
            'type': val(f'cfs_slot_{i}_type') or 'Unknown',
            'name': val(f'cfs_slot_{i}_name') or 'Empty',
            'percent': fval(f'cfs_slot_{i}_remaining', 0),
        }
        slots.append(slot)

    external = {
        'color': val('ext_color') or '#333333',
        'type': val('ext_type') or 'Unknown',
        'name': val('ext_name') or 'Empty',
        'percent': fval('ext_remaining', 0),
    }

    nozzle_target_info = number_info('nozzle_target')
    bed_target_info = number_info('bed_target')
    chamber_target_info = number_info('chamber_target')

    # Extract temperature unit from the nozzle sensor (all temps share the same unit)
    def temp_unit():
        for role in ('nozzle_temp', 'bed_temp', 'chamber_temp'):
            d = role_map.get(role)
            if d and d.last_attributes:
                u = (d.last_attributes or {}).get('unit_of_measurement', '')
                if u:
                    return u
        return '\u00b0C'  # default to °C

    # Use max temp sensors for gauge scales when available, otherwise use
    # the target control's max, otherwise a sensible default
    def max_temp(max_sensor_role, target_info, default):
        sensor_max = fval(max_sensor_role)
        if sensor_max is not None and sensor_max > 0:
            return sensor_max
        if target_info and target_info['max'] > 0:
            return target_info['max']
        return default

    result = {
        'device': device.to_dict(),
        'active_job': active_job.to_dict() if active_job else None,
        'camera': dev_dict('camera'),
        'controls': {
            'buttons': [b for b in [
                button_info('home'),
                button_info('pause'),
                button_info('resume'),
                button_info('stop'),
            ] if b],
            'numbers': [n for n in [
                nozzle_target_info,
                bed_target_info,
                chamber_target_info,
            ] if n],
            'light': dev_dict('chamber_light'),
            'fans': [f for f in [
                fan_info('case_fan'),
                fan_info('aux_fan'),
                fan_info('chamber_fan'),
            ] if f],
        },
        'temp_unit': temp_unit(),
        'temperatures': {
            'nozzle': {
                'current': fval('nozzle_temp'),
                'target': _get_float(nozzle_target_info['last_state']) if nozzle_target_info else None,
                'max': max_temp('max_nozzle_temp', nozzle_target_info, 350),
            },
            'bed': {
                'current': fval('bed_temp'),
                'target': _get_float(bed_target_info['last_state']) if bed_target_info else None,
                'max': max_temp('max_bed_temp', bed_target_info, 120),
            },
            'chamber': {
                'current': fval('chamber_temp'),
                'target': _get_float(chamber_target_info['last_state']) if chamber_target_info else None,
                'max': max_temp('max_chamber_temp', chamber_target_info, 60),
            },
        },
        'filament': {
            'status': val('cfs_status') or 'Unknown',
            'slots': slots,
            'external': external,
            'humidity': fval('cfs_humidity'),
            'temp': fval('cfs_temp'),
        },
        'print_status': {
            'status': val('print_status') or 'idle',
            'progress': fval('print_progress', 0),
            'filename': val('filename') or '',
            'job_time': fval('job_time', 0),
            'time_left': fval('time_remaining', 0),
            'speed': fval('speed', 100),
            'flow_rate': fval('flow_rate', 100),
            'real_time_flow': fval('real_time_flow', 0),
            'current_object': val('current_object') or '',
            'object_count': fval('object_count', 0),
        },
        'position': {
            'x': fval('pos_x', 0),
            'y': fval('pos_y', 0),
            'z': fval('pos_z', 0),
        },
        'layers': {
            'working': fval('layer_current', 0),
            'total': fval('layer_total', 0),
            'material_used': fval('material_used', 0),
        },
    }

    return jsonify(result)


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — CAMERA PROXY
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/camera/<int:device_id>/stream', methods=['GET'])
def proxy_camera_stream(device_id):
    """
    Proxy HA's MJPEG camera stream to the frontend.

    Streams the response directly so the frontend can use it in an <img> tag.
    The device must have a known HA integration.
    """
    import requests as http_requests
    from flask import Response

    device = InfraSmarthomeDevice.query.get_or_404(device_id)

    integration = InfraIntegrationConfig.query.get(device.integration_config_id)
    if not integration:
        return jsonify({'error': 'Integration not found'}), 404

    config = integration.config or {}
    base_url = config.get('url', '').rstrip('/')
    token = config.get('token', '')

    if not base_url or not token:
        return jsonify({'error': 'HomeAssistant URL or token not configured'}), 400

    entity_id = device.entity_id
    stream_url = f'{base_url}/api/camera_proxy_stream/{entity_id}'

    try:
        resp = http_requests.get(
            stream_url,
            headers={'Authorization': f'Bearer {token}'},
            stream=True,
            timeout=10,
        )
        resp.raise_for_status()
    except http_requests.exceptions.ConnectionError:
        return jsonify({'error': 'Cannot connect to HomeAssistant'}), 502
    except http_requests.exceptions.HTTPError as e:
        return jsonify({'error': f'HA returned error: {e.response.status_code}'}), 502
    except Exception as e:
        return jsonify({'error': f'Camera stream failed: {str(e)}'}), 500

    content_type = resp.headers.get('Content-Type', 'multipart/x-mixed-replace')

    def generate():
        try:
            for chunk in resp.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
        except GeneratorExit:
            resp.close()
        except Exception:
            resp.close()

    return Response(generate(), content_type=content_type)


# ══════════════════════════════════════════════════════════════════════
#  SMART HOME — SSE (Server-Sent Events) STREAM
# ══════════════════════════════════════════════════════════════════════

@infrastructure_bp.route('/smarthome/stream', methods=['GET'])
def smarthome_sse_stream():
    """
    Server-Sent Events endpoint for real-time smart home state updates.

    The HA WebSocket client pushes state_changed events into subscriber
    queues. This endpoint yields those events as SSE messages. Sends a
    heartbeat comment every 30s to keep the connection alive.

    Usage: const es = new EventSource('/api/infrastructure/smarthome/stream')
    """
    from flask import Response, current_app

    ws_client = current_app.ha_ws_client if hasattr(current_app, 'ha_ws_client') else None
    if not ws_client:
        return jsonify({'error': 'WebSocket client not running'}), 503

    q = ws_client.subscribe()

    def generate():
        import json as _json
        try:
            while True:
                try:
                    event = q.get(timeout=30)
                    yield f"data: {_json.dumps(event)}\n\n"
                except Exception:
                    # Timeout — send heartbeat comment to keep connection alive
                    yield ": heartbeat\n\n"
        except GeneratorExit:
            pass
        finally:
            ws_client.unsubscribe(q)

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )
