"""
Docker Integration

Connects to a Docker daemon via Unix socket or TCP API to discover
and monitor containers. Syncs container state to infra_containers
and records resource metrics to infra_metrics.

Requires the `docker` Python package (pip install docker>=7.0.0).
For local Docker, mount the socket: /var/run/docker.sock:/var/run/docker.sock
"""
import logging
from datetime import datetime, timezone

from app.services.infrastructure.base import BaseIntegration

logger = logging.getLogger(__name__)


class DockerIntegration(BaseIntegration):
    """
    Docker daemon integration via socket or TCP.

    Config fields:
        connection_type: 'socket' or 'tcp'
        socket_path: Path to Docker socket (default: /var/run/docker.sock)
        tcp_url: TCP URL for remote Docker (e.g., tcp://192.168.1.10:2375)
        tls_verify: Whether to verify TLS for TCP connections
        sync_stats: Whether to collect CPU/memory stats (default: true)
    """

    def _get_client(self):
        """
        Create a Docker client based on the config.

        Returns:
            docker.DockerClient instance

        Raises:
            ImportError: If docker package is not installed.
            docker.errors.DockerException: If connection fails.
        """
        import docker

        connection_type = self.config.get('connection_type', 'socket')

        if connection_type == 'tcp':
            tcp_url = self.config.get('tcp_url', 'tcp://localhost:2375')
            tls_verify = self.config.get('tls_verify', False)
            return docker.DockerClient(base_url=tcp_url, tls=tls_verify, timeout=10)
        else:
            socket_path = self.config.get('socket_path', 'unix:///var/run/docker.sock')
            # Ensure the path has the unix:// prefix
            if not socket_path.startswith('unix://'):
                socket_path = f'unix://{socket_path}'
            return docker.DockerClient(base_url=socket_path, timeout=10)

    def test_connection(self):
        """
        Test Docker daemon connectivity by calling ping().

        Returns:
            dict: {'success': True/False, 'message': '...', 'version': '...'}
        """
        try:
            client = self._get_client()
            client.ping()
            version_info = client.version()
            client.close()
            return {
                'success': True,
                'message': f"Connected to Docker {version_info.get('Version', 'unknown')}",
                'version': version_info.get('Version'),
                'api_version': version_info.get('ApiVersion'),
            }
        except ImportError:
            return {
                'success': False,
                'message': 'Docker Python package is not installed. Run: pip install docker>=7.0.0',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
            }

    def sync(self):
        """
        Pull container list from Docker and upsert into infra_containers.
        Optionally collects CPU/memory stats and records to infra_metrics.
        Detects status changes and emits notification events.

        Returns:
            dict: Sync results with counts.
        """
        from app import db
        from app.models.infrastructure import InfraContainer, InfraMetric
        from app.services.event_bus import emit

        if not self.host_id:
            return {'success': False, 'error': 'No host_id associated with this integration'}

        client = self._get_client()
        now = datetime.now(timezone.utc)
        sync_stats = self.config.get('sync_stats', True)

        try:
            docker_containers = client.containers.list(all=True)
        except Exception as e:
            client.close()
            raise RuntimeError(f"Failed to list containers: {e}")

        # Build a map of existing DB containers by docker container_id
        existing = {
            c.container_id: c
            for c in InfraContainer.query.filter_by(host_id=self.host_id).all()
            if c.container_id
        }

        synced_ids = set()
        created_count = 0
        updated_count = 0
        status_changes = []

        for dc in docker_containers:
            short_id = dc.short_id  # 12-char Docker ID
            synced_ids.add(short_id)

            # Extract container info
            labels = dc.labels or {}
            ports_config = self._parse_ports(dc.ports)
            mounts = self._parse_mounts(dc.attrs.get('Mounts', []))
            docker_status = dc.status  # running, exited, paused, etc.
            state_detail = dc.attrs.get('State', {}).get('Status', docker_status)

            # Compose project/service from labels (Docker Compose convention)
            compose_project = labels.get('com.docker.compose.project', '')
            compose_service = labels.get('com.docker.compose.service', '')

            # Parse started_at from Docker state
            started_str = dc.attrs.get('State', {}).get('StartedAt')
            started_at = None
            if started_str and not started_str.startswith('0001'):
                try:
                    # Docker returns ISO 8601 with nanoseconds — trim to microseconds
                    clean = started_str[:26].rstrip('Z') + '+00:00'
                    started_at = datetime.fromisoformat(clean)
                except (ValueError, IndexError):
                    pass

            db_container = existing.get(short_id)

            if db_container:
                # Update existing record
                old_status = db_container.status

                db_container.name = dc.name
                db_container.image = str(dc.image.tags[0]) if dc.image.tags else str(dc.image.id[:19])
                db_container.status = docker_status
                db_container.state = state_detail
                db_container.compose_project = compose_project
                db_container.compose_service = compose_service
                db_container.ports = ports_config
                db_container.volumes = mounts
                db_container.started_at = started_at
                db_container.updated_at = now

                updated_count += 1

                # Track status changes for notification events
                if old_status != docker_status:
                    status_changes.append({
                        'container_name': dc.name,
                        'old_status': old_status,
                        'new_status': docker_status,
                    })
            else:
                # Create new record
                new_container = InfraContainer(
                    host_id=self.host_id,
                    container_id=short_id,
                    name=dc.name,
                    image=str(dc.image.tags[0]) if dc.image.tags else str(dc.image.id[:19]),
                    status=docker_status,
                    state=state_detail,
                    compose_project=compose_project,
                    compose_service=compose_service,
                    ports=ports_config,
                    volumes=mounts,
                    started_at=started_at,
                    created_at=now,
                    updated_at=now,
                )
                db.session.add(new_container)
                created_count += 1

        # Collect resource stats for running containers
        metrics_count = 0
        if sync_stats:
            for dc in docker_containers:
                if dc.status != 'running':
                    continue
                try:
                    stats = dc.stats(stream=False)
                    cpu_percent = self._calc_cpu_percent(stats)
                    mem_usage, mem_limit = self._calc_memory(stats)

                    # Find the DB container to get its ID for metrics
                    db_container = existing.get(dc.short_id)
                    if not db_container:
                        # Might have just been created — flush to get IDs
                        db.session.flush()
                        db_container = InfraContainer.query.filter_by(
                            host_id=self.host_id,
                            container_id=dc.short_id,
                        ).first()

                    if db_container:
                        if cpu_percent is not None:
                            db.session.add(InfraMetric(
                                source_type='container',
                                source_id=db_container.id,
                                metric_name='cpu_percent',
                                value=round(cpu_percent, 2),
                                unit='%',
                                recorded_at=now,
                            ))
                            metrics_count += 1

                        if mem_usage is not None:
                            mem_mb = round(mem_usage / (1024 * 1024), 1)
                            db.session.add(InfraMetric(
                                source_type='container',
                                source_id=db_container.id,
                                metric_name='memory_mb',
                                value=mem_mb,
                                unit='MB',
                                recorded_at=now,
                            ))
                            metrics_count += 1

                            if mem_limit and mem_limit > 0:
                                mem_pct = round((mem_usage / mem_limit) * 100, 1)
                                db.session.add(InfraMetric(
                                    source_type='container',
                                    source_id=db_container.id,
                                    metric_name='memory_percent',
                                    value=mem_pct,
                                    unit='%',
                                    recorded_at=now,
                                ))
                                metrics_count += 1

                except Exception as e:
                    logger.warning(f"Failed to get stats for container '{dc.name}': {e}")

        # Remove stale containers that no longer exist in Docker
        # (e.g., after a reboot, containers get new IDs — old entries are orphans)
        removed_count = 0
        stale = []
        if synced_ids:
            stale = InfraContainer.query.filter(
                InfraContainer.host_id == self.host_id,
                ~InfraContainer.container_id.in_(synced_ids),
            ).all()
        for s in stale:
            # Also remove associated metrics to avoid orphaned data
            InfraMetric.query.filter_by(source_type='container', source_id=s.id).delete()
            db.session.delete(s)
            removed_count += 1

        db.session.commit()
        client.close()

        # Emit notification events for status changes
        for change in status_changes:
            if change['new_status'] in ('exited', 'dead'):
                emit('infra.container_stopped',
                     container_name=change['container_name'],
                     old_status=change['old_status'],
                     new_status=change['new_status'],
                     host_id=self.host_id)
            elif change['new_status'] == 'restarting':
                emit('infra.container_restarting',
                     container_name=change['container_name'],
                     host_id=self.host_id)

        return {
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'removed': removed_count,
            'metrics_recorded': metrics_count,
            'status_changes': len(status_changes),
            'total_containers': len(docker_containers),
        }

    def _parse_ports(self, ports_dict):
        """
        Parse Docker port bindings into a clean list.

        Args:
            ports_dict: Docker API ports dict, e.g.,
                {'80/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '8080'}]}

        Returns:
            list: [{'container_port': 80, 'host_port': 8080, 'protocol': 'tcp'}]
        """
        result = []
        if not ports_dict:
            return result

        for container_port_proto, bindings in ports_dict.items():
            parts = container_port_proto.split('/')
            container_port = int(parts[0]) if parts[0].isdigit() else parts[0]
            protocol = parts[1] if len(parts) > 1 else 'tcp'

            if bindings:
                for binding in bindings:
                    host_port = binding.get('HostPort')
                    result.append({
                        'container_port': container_port,
                        'host_port': int(host_port) if host_port and host_port.isdigit() else host_port,
                        'protocol': protocol,
                    })
            else:
                result.append({
                    'container_port': container_port,
                    'host_port': None,
                    'protocol': protocol,
                })

        return result

    def _parse_mounts(self, mounts_list):
        """
        Parse Docker mount info into a clean list.

        Args:
            mounts_list: Docker API Mounts list from container inspect.

        Returns:
            list: [{'source': '/host/path', 'destination': '/container/path', 'mode': 'rw'}]
        """
        result = []
        for mount in (mounts_list or []):
            result.append({
                'source': mount.get('Source', ''),
                'destination': mount.get('Destination', ''),
                'mode': mount.get('Mode', 'rw'),
                'type': mount.get('Type', 'bind'),
            })
        return result

    def _calc_cpu_percent(self, stats):
        """
        Calculate CPU usage percentage from Docker stats.

        Uses the same formula as `docker stats` CLI:
        cpu_delta / system_delta * num_cpus * 100

        Args:
            stats: Docker stats dict (stream=False).

        Returns:
            float or None: CPU percentage, or None if calculation fails.
        """
        try:
            cpu_stats = stats.get('cpu_stats', {})
            precpu_stats = stats.get('precpu_stats', {})

            cpu_delta = (
                cpu_stats.get('cpu_usage', {}).get('total_usage', 0) -
                precpu_stats.get('cpu_usage', {}).get('total_usage', 0)
            )
            system_delta = (
                cpu_stats.get('system_cpu_usage', 0) -
                precpu_stats.get('system_cpu_usage', 0)
            )

            if system_delta > 0 and cpu_delta >= 0:
                num_cpus = cpu_stats.get('online_cpus') or len(
                    cpu_stats.get('cpu_usage', {}).get('percpu_usage', [1])
                )
                return (cpu_delta / system_delta) * num_cpus * 100.0
        except (KeyError, TypeError, ZeroDivisionError):
            pass
        return None

    def _calc_memory(self, stats):
        """
        Extract memory usage and limit from Docker stats.

        Args:
            stats: Docker stats dict (stream=False).

        Returns:
            tuple: (usage_bytes, limit_bytes) or (None, None).
        """
        try:
            mem = stats.get('memory_stats', {})
            usage = mem.get('usage', 0)
            # Subtract cache for more accurate "real" usage
            cache = mem.get('stats', {}).get('cache', 0)
            limit = mem.get('limit', 0)
            return (usage - cache, limit)
        except (KeyError, TypeError):
            return (None, None)

    @staticmethod
    def get_config_schema():
        """Return the Docker integration config schema for the frontend form."""
        return {
            'type': 'docker',
            'label': 'Docker',
            'description': 'Connect to a Docker daemon to auto-discover and monitor containers.',
            'fields': [
                {
                    'name': 'connection_type',
                    'label': 'Connection Type',
                    'type': 'select',
                    'options': ['socket', 'tcp'],
                    'default': 'socket',
                    'help': 'Use "socket" for local Docker, "tcp" for remote Docker daemons.',
                },
                {
                    'name': 'socket_path',
                    'label': 'Socket Path',
                    'type': 'text',
                    'default': '/var/run/docker.sock',
                    'help': 'Path to the Docker Unix socket (only for socket connection type).',
                },
                {
                    'name': 'tcp_url',
                    'label': 'TCP URL',
                    'type': 'text',
                    'default': '',
                    'help': 'Docker daemon TCP URL, e.g., tcp://192.168.1.10:2375 (only for tcp type).',
                },
                {
                    'name': 'tls_verify',
                    'label': 'Verify TLS',
                    'type': 'boolean',
                    'default': False,
                    'help': 'Enable TLS verification for TCP connections.',
                },
                {
                    'name': 'sync_stats',
                    'label': 'Collect Resource Stats',
                    'type': 'boolean',
                    'default': True,
                    'help': 'Record CPU and memory metrics for running containers on each sync.',
                },
            ],
        }
