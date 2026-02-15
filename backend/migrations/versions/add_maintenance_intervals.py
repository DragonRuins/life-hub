"""Add maintenance interval tracking tables

Creates 3 new tables for maintenance interval tracking:
  - maintenance_items: global catalog of service types (24 presets seeded)
  - vehicle_maintenance_intervals: per-vehicle interval configuration
  - maintenance_log_items: join table linking logs to catalog items

This migration is ADDITIVE ONLY — it creates new tables and seeds data.
It does NOT modify any existing tables.

Revision ID: add_maintenance_intervals
Revises: add_notification_tables
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_maintenance_intervals'
down_revision = 'add_notification_tables'
branch_labels = None
depends_on = None


# Preset maintenance items: (name, category, default_miles, default_months, sort_order)
PRESET_ITEMS = [
    # Fluids
    ('Engine Oil', 'Fluids', 5000, 6, 10),
    ('Transmission Fluid', 'Fluids', 60000, 48, 20),
    ('Brake Fluid', 'Fluids', 30000, 24, 30),
    ('Coolant', 'Fluids', 30000, 24, 40),
    ('Power Steering Fluid', 'Fluids', 50000, 48, 50),
    ('Differential Fluid', 'Fluids', 30000, 36, 60),
    ('Transfer Case Fluid', 'Fluids', 30000, 36, 70),
    ('Windshield Washer Fluid', 'Fluids', None, 3, 80),

    # Filters
    ('Oil Filter', 'Filters', 5000, 6, 110),
    ('Air Filter', 'Filters', 15000, 12, 120),
    ('Cabin Air Filter', 'Filters', 15000, 12, 130),
    ('Fuel Filter', 'Filters', 30000, 24, 140),

    # Ignition
    ('Spark Plugs', 'Ignition', 60000, 60, 210),

    # Belts & Hoses
    ('Serpentine Belt', 'Belts & Hoses', 60000, 60, 310),
    ('Timing Belt/Chain', 'Belts & Hoses', 100000, 84, 320),
    ('Radiator Hoses', 'Belts & Hoses', 60000, 60, 330),

    # Brakes
    ('Brake Pads', 'Brakes', 40000, 36, 410),
    ('Brake Rotors', 'Brakes', 70000, 60, 420),

    # Tires
    ('Tire Rotation', 'Tires', 7500, 6, 510),
    ('Wheel Alignment', 'Tires', 15000, 12, 520),
    ('Tire Balancing', 'Tires', 15000, 12, 530),

    # Electrical
    ('Battery', 'Electrical', None, 48, 610),

    # Exterior
    ('Wiper Blades', 'Exterior', None, 12, 710),

    # Inspection
    ('Annual Inspection', 'Inspection', None, 12, 810),
]


def upgrade():
    # ── maintenance_items ────────────────────────────────────────
    op.create_table(
        'maintenance_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('default_miles_interval', sa.Integer(), nullable=True),
        sa.Column('default_months_interval', sa.Integer(), nullable=True),
        sa.Column('is_preset', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    # ── vehicle_maintenance_intervals ────────────────────────────
    op.create_table(
        'vehicle_maintenance_intervals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_id', sa.Integer(),
                  sa.ForeignKey('maintenance_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('miles_interval', sa.Integer(), nullable=True),
        sa.Column('months_interval', sa.Integer(), nullable=True),
        sa.Column('condition_type', sa.String(3), nullable=False, server_default='or'),
        sa.Column('last_service_date', sa.Date(), nullable=True),
        sa.Column('last_service_mileage', sa.Integer(), nullable=True),
        sa.Column('notify_miles_thresholds', sa.JSON(), nullable=False, server_default='[0]'),
        sa.Column('notify_months_thresholds', sa.JSON(), nullable=False, server_default='[0]'),
        sa.Column('notified_milestones', sa.JSON(), nullable=False,
                  server_default='{"miles": [], "months": []}'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('vehicle_id', 'item_id', name='uq_vehicle_item'),
    )
    op.create_index('ix_vmi_vehicle_id', 'vehicle_maintenance_intervals', ['vehicle_id'])
    op.create_index('ix_vmi_item_id', 'vehicle_maintenance_intervals', ['item_id'])

    # ── maintenance_log_items (join table) ───────────────────────
    op.create_table(
        'maintenance_log_items',
        sa.Column('log_id', sa.Integer(),
                  sa.ForeignKey('maintenance_logs.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('item_id', sa.Integer(),
                  sa.ForeignKey('maintenance_items.id', ondelete='CASCADE'), primary_key=True),
    )

    # ── Seed preset maintenance items ────────────────────────────
    items_table = sa.table(
        'maintenance_items',
        sa.column('name', sa.String),
        sa.column('category', sa.String),
        sa.column('default_miles_interval', sa.Integer),
        sa.column('default_months_interval', sa.Integer),
        sa.column('is_preset', sa.Boolean),
        sa.column('sort_order', sa.Integer),
    )
    op.bulk_insert(items_table, [
        {
            'name': name,
            'category': category,
            'default_miles_interval': miles,
            'default_months_interval': months,
            'is_preset': True,
            'sort_order': sort_order,
        }
        for name, category, miles, months, sort_order in PRESET_ITEMS
    ])


def downgrade():
    op.drop_table('maintenance_log_items')
    op.drop_table('vehicle_maintenance_intervals')
    op.drop_table('maintenance_items')
