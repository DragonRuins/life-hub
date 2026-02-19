"""
Infrastructure Sync Worker

Background sync loop that loads enabled InfraIntegrationConfig records
and runs their sync() method on schedule. Called by the APScheduler
job registered in scheduler.py.

Also provides a manual sync function for triggering syncs from API routes.

The sync loop also records host-level system metrics (CPU, RAM, disk, load)
by reading /host/proc (if mounted). See host_stats.py for details.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Module-level state for CPU delta calculation across sync cycles.
# Stores the previous /proc/stat CPU times so we can compute % between cycles.
_last_cpu_sample = {'total': None, 'idle': None}


def _record_host_metrics(app):
    """
    Read system metrics from /host/proc and record them as InfraMetric rows.

    Called at the start of each sync cycle. Records cpu_percent, ram_percent,
    disk_percent, and load_1m for the first InfraHost in the database.

    CPU % is computed as the delta from the previous sync cycle's /proc/stat
    sample. On the first cycle, cpu_percent is skipped (no previous sample).
    """
    from app import db
    from app.models.infrastructure import InfraHost, InfraMetric
    from app.services.infrastructure.host_stats import is_available, get_sync_metrics

    if not is_available():
        return

    # Get the first host — single-host deployment assumption
    host = InfraHost.query.order_by(InfraHost.id).first()
    if not host:
        return

    metrics = get_sync_metrics()
    if not metrics:
        return

    now = datetime.now(timezone.utc)

    # Mark host as online since we successfully read /proc
    host.status = 'online'
    host.last_seen_at = now

    # Compute CPU % from delta with previous cycle's sample
    cpu_percent = None
    cur_total = metrics.get('_cpu_total')
    cur_idle = metrics.get('_cpu_idle')

    if cur_total is not None and _last_cpu_sample['total'] is not None:
        total_delta = cur_total - _last_cpu_sample['total']
        idle_delta = cur_idle - _last_cpu_sample['idle']
        if total_delta > 0:
            cpu_percent = round((1 - idle_delta / total_delta) * 100, 1)

    # Store current sample for next cycle
    _last_cpu_sample['total'] = cur_total
    _last_cpu_sample['idle'] = cur_idle

    # Record metric rows
    metric_rows = []

    if cpu_percent is not None:
        metric_rows.append(InfraMetric(
            source_type='host',
            source_id=host.id,
            metric_name='cpu_percent',
            value=cpu_percent,
            unit='%',
            recorded_at=now,
        ))

    if metrics.get('ram_percent') is not None:
        metric_rows.append(InfraMetric(
            source_type='host',
            source_id=host.id,
            metric_name='ram_percent',
            value=metrics['ram_percent'],
            unit='%',
            recorded_at=now,
        ))

    if metrics.get('disk_percent') is not None:
        metric_rows.append(InfraMetric(
            source_type='host',
            source_id=host.id,
            metric_name='disk_percent',
            value=metrics['disk_percent'],
            unit='%',
            recorded_at=now,
        ))

    if metrics.get('load_1m') is not None:
        metric_rows.append(InfraMetric(
            source_type='host',
            source_id=host.id,
            metric_name='load_1m',
            value=metrics['load_1m'],
            unit='',
            recorded_at=now,
        ))

    if metric_rows:
        for row in metric_rows:
            db.session.add(row)
        try:
            db.session.commit()
            logger.debug(f"Recorded {len(metric_rows)} host metrics for host {host.id}")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to record host metrics: {e}")


def run_all_syncs(app):
    """
    Run sync for all enabled integrations.

    Called by APScheduler on the configured interval. Loads each enabled
    InfraIntegrationConfig, instantiates the matching integration class,
    and calls sync(). Updates last_sync_at, last_sync_status, and
    last_sync_error on the config record.

    Also records host system metrics at the start of each cycle.

    Args:
        app: Flask application instance (for app context).
    """
    with app.app_context():
        from app import db
        from app.models.infrastructure import InfraIntegrationConfig
        from app.services.infrastructure.registry import get_integration_class

        # Record host system metrics before running integration syncs
        try:
            _record_host_metrics(app)
        except Exception as e:
            logger.error(f"Failed to record host metrics: {e}")

        configs = InfraIntegrationConfig.query.filter_by(is_enabled=True).all()

        if not configs:
            return

        now = datetime.now(timezone.utc)
        logger.debug(f"Running infrastructure sync for {len(configs)} integrations")

        for config in configs:
            cls = get_integration_class(config.integration_type)
            if not cls:
                config.last_sync_status = 'error'
                config.last_sync_error = f"Unknown integration type: '{config.integration_type}'"
                config.last_sync_at = now
                continue

            try:
                integration = cls(config)
                result = integration.sync()

                config.last_sync_at = now
                if result.get('success', False):
                    config.last_sync_status = 'success'
                    config.last_sync_error = None
                    logger.info(f"Sync '{config.name}' succeeded: {result}")
                else:
                    config.last_sync_status = 'error'
                    config.last_sync_error = result.get('message') or result.get('error', 'Unknown error')
                    logger.warning(f"Sync '{config.name}' failed: {config.last_sync_error}")

            except Exception as e:
                config.last_sync_at = now
                config.last_sync_status = 'error'
                config.last_sync_error = str(e)
                logger.error(f"Sync '{config.name}' raised exception: {e}")

                # Emit error event for notification
                try:
                    from app.services.event_bus import emit
                    emit('infra.integration_error',
                         integration_name=config.name,
                         integration_type=config.integration_type,
                         error=str(e))
                except Exception:
                    pass

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to commit sync results: {e}")


def sync_single_integration(config_id):
    """
    Run sync for a single integration (called from API routes).

    Args:
        config_id: The InfraIntegrationConfig.id to sync.

    Returns:
        dict: Sync result from the integration's sync() method.

    Raises:
        ValueError: If integration not found or type unknown.
    """
    from app import db
    from app.models.infrastructure import InfraIntegrationConfig
    from app.services.infrastructure.registry import get_integration_class

    config = InfraIntegrationConfig.query.get(config_id)
    if not config:
        raise ValueError(f"Integration config {config_id} not found")

    cls = get_integration_class(config.integration_type)
    if not cls:
        raise ValueError(f"Unknown integration type: '{config.integration_type}'")

    now = datetime.now(timezone.utc)

    try:
        integration = cls(config)
        result = integration.sync()

        config.last_sync_at = now
        if result.get('success', False):
            config.last_sync_status = 'success'
            config.last_sync_error = None
        else:
            config.last_sync_status = 'error'
            config.last_sync_error = result.get('message') or result.get('error', 'Unknown error')

        db.session.commit()
        return result

    except Exception as e:
        config.last_sync_at = now
        config.last_sync_status = 'error'
        config.last_sync_error = str(e)
        db.session.commit()
        raise


def test_single_integration(config_id):
    """
    Test connection for a single integration (called from API routes).

    Args:
        config_id: The InfraIntegrationConfig.id to test.

    Returns:
        dict: {'success': True/False, 'message': '...'}

    Raises:
        ValueError: If integration not found or type unknown.
    """
    from app.models.infrastructure import InfraIntegrationConfig
    from app.services.infrastructure.registry import get_integration_class

    config = InfraIntegrationConfig.query.get(config_id)
    if not config:
        raise ValueError(f"Integration config {config_id} not found")

    cls = get_integration_class(config.integration_type)
    if not cls:
        raise ValueError(f"Unknown integration type: '{config.integration_type}'")

    integration = cls(config)
    return integration.test_connection()


def sync_host_containers(host_id):
    """
    Trigger a Docker sync for a specific host (called from API routes).

    Finds the Docker integration config associated with the given host
    and runs its sync.

    Args:
        host_id: The InfraHost.id to sync containers for.

    Returns:
        dict: Sync result.

    Raises:
        ValueError: If no Docker integration found for this host.
    """
    from app.models.infrastructure import InfraIntegrationConfig

    config = InfraIntegrationConfig.query.filter_by(
        host_id=host_id,
        integration_type='docker',
        is_enabled=True,
    ).first()

    if not config:
        raise ValueError(f"No enabled Docker integration found for host {host_id}")

    return sync_single_integration(config.id)
