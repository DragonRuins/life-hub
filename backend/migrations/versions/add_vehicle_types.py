"""Add vehicle type support and motorcycle maintenance presets.

Adds vehicle_type, cylinder_count, dual_spark, final_drive_type to vehicles table.
Adds vehicle_types filter column to maintenance_items.
Seeds motorcycle-specific maintenance items.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_vehicle_types'
down_revision = 'reorder_maintenance_items'
branch_labels = None
depends_on = None

# Motorcycle-specific maintenance presets: (name, category, miles, months, sort_order, vehicle_types)
MOTORCYCLE_PRESETS = [
    ('Chain Lubrication', 'Drivetrain', 500, 1, 910, 'motorcycle'),
    ('Chain Adjustment', 'Drivetrain', 3000, 6, 920, 'motorcycle'),
    ('Chain Replacement', 'Drivetrain', 20000, 48, 930, 'motorcycle'),
    ('Belt Inspection', 'Drivetrain', 5000, 12, 940, 'motorcycle'),
    ('Belt Replacement', 'Drivetrain', 50000, 60, 950, 'motorcycle'),
    ('Valve Clearance Check', 'Engine', 15000, 24, 960, 'motorcycle'),
    ('Fork Oil Change', 'Suspension', 15000, 24, 970, 'motorcycle'),
    ('Tire Replacement', 'Tires', 10000, 36, 540, 'motorcycle'),
]


def upgrade():
    # ── Vehicle table: add type columns ─────────────────────────
    op.add_column('vehicles', sa.Column('vehicle_type', sa.String(20), nullable=False, server_default='car'))
    op.add_column('vehicles', sa.Column('cylinder_count', sa.Integer(), nullable=True))
    op.add_column('vehicles', sa.Column('dual_spark', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('vehicles', sa.Column('final_drive_type', sa.String(20), nullable=True))

    # ── MaintenanceItem: add vehicle_types filter ───────────────
    op.add_column('maintenance_items', sa.Column('vehicle_types', sa.String(100), nullable=True))

    # ── Seed motorcycle maintenance presets ──────────────────────
    items_table = sa.table(
        'maintenance_items',
        sa.column('name', sa.String),
        sa.column('category', sa.String),
        sa.column('default_miles_interval', sa.Integer),
        sa.column('default_months_interval', sa.Integer),
        sa.column('is_preset', sa.Boolean),
        sa.column('sort_order', sa.Integer),
        sa.column('vehicle_types', sa.String),
    )
    op.bulk_insert(items_table, [
        {
            'name': name,
            'category': category,
            'default_miles_interval': miles,
            'default_months_interval': months,
            'is_preset': True,
            'sort_order': sort_order,
            'vehicle_types': vehicle_types,
        }
        for name, category, miles, months, sort_order, vehicle_types in MOTORCYCLE_PRESETS
    ])


def downgrade():
    # Remove motorcycle presets
    op.execute("DELETE FROM maintenance_items WHERE vehicle_types = 'motorcycle'")

    # Remove columns
    op.drop_column('maintenance_items', 'vehicle_types')
    op.drop_column('vehicles', 'final_drive_type')
    op.drop_column('vehicles', 'dual_spark')
    op.drop_column('vehicles', 'cylinder_count')
    op.drop_column('vehicles', 'vehicle_type')
