"""
Infrastructure Sync Worker

Background sync loop that loads enabled InfraIntegrationConfig records
and runs their sync() method on schedule. Called by the APScheduler
job registered in scheduler.py.

Also provides a manual sync function for triggering syncs from API routes.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def run_all_syncs(app):
    """
    Run sync for all enabled integrations.

    Called by APScheduler on the configured interval. Loads each enabled
    InfraIntegrationConfig, instantiates the matching integration class,
    and calls sync(). Updates last_sync_at, last_sync_status, and
    last_sync_error on the config record.

    Args:
        app: Flask application instance (for app context).
    """
    with app.app_context():
        from app import db
        from app.models.infrastructure import InfraIntegrationConfig
        from app.services.infrastructure.registry import get_integration_class

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
