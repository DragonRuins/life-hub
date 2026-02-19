"""
Uptime Checker

Performs HTTP health checks on monitored services (InfraService records
with is_monitored=True). Records response times to infra_metrics,
updates service status, and emits notification events after consecutive
failures.

Called by the sync worker on a schedule (default: every 5 minutes).
"""
import logging
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

# Number of consecutive failures before emitting a "service down" event.
# Prevents false alarms from single transient failures.
FAILURE_THRESHOLD = 3


def check_all_services(app):
    """
    Check all monitored services and update their status.

    Runs inside a Flask app context. For each service with is_monitored=True:
    1. Send HTTP GET/HEAD to the service URL
    2. Compare response code to expected_status
    3. Record response_time_ms to infra_metrics
    4. Update status, last_check_at, consecutive_failures
    5. Emit events after FAILURE_THRESHOLD consecutive failures

    Args:
        app: Flask application instance (for app context).
    """
    with app.app_context():
        from app import db
        from app.models.infrastructure import InfraService, InfraMetric
        from app.services.event_bus import emit

        services = InfraService.query.filter_by(is_monitored=True).all()

        if not services:
            return

        now = datetime.now(timezone.utc)
        logger.debug(f"Checking {len(services)} monitored services")

        for service in services:
            if not service.url:
                continue

            old_status = service.status
            response_time_ms = None
            new_status = 'unknown'

            try:
                resp = requests.get(
                    service.url,
                    timeout=min(service.check_interval_seconds or 300, 30),
                    allow_redirects=True,
                    # Don't verify SSL by default (many homelab services use self-signed certs)
                    verify=False,
                )
                response_time_ms = int(resp.elapsed.total_seconds() * 1000)

                expected = service.expected_status or 200
                if resp.status_code == expected:
                    new_status = 'up'
                    service.consecutive_failures = 0
                else:
                    new_status = 'degraded'
                    service.consecutive_failures = (service.consecutive_failures or 0) + 1

            except requests.exceptions.Timeout:
                new_status = 'down'
                service.consecutive_failures = (service.consecutive_failures or 0) + 1
                logger.warning(f"Service '{service.name}' timed out")

            except requests.exceptions.ConnectionError:
                new_status = 'down'
                service.consecutive_failures = (service.consecutive_failures or 0) + 1
                logger.warning(f"Service '{service.name}' connection failed")

            except Exception as e:
                new_status = 'down'
                service.consecutive_failures = (service.consecutive_failures or 0) + 1
                logger.warning(f"Service '{service.name}' check failed: {e}")

            # Update service record
            service.status = new_status
            service.last_check_at = now
            if response_time_ms is not None:
                service.last_response_time_ms = response_time_ms

            # Record response time metric (only if we got a response)
            if response_time_ms is not None:
                db.session.add(InfraMetric(
                    source_type='service',
                    source_id=service.id,
                    metric_name='response_time_ms',
                    value=float(response_time_ms),
                    unit='ms',
                    recorded_at=now,
                ))

            # Emit notification events on status transitions
            if old_status != new_status:
                if new_status == 'down' and service.consecutive_failures >= FAILURE_THRESHOLD:
                    emit('infra.service_down',
                         service_name=service.name,
                         service_url=service.url or '',
                         consecutive_failures=service.consecutive_failures)
                elif new_status == 'up' and old_status in ('down', 'degraded'):
                    emit('infra.service_recovered',
                         service_name=service.name,
                         service_url=service.url or '',
                         old_status=old_status)

        try:
            db.session.commit()
            logger.debug(f"Service checks complete: {len(services)} services checked")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to commit service check results: {e}")
