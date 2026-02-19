"""
Notification Scheduler

Uses APScheduler to run scheduled notification rules (cron, interval, one-time).

On app startup, reads all enabled scheduled rules from the database and
registers them as APScheduler jobs. The PostgreSQL job store ensures jobs
survive app restarts.

When scheduled rules are created/updated/deleted via the API, call
sync_scheduled_rules() to update the scheduler.

Also runs a daily cleanup job to delete old notification_log entries
based on the retention_days setting.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Module-level scheduler instance, initialized in init_scheduler()
scheduler = None
_app = None


def init_scheduler(app):
    """
    Initialize APScheduler with PostgreSQL job store.

    Called once from create_app() after db.init_app().

    Args:
        app: The Flask application instance
    """
    global scheduler, _app
    _app = app

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

        jobstores = {
            'default': SQLAlchemyJobStore(
                url=app.config['SQLALCHEMY_DATABASE_URI'],
                tablename='apscheduler_jobs',
            )
        }

        scheduler = BackgroundScheduler(jobstores=jobstores)
        scheduler.start()

        # Sync scheduled rules from database
        with app.app_context():
            sync_scheduled_rules()
            _add_cleanup_job()
            _add_interval_check_job()
            _add_infrastructure_sync_job()
            _add_uptime_check_job()
            _add_metrics_retention_job()

        logger.info("Notification scheduler started")

    except Exception as e:
        logger.error(f"Failed to initialize scheduler: {e}")


def sync_scheduled_rules():
    """
    Synchronize scheduled rules from the database to APScheduler.

    Reads all enabled rules with rule_type='scheduled', adds or updates
    their APScheduler jobs, and removes jobs for disabled/deleted rules.

    Call this whenever rules are created, updated, or deleted via the API.
    """
    global scheduler
    if not scheduler:
        return

    from app.models.notification import NotificationRule

    # Get all enabled scheduled rules
    rules = NotificationRule.query.filter_by(
        rule_type='scheduled',
        is_enabled=True,
    ).all()

    # Track which job IDs should exist
    active_job_ids = set()

    for rule in rules:
        job_id = f"notification_rule_{rule.id}"
        active_job_ids.add(job_id)

        config = rule.schedule_config or {}
        schedule_type = config.get('type', 'interval')

        try:
            # Build the trigger kwargs based on schedule type
            if schedule_type == 'cron':
                trigger = 'cron'
                trigger_kwargs = _parse_cron_config(config)
            elif schedule_type == 'interval':
                trigger = 'interval'
                trigger_kwargs = _parse_interval_config(config)
            elif schedule_type == 'date':
                trigger = 'date'
                trigger_kwargs = {'run_date': config.get('run_date')}
            else:
                logger.warning(f"Unknown schedule type '{schedule_type}' for rule '{rule.name}'")
                continue

            # Add or replace the job
            scheduler.add_job(
                _execute_scheduled_rule,
                trigger=trigger,
                id=job_id,
                args=[rule.id],
                replace_existing=True,
                **trigger_kwargs,
            )

            logger.debug(f"Scheduled job '{job_id}' for rule '{rule.name}'")

        except Exception as e:
            logger.error(f"Failed to schedule rule '{rule.name}': {e}")

    # Remove jobs for rules that no longer exist or are disabled
    existing_jobs = scheduler.get_jobs()
    for job in existing_jobs:
        if job.id.startswith('notification_rule_') and job.id not in active_job_ids:
            scheduler.remove_job(job.id)
            logger.debug(f"Removed stale job '{job.id}'")


def _execute_scheduled_rule(rule_id):
    """
    Called by APScheduler when a scheduled rule fires.
    Runs inside Flask app context.
    """
    global _app
    if not _app:
        return

    with _app.app_context():
        from app.models.notification import NotificationRule, NotificationSettings
        from app.services.dispatcher import dispatch
        from app import db

        rule = NotificationRule.query.get(rule_id)
        if not rule or not rule.is_enabled:
            return

        settings = NotificationSettings.get_settings()
        if not settings.enabled:
            return

        # Scheduled rules pass minimal data for template rendering
        data = {
            'rule_name': rule.name,
            'trigger': 'schedule',
            'fired_at': datetime.now(timezone.utc).isoformat(),
        }

        try:
            dispatch(rule, data)
            rule.last_fired_at = datetime.now(timezone.utc)
            db.session.commit()
        except Exception as e:
            logger.error(f"Scheduled rule '{rule.name}' execution failed: {e}")
            db.session.rollback()


def _add_cleanup_job():
    """Add a daily job to clean up old notification log entries."""
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _cleanup_old_logs,
        trigger='cron',
        id='notification_log_cleanup',
        hour=3,
        minute=0,
        replace_existing=True,
    )


def _cleanup_old_logs():
    """Delete notification log entries older than retention_days."""
    global _app
    if not _app:
        return

    with _app.app_context():
        from app import db
        from app.models.notification import NotificationLog, NotificationSettings

        settings = NotificationSettings.get_settings()
        if not settings.retention_days:
            return

        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.retention_days)

        deleted = NotificationLog.query.filter(
            NotificationLog.sent_at < cutoff
        ).delete()

        db.session.commit()

        if deleted:
            logger.info(f"Cleaned up {deleted} old notification log entries")


def _add_interval_check_job():
    """Add a daily job to check maintenance intervals for all vehicles."""
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _check_intervals_daily,
        trigger='cron',
        id='maintenance_interval_check',
        hour=9,
        minute=0,
        replace_existing=True,
    )


def _check_intervals_daily():
    """Check all vehicle maintenance intervals (runs daily at 9 AM)."""
    global _app
    if not _app:
        return

    with _app.app_context():
        try:
            from app.services.interval_checker import check_all_vehicle_intervals
            check_all_vehicle_intervals()
        except Exception as e:
            logger.error(f"Daily maintenance interval check failed: {e}")


def _parse_cron_config(config):
    """Parse cron schedule config into APScheduler kwargs."""
    cron_expr = config.get('cron', '')
    if cron_expr:
        # Parse standard 5-field cron: minute hour day month day_of_week
        parts = cron_expr.split()
        if len(parts) >= 5:
            return {
                'minute': parts[0],
                'hour': parts[1],
                'day': parts[2],
                'month': parts[3],
                'day_of_week': parts[4],
            }

    # Fall back to individual fields
    kwargs = {}
    for field in ['minute', 'hour', 'day', 'month', 'day_of_week']:
        if field in config:
            kwargs[field] = config[field]
    return kwargs or {'hour': '9', 'minute': '0'}  # Default: 9 AM daily


def _parse_interval_config(config):
    """Parse interval schedule config into APScheduler kwargs."""
    kwargs = {}
    for field in ['weeks', 'days', 'hours', 'minutes', 'seconds']:
        if field in config:
            kwargs[field] = int(config[field])
    return kwargs or {'hours': 24}  # Default: every 24 hours


# ═══════════════════════════════════════════════════════════════════════════
# Infrastructure Sync Jobs
# ═══════════════════════════════════════════════════════════════════════════

def _add_infrastructure_sync_job():
    """
    Add a periodic job to sync all enabled infrastructure integrations.

    Runs every 60 seconds by default. Each integration has its own
    sync_interval_seconds, but this job is the master loop that checks
    all of them. The sync worker skips integrations whose interval
    hasn't elapsed since their last sync.
    """
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _run_infrastructure_sync,
        trigger='interval',
        id='infrastructure_sync',
        seconds=60,
        replace_existing=True,
    )
    logger.info("Infrastructure sync job scheduled (every 60s)")


def _run_infrastructure_sync():
    """Execute infrastructure integration syncs inside app context."""
    global _app
    if not _app:
        return

    try:
        from app.services.infrastructure.sync_worker import run_all_syncs
        run_all_syncs(_app)
    except Exception as e:
        logger.error(f"Infrastructure sync failed: {e}")


def _add_uptime_check_job():
    """
    Add a periodic job to check all monitored service endpoints.

    Runs every 5 minutes (300 seconds). Individual services can have
    different check_interval_seconds, but this is the minimum resolution.
    """
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _run_uptime_checks,
        trigger='interval',
        id='infrastructure_uptime_check',
        seconds=300,
        replace_existing=True,
    )
    logger.info("Infrastructure uptime check job scheduled (every 300s)")


def _run_uptime_checks():
    """Execute service uptime checks inside app context."""
    global _app
    if not _app:
        return

    try:
        from app.services.infrastructure.uptime_checker import check_all_services
        check_all_services(_app)
    except Exception as e:
        logger.error(f"Infrastructure uptime check failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Infrastructure Metrics Retention
# ═══════════════════════════════════════════════════════════════════════════

METRICS_RETENTION_DAYS = 30  # Keep raw metrics for this many days


def _add_metrics_retention_job():
    """Add a daily job at 4 AM to aggregate and clean old infrastructure metrics."""
    global scheduler
    if not scheduler:
        return

    scheduler.add_job(
        _run_metrics_retention,
        trigger='cron',
        id='infrastructure_metrics_retention',
        hour=4,
        minute=0,
        replace_existing=True,
    )
    logger.info("Infrastructure metrics retention job scheduled (daily at 4 AM)")


def _run_metrics_retention():
    """
    Aggregate old raw metrics into hourly/daily summaries, then delete raw data.

    Steps:
      1. For raw metrics older than METRICS_RETENTION_DAYS:
         - Aggregate into hourly averages (one row per source/metric/hour)
         - Aggregate into daily averages (one row per source/metric/day)
      2. Delete the original raw rows
      3. Also delete any aggregated data older than 365 days
    """
    global _app
    if not _app:
        return

    with _app.app_context():
        from app import db
        from app.models.infrastructure import InfraMetric
        from sqlalchemy import text

        cutoff = datetime.now(timezone.utc) - timedelta(days=METRICS_RETENTION_DAYS)

        try:
            # Step 1: Insert hourly aggregates for data older than cutoff
            # Only aggregate rows that don't already have a resolution tag
            db.session.execute(text("""
                INSERT INTO infra_metrics (source_type, source_id, metric_name, value, unit, tags, recorded_at)
                SELECT
                    source_type,
                    source_id,
                    metric_name,
                    AVG(value),
                    MIN(unit),
                    '{"resolution": "hourly"}'::jsonb,
                    date_trunc('hour', recorded_at)
                FROM infra_metrics
                WHERE recorded_at < :cutoff
                  AND (tags IS NULL OR tags ->> 'resolution' IS NULL)
                GROUP BY source_type, source_id, metric_name, date_trunc('hour', recorded_at)
            """), {'cutoff': cutoff})

            # Step 2: Delete old raw rows (no resolution tag)
            result = db.session.execute(text("""
                DELETE FROM infra_metrics
                WHERE recorded_at < :cutoff
                  AND (tags IS NULL OR tags ->> 'resolution' IS NULL)
            """), {'cutoff': cutoff})
            deleted_raw = result.rowcount

            # Step 3: Delete very old aggregated data (> 365 days)
            old_cutoff = datetime.now(timezone.utc) - timedelta(days=365)
            result = db.session.execute(text("""
                DELETE FROM infra_metrics
                WHERE recorded_at < :old_cutoff
                  AND tags ->> 'resolution' IS NOT NULL
            """), {'old_cutoff': old_cutoff})
            deleted_old = result.rowcount

            db.session.commit()

            if deleted_raw or deleted_old:
                logger.info(
                    f"Metrics retention: aggregated & deleted {deleted_raw} raw rows, "
                    f"deleted {deleted_old} old aggregate rows"
                )

        except Exception as e:
            db.session.rollback()
            logger.error(f"Metrics retention job failed: {e}")
