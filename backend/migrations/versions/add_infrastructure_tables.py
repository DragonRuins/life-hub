"""Add infrastructure tables

Creates 7 new tables for the infrastructure monitoring module:
  - infra_hosts: Physical/virtual servers (HexOS, VPS, etc.)
  - infra_network_devices: Routers, switches, APs, firewalls
  - infra_containers: Docker containers running on hosts
  - infra_services: Monitored web services/endpoints
  - infra_metrics: Time-series metrics (CPU %, RAM, response times)
  - infra_incidents: Outage/incident tracking
  - infra_integration_configs: Docker/HomeAssistant/Portainer configs

This migration is ADDITIVE ONLY — it creates new tables and indexes.
It does NOT modify any existing tables.

Revision ID: add_infrastructure_tables
Revises: add_knowledge_base_tables
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_infrastructure_tables'
down_revision = 'add_knowledge_base_tables'
branch_labels = None
depends_on = None


def upgrade():
    # ── infra_hosts ─────────────────────────────────────────────────
    op.create_table(
        'infra_hosts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('hostname', sa.String(255), nullable=True),
        sa.Column('host_type', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('mac_address', sa.String(17), nullable=True),
        sa.Column('os_name', sa.String(100), nullable=True),
        sa.Column('os_version', sa.String(50), nullable=True),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='unknown'),
        sa.Column('hardware', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # ── infra_network_devices ───────────────────────────────────────
    op.create_table(
        'infra_network_devices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('device_type', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('mac_address', sa.String(17), nullable=True),
        sa.Column('manufacturer', sa.String(100), nullable=True),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('firmware_version', sa.String(50), nullable=True),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='unknown'),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('parent_host_id', sa.Integer(),
                  sa.ForeignKey('infra_hosts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # ── infra_containers ────────────────────────────────────────────
    op.create_table(
        'infra_containers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('host_id', sa.Integer(),
                  sa.ForeignKey('infra_hosts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('container_id', sa.String(64), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('image', sa.String(500), nullable=True),
        sa.Column('status', sa.String(30), nullable=True, server_default='unknown'),
        sa.Column('state', sa.String(30), nullable=True),
        sa.Column('compose_project', sa.String(200), nullable=True),
        sa.Column('compose_service', sa.String(200), nullable=True),
        sa.Column('ports', sa.JSON(), nullable=True),
        sa.Column('volumes', sa.JSON(), nullable=True),
        sa.Column('environment', sa.JSON(), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('host_id', 'container_id', name='uq_infra_containers_host_container'),
    )
    op.create_index('idx_infra_containers_host', 'infra_containers', ['host_id'])

    # ── infra_services ──────────────────────────────────────────────
    op.create_table(
        'infra_services',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('url', sa.String(500), nullable=True),
        sa.Column('service_type', sa.String(50), nullable=True, server_default='http'),
        sa.Column('host_id', sa.Integer(),
                  sa.ForeignKey('infra_hosts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('container_id', sa.Integer(),
                  sa.ForeignKey('infra_containers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='unknown'),
        sa.Column('is_monitored', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('check_interval_seconds', sa.Integer(), nullable=True, server_default='300'),
        sa.Column('expected_status', sa.Integer(), nullable=True, server_default='200'),
        sa.Column('last_check_at', sa.DateTime(), nullable=True),
        sa.Column('last_response_time_ms', sa.Integer(), nullable=True),
        sa.Column('consecutive_failures', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_infra_services_status', 'infra_services', ['status'])

    # ── infra_metrics ───────────────────────────────────────────────
    op.create_table(
        'infra_metrics',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('source_type', sa.String(30), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(20), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
    )
    op.create_index('idx_infra_metrics_source', 'infra_metrics',
                    ['source_type', 'source_id', 'metric_name',
                     sa.text('recorded_at DESC')])
    op.create_index('idx_infra_metrics_time', 'infra_metrics',
                    [sa.text('recorded_at DESC')])

    # ── infra_incidents ─────────────────────────────────────────────
    op.create_table(
        'infra_incidents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity', sa.String(20), nullable=True, server_default='medium'),
        sa.Column('status', sa.String(20), nullable=True, server_default='active'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('affected_hosts', sa.JSON(), nullable=True),
        sa.Column('affected_services', sa.JSON(), nullable=True),
        sa.Column('affected_containers', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_infra_incidents_status', 'infra_incidents', ['status'])
    op.create_index('idx_infra_incidents_started', 'infra_incidents',
                    [sa.text('started_at DESC')])

    # ── infra_integration_configs ───────────────────────────────────
    op.create_table(
        'infra_integration_configs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('integration_type', sa.String(50), nullable=False),
        sa.Column('host_id', sa.Integer(),
                  sa.ForeignKey('infra_hosts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('sync_interval_seconds', sa.Integer(), nullable=True, server_default='60'),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(20), nullable=True),
        sa.Column('last_sync_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    # Drop in reverse dependency order (children/dependents first)
    op.drop_table('infra_integration_configs')
    op.drop_table('infra_incidents')
    op.drop_table('infra_metrics')
    op.drop_table('infra_services')
    op.drop_table('infra_containers')
    op.drop_table('infra_network_devices')
    op.drop_table('infra_hosts')
