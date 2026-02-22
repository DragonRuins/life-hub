"""
Smart Home Poller

Polls HomeAssistant every 30 seconds to update cached states on
registered smart home devices. Also handles:
  - Recording metrics for tracked devices at their configured intervals
  - Detecting printer state transitions to create/finalize print jobs
  - Emitting notification events for device state changes

Called by the scheduler in scheduler.py via poll_device_states().
"""
import logging
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger(__name__)


def poll_device_states(app):
    """
    Main polling function — called every 30 seconds by the scheduler.

    1. Loads all registered smart home devices, grouped by integration
    2. Fetches /api/states from each HA instance in one call
    3. Updates cached state on each device
    4. Records metrics for tracked devices when their interval has elapsed
    5. Detects printer state transitions for automatic job tracking
    """
    with app.app_context():
        from app import db
        from app.models.infrastructure import (
            InfraSmarthomeDevice, InfraIntegrationConfig,
            InfraMetric, InfraPrinterJob,
        )

        devices = InfraSmarthomeDevice.query.all()
        if not devices:
            return

        # Group by integration config
        by_integration = {}
        for d in devices:
            by_integration.setdefault(d.integration_config_id, []).append(d)

        now = datetime.now(timezone.utc)

        for config_id, device_list in by_integration.items():
            integration = InfraIntegrationConfig.query.get(config_id)
            if not integration or not integration.is_enabled:
                continue

            config = integration.config or {}
            base_url = config.get('url', '').rstrip('/')
            token = config.get('token', '')

            if not base_url or not token:
                continue

            # Fetch all states from HA in one request
            try:
                resp = requests.get(
                    f'{base_url}/api/states',
                    headers={
                        'Authorization': f'Bearer {token}',
                        'Content-Type': 'application/json',
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                states = {s['entity_id']: s for s in resp.json()}
            except Exception as e:
                logger.warning(f'Smart home poll failed for integration {config_id}: {e}')
                continue

            # Update each device's cached state
            for device in device_list:
                state_data = states.get(device.entity_id)
                if not state_data:
                    # Entity not found — might be unavailable
                    old_state = device.last_state
                    if old_state and old_state != 'unavailable':
                        device.last_state = 'unavailable'
                        device.last_updated_at = now
                        _emit_device_unavailable(app, device)
                    continue

                new_state = state_data.get('state')
                old_state = device.last_state
                new_attrs = state_data.get('attributes', {})

                # Detect recovery from unavailable
                if old_state == 'unavailable' and new_state and new_state != 'unavailable':
                    _emit_device_recovered(app, device)

                device.last_state = new_state
                device.last_attributes = new_attrs
                device.last_updated_at = now

                # Record metrics for tracked devices
                if device.is_tracked and new_state not in ('unavailable', 'unknown', None):
                    _maybe_record_metric(db, device, new_state, new_attrs, now)

                # Printer job tracking
                if device.category == 'printer':
                    _handle_printer_state(app, db, device, old_state, new_state, states, now)

        try:
            db.session.commit()
        except Exception as e:
            logger.error(f'Smart home poll commit failed: {e}')
            db.session.rollback()


def _maybe_record_metric(db, device, state_val, attrs, now):
    """
    Record a metric for a tracked device if enough time has elapsed
    since the last metric was recorded.
    """
    from app.models.infrastructure import InfraMetric

    interval = device.track_interval_seconds or 300

    # Check when the last metric was recorded for this device
    last_metric = InfraMetric.query.filter(
        InfraMetric.source_type == 'smarthome',
        InfraMetric.source_id == device.id,
    ).order_by(InfraMetric.recorded_at.desc()).first()

    if last_metric and (now - last_metric.recorded_at).total_seconds() < interval:
        return  # Not time yet

    # Only record numeric values
    try:
        value = float(state_val)
    except (ValueError, TypeError):
        return

    unit = attrs.get('unit_of_measurement', '')

    db.session.add(InfraMetric(
        source_type='smarthome',
        source_id=device.id,
        metric_name=device.entity_id,
        value=value,
        unit=unit,
        tags={
            'friendly_name': device.friendly_name or '',
            'domain': device.domain or '',
            'device_class': device.device_class or '',
        },
        recorded_at=now,
    ))


def _handle_printer_state(app, db, device, old_state, new_state, all_states, now):
    """
    Detect printer state transitions and manage print job lifecycle.

    State machine:
      idle/standby -> printing: Create new InfraPrinterJob
      printing (ongoing): Update progress, record temp metrics
      printing -> idle/complete: Finalize job as completed
      printing -> error: Finalize job as failed
    """
    from app.models.infrastructure import InfraPrinterJob, InfraSmarthomeDevice, InfraMetric

    printer_entities = device.config.get('printer_entities', {})

    # Helper: get state value from a related entity
    def get_entity_state(role):
        entity_id = printer_entities.get(role)
        if not entity_id:
            return None
        state_data = all_states.get(entity_id)
        if state_data:
            return state_data.get('state')
        return None

    def get_entity_float(role):
        val = get_entity_state(role)
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    # Normalize states for comparison
    printing_states = ('printing', 'running', 'busy')
    idle_states = ('idle', 'standby', 'ready', 'operational', 'offline', 'off')
    error_states = ('error', 'failed', 'paused')

    old_is_printing = old_state and old_state.lower() in printing_states
    new_is_printing = new_state and new_state.lower() in printing_states
    new_is_idle = new_state and new_state.lower() in idle_states
    new_is_error = new_state and new_state.lower() in error_states

    # Get active job for this printer
    active_job = InfraPrinterJob.query.filter_by(
        device_id=device.id, status='printing'
    ).first()

    # Transition: idle -> printing (start new job)
    if not old_is_printing and new_is_printing and not active_job:
        file_name = get_entity_state('filename')
        job = InfraPrinterJob(
            device_id=device.id,
            file_name=file_name,
            status='printing',
            progress=get_entity_float('progress') or 0.0,
            started_at=now,
        )
        db.session.add(job)
        _emit_printer_event(app, device, 'printer.job_started', {
            'file_name': file_name,
            'printer_name': device.friendly_name,
        })

    # Ongoing printing: update progress & temps
    elif new_is_printing and active_job:
        progress = get_entity_float('progress')
        if progress is not None:
            old_progress = active_job.progress or 0

            # Check for milestone notifications (25%, 50%, 75%)
            for milestone in (25, 50, 75):
                if old_progress < milestone <= progress:
                    _emit_printer_event(app, device, 'printer.progress_milestone', {
                        'file_name': active_job.file_name,
                        'printer_name': device.friendly_name,
                        'progress': milestone,
                    })

            active_job.progress = progress

        # Update ETA from remaining time entity
        remaining = get_entity_float('remaining_time')
        if remaining is not None and remaining > 0:
            active_job.estimated_end_at = now + timedelta(minutes=remaining)

        # Record temperature metrics for the printer
        for role in ('nozzle_temp', 'bed_temp', 'chamber_temp'):
            temp = get_entity_float(role)
            if temp is not None:
                db.session.add(InfraMetric(
                    source_type='smarthome',
                    source_id=device.id,
                    metric_name=role,
                    value=temp,
                    unit='°C',
                    tags={'printer_job_id': active_job.id},
                    recorded_at=now,
                ))

    # Transition: printing -> idle/complete (job finished)
    elif old_is_printing and new_is_idle and active_job:
        active_job.status = 'completed'
        active_job.completed_at = now
        if active_job.started_at:
            active_job.duration_seconds = int((now - active_job.started_at).total_seconds())

        # Calculate average temperatures from recorded metrics
        _finalize_job_temps(db, active_job)

        _emit_printer_event(app, device, 'printer.job_completed', {
            'file_name': active_job.file_name,
            'printer_name': device.friendly_name,
            'duration_seconds': active_job.duration_seconds,
        })

    # Transition: printing -> error (job failed)
    elif old_is_printing and new_is_error and active_job:
        active_job.status = 'failed'
        active_job.completed_at = now
        if active_job.started_at:
            active_job.duration_seconds = int((now - active_job.started_at).total_seconds())

        _finalize_job_temps(db, active_job)

        _emit_printer_event(app, device, 'printer.job_failed', {
            'file_name': active_job.file_name,
            'printer_name': device.friendly_name,
            'progress': active_job.progress,
        })


def _finalize_job_temps(db, job):
    """Calculate average temperatures from recorded metrics during a print job."""
    from app.models.infrastructure import InfraMetric
    from sqlalchemy import func

    for role, field in [
        ('nozzle_temp', 'nozzle_temp_avg'),
        ('bed_temp', 'bed_temp_avg'),
        ('chamber_temp', 'chamber_temp_avg'),
    ]:
        avg = db.session.query(func.avg(InfraMetric.value)).filter(
            InfraMetric.source_type == 'smarthome',
            InfraMetric.source_id == job.device_id,
            InfraMetric.metric_name == role,
            InfraMetric.recorded_at >= job.started_at,
        ).scalar()

        if avg is not None:
            setattr(job, field, round(avg, 1))


# ── Notification Event Helpers ──────────────────────────────────────

def _emit_device_unavailable(app, device):
    """Emit event when a device becomes unavailable."""
    _emit_event(app, 'smarthome.device_unavailable', {
        'device_name': device.friendly_name or device.entity_id,
        'entity_id': device.entity_id,
        'domain': device.domain,
        'room': device.room.name if device.room else 'Unassigned',
    })


def _emit_device_recovered(app, device):
    """Emit event when a device recovers from unavailable."""
    _emit_event(app, 'smarthome.device_recovered', {
        'device_name': device.friendly_name or device.entity_id,
        'entity_id': device.entity_id,
        'domain': device.domain,
        'room': device.room.name if device.room else 'Unassigned',
    })


def _emit_printer_event(app, device, event_name, data):
    """Emit a printer-related notification event."""
    _emit_event(app, event_name, data)


def _emit_event(app, event_name, data):
    """
    Emit a notification event via the event bus.
    Looks up matching notification rules and dispatches them.
    """
    try:
        from app.models.notification import NotificationRule, NotificationSettings
        from app.services.dispatcher import dispatch
        from app import db

        settings = NotificationSettings.get_settings()
        if not settings.enabled:
            return

        rules = NotificationRule.query.filter_by(
            event_name=event_name,
            is_enabled=True,
        ).all()

        for rule in rules:
            try:
                dispatch(rule, data)
                rule.last_fired_at = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f'Failed to dispatch {event_name} for rule {rule.name}: {e}')

        db.session.commit()
    except Exception as e:
        logger.error(f'Failed to emit event {event_name}: {e}')
