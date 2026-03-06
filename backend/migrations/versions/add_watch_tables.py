"""Add watch pipeline tables

Creates 7 new tables for the Apple Watch data pipeline:
  - watch_health_samples: HealthKit samples (heart rate, HRV, steps, etc.)
  - watch_barometer_readings: Barometric pressure and relative altitude
  - watch_nfc_events: NFC tag scan events with action execution results
  - watch_nfc_action_definitions: Configurable actions triggered by NFC tags
  - watch_nfc_timers: Start/stop timers tied to NFC toggle actions
  - watch_spatial_readings: UWB spatial/proximity readings between devices
  - watch_sync_status: Per-pipeline sync state tracking

This migration is ADDITIVE ONLY and IDEMPOTENT — it checks for existing
tables before creating them so it works correctly even when db.create_all()
has already created the tables on the live system.

Revision ID: add_watch_tables
Revises: add_vehicle_types
Create Date: 2026-03-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_watch_tables'
down_revision = 'add_vehicle_types'
branch_labels = None
depends_on = None


def _table_exists(table_name):
    """Check if a table already exists (e.g., created by db.create_all())."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _index_exists(index_name):
    """Check if an index already exists using pg_indexes catalog."""
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {'name': index_name})
    return result.fetchone() is not None


def upgrade():
    # ── watch_health_samples ─────────────────────────────────────
    if not _table_exists('watch_health_samples'):
        op.create_table(
            'watch_health_samples',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('uuid', sa.String(36), nullable=False),
            sa.Column('sample_type', sa.String(100), nullable=False),
            sa.Column('value', sa.Float(), nullable=False),
            sa.Column('unit', sa.String(50), nullable=False),
            sa.Column('start_date', sa.DateTime(), nullable=False),
            sa.Column('end_date', sa.DateTime(), nullable=True),
            sa.Column('source_device', sa.String(200), nullable=True),
            sa.Column('source_app', sa.String(200), nullable=True),
            sa.Column('metadata', postgresql.JSONB(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('uuid', name='uq_watch_health_uuid'),
        )
    if not _index_exists('idx_watch_health_type_date'):
        op.create_index('idx_watch_health_type_date', 'watch_health_samples',
                        ['sample_type', sa.text('start_date DESC')])
    if not _index_exists('idx_watch_health_date'):
        op.create_index('idx_watch_health_date', 'watch_health_samples',
                        [sa.text('start_date DESC')])

    # ── watch_barometer_readings ─────────────────────────────────
    if not _table_exists('watch_barometer_readings'):
        op.create_table(
            'watch_barometer_readings',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('uuid', sa.String(36), nullable=False),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('pressure_kpa', sa.Float(), nullable=False),
            sa.Column('relative_altitude_m', sa.Float(), nullable=True),
            sa.Column('lat', sa.Float(), nullable=True),
            sa.Column('lng', sa.Float(), nullable=True),
            sa.Column('context', sa.String(50), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('uuid', name='uq_watch_barometer_uuid'),
        )
    if not _index_exists('idx_watch_barometer_time'):
        op.create_index('idx_watch_barometer_time', 'watch_barometer_readings',
                        [sa.text('timestamp DESC')])

    # ── watch_nfc_events ─────────────────────────────────────────
    if not _table_exists('watch_nfc_events'):
        op.create_table(
            'watch_nfc_events',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('uuid', sa.String(36), nullable=False),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('action_id', sa.String(100), nullable=False),
            sa.Column('label', sa.String(200), nullable=True),
            sa.Column('tag_id', sa.String(200), nullable=True),
            sa.Column('lat', sa.Float(), nullable=True),
            sa.Column('lng', sa.Float(), nullable=True),
            sa.Column('result', postgresql.JSONB(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('uuid', name='uq_watch_nfc_uuid'),
        )
    if not _index_exists('idx_watch_nfc_action_time'):
        op.create_index('idx_watch_nfc_action_time', 'watch_nfc_events',
                        ['action_id', sa.text('timestamp DESC')])
    if not _index_exists('idx_watch_nfc_time'):
        op.create_index('idx_watch_nfc_time', 'watch_nfc_events',
                        [sa.text('timestamp DESC')])

    # ── watch_nfc_action_definitions ─────────────────────────────
    if not _table_exists('watch_nfc_action_definitions'):
        op.create_table(
            'watch_nfc_action_definitions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('action_id', sa.String(100), nullable=False),
            sa.Column('description', sa.String(500), nullable=True),
            sa.Column('action_type', sa.String(50), nullable=False),
            sa.Column('category', sa.String(50), nullable=True),
            sa.Column('config', postgresql.JSONB(), nullable=True),
            sa.Column('integrations', postgresql.JSONB(), nullable=True),
            sa.Column('responses', postgresql.JSONB(), nullable=True),
            sa.Column('enabled', sa.Boolean(), nullable=True, server_default='true'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('action_id', name='uq_watch_nfc_action_id'),
        )

    # ── watch_nfc_timers ─────────────────────────────────────────
    if not _table_exists('watch_nfc_timers'):
        op.create_table(
            'watch_nfc_timers',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('action_id', sa.String(100), nullable=False),
            sa.Column('started_at', sa.DateTime(), nullable=False),
            sa.Column('ended_at', sa.DateTime(), nullable=True),
            sa.Column('duration_seconds', sa.Integer(), nullable=True),
            sa.Column('metadata', postgresql.JSONB(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
    if not _index_exists('idx_watch_nfc_timer_action_time'):
        op.create_index('idx_watch_nfc_timer_action_time', 'watch_nfc_timers',
                        ['action_id', sa.text('started_at DESC')])
    if not _index_exists('idx_watch_nfc_timer_active'):
        op.create_index('idx_watch_nfc_timer_active', 'watch_nfc_timers',
                        ['action_id'],
                        postgresql_where=sa.text('ended_at IS NULL'))

    # ── watch_spatial_readings ───────────────────────────────────
    if not _table_exists('watch_spatial_readings'):
        op.create_table(
            'watch_spatial_readings',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('uuid', sa.String(36), nullable=False),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('peer_device', sa.String(200), nullable=False),
            sa.Column('distance_m', sa.Float(), nullable=True),
            sa.Column('direction_x', sa.Float(), nullable=True),
            sa.Column('direction_y', sa.Float(), nullable=True),
            sa.Column('direction_z', sa.Float(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('uuid', name='uq_watch_spatial_uuid'),
        )
    if not _index_exists('idx_watch_spatial_time'):
        op.create_index('idx_watch_spatial_time', 'watch_spatial_readings',
                        [sa.text('timestamp DESC')])
    if not _index_exists('idx_watch_spatial_peer_time'):
        op.create_index('idx_watch_spatial_peer_time', 'watch_spatial_readings',
                        ['peer_device', sa.text('timestamp DESC')])

    # ── watch_sync_status ────────────────────────────────────────
    if not _table_exists('watch_sync_status'):
        op.create_table(
            'watch_sync_status',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('pipeline', sa.String(50), nullable=False),
            sa.Column('last_sync_at', sa.DateTime(), nullable=True),
            sa.Column('samples_synced', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('metadata', postgresql.JSONB(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('pipeline', name='uq_watch_sync_pipeline'),
        )


def downgrade():
    # Drop in reverse order (no FK dependencies, so order doesn't strictly matter)
    op.drop_table('watch_sync_status')
    op.drop_table('watch_spatial_readings')
    op.drop_table('watch_nfc_timers')
    op.drop_table('watch_nfc_action_definitions')
    op.drop_table('watch_nfc_events')
    op.drop_table('watch_barometer_readings')
    op.drop_table('watch_health_samples')
