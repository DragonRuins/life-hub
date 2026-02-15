"""Merge Engine Oil + Oil Filter into Oil Change, reorder items.

Combines "Engine Oil" and "Oil Filter" into a single "Oil Change" item.
Reassigns all Oil Filter references (intervals, log_items) to Oil Change.
Updates sort_order so commonly-used items appear first.

Revision ID: reorder_maintenance_items
Revises: add_notification_timing
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'reorder_maintenance_items'
down_revision = 'add_notification_timing'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Step 1: Find the Engine Oil and Oil Filter IDs
    engine_oil = conn.execute(
        sa.text("SELECT id FROM maintenance_items WHERE name = 'Engine Oil'")
    ).fetchone()
    oil_filter = conn.execute(
        sa.text("SELECT id FROM maintenance_items WHERE name = 'Oil Filter'")
    ).fetchone()

    if engine_oil:
        oil_change_id = engine_oil[0]

        # Rename "Engine Oil" to "Oil Change"
        conn.execute(
            sa.text("UPDATE maintenance_items SET name = 'Oil Change', sort_order = 1 WHERE id = :id"),
            {'id': oil_change_id}
        )

        if oil_filter:
            oil_filter_id = oil_filter[0]

            # Reassign Oil Filter intervals to Oil Change (skip duplicates)
            # First, find vehicle_ids that already have an Oil Change interval
            existing = conn.execute(
                sa.text("SELECT vehicle_id FROM vehicle_maintenance_intervals WHERE item_id = :id"),
                {'id': oil_change_id}
            ).fetchall()
            existing_vehicle_ids = {row[0] for row in existing}

            # Update Oil Filter intervals to Oil Change where no conflict
            if existing_vehicle_ids:
                conn.execute(
                    sa.text(
                        "UPDATE vehicle_maintenance_intervals "
                        "SET item_id = :new_id "
                        "WHERE item_id = :old_id AND vehicle_id NOT IN :skip"
                    ),
                    {'new_id': oil_change_id, 'old_id': oil_filter_id,
                     'skip': tuple(existing_vehicle_ids) if existing_vehicle_ids else (0,)}
                )
                # Delete conflicting Oil Filter intervals (vehicle already has Oil Change)
                conn.execute(
                    sa.text("DELETE FROM vehicle_maintenance_intervals WHERE item_id = :id"),
                    {'id': oil_filter_id}
                )
            else:
                conn.execute(
                    sa.text(
                        "UPDATE vehicle_maintenance_intervals "
                        "SET item_id = :new_id WHERE item_id = :old_id"
                    ),
                    {'new_id': oil_change_id, 'old_id': oil_filter_id}
                )

            # Reassign maintenance_log_items references
            conn.execute(
                sa.text(
                    "UPDATE maintenance_log_items SET item_id = :new_id "
                    "WHERE item_id = :old_id AND log_id NOT IN ("
                    "  SELECT log_id FROM maintenance_log_items WHERE item_id = :new_id"
                    ")"
                ),
                {'new_id': oil_change_id, 'old_id': oil_filter_id}
            )
            # Delete remaining duplicate references
            conn.execute(
                sa.text("DELETE FROM maintenance_log_items WHERE item_id = :id"),
                {'id': oil_filter_id}
            )

            # Delete the Oil Filter item
            conn.execute(
                sa.text("DELETE FROM maintenance_items WHERE id = :id"),
                {'id': oil_filter_id}
            )

    # Step 2: Update sort_order for commonly-used items at the top
    # Common items get sort_order 1-10, everything else 100+
    updates = [
        # ('Oil Change' already set to 1 above)
        ('Battery', 2),
        ('Air Filter', 3),
        ('Tire Rotation', 4),
        ('Brake Pads', 5),
        ('Cabin Air Filter', 6),
        ('Wiper Blades', 7),
        ('Annual Inspection', 8),
        # Rest keep category-based ordering (100+)
        ('Transmission Fluid', 110),
        ('Brake Fluid', 120),
        ('Coolant', 130),
        ('Power Steering Fluid', 140),
        ('Differential Fluid', 150),
        ('Transfer Case Fluid', 160),
        ('Windshield Washer Fluid', 170),
        ('Fuel Filter', 210),
        ('Spark Plugs', 310),
        ('Serpentine Belt', 410),
        ('Timing Belt/Chain', 420),
        ('Radiator Hoses', 430),
        ('Brake Rotors', 510),
        ('Wheel Alignment', 520),
        ('Tire Balancing', 530),
    ]
    for name, order in updates:
        conn.execute(
            sa.text("UPDATE maintenance_items SET sort_order = :order WHERE name = :name"),
            {'order': order, 'name': name}
        )


def downgrade():
    # Not fully reversible (can't un-merge items), but restore sort_order
    pass
