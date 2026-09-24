"""Add creator_id to calendar_events

Revision ID: 0002_add_calendar_event_creator
Revises: 0001_initial_schema
Create Date: 2026-09-21 21:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_add_calendar_event_creator'
down_revision: Union[str, Sequence[str], None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add creator_id column to calendar_events table if not present
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('calendar_events')]
    if 'creator_id' not in columns:
        op.add_column(
            'calendar_events',
            sa.Column('creator_id', postgresql.UUID(as_uuid=True), nullable=True)
        )
        op.create_foreign_key(
            'fk_calendar_events_creator_id_users',
            'calendar_events', 'users',
            ['creator_id'], ['id'],
            ondelete='SET NULL'
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fks = [fk['name'] for fk in inspector.get_foreign_keys('calendar_events')]
    if 'fk_calendar_events_creator_id_users' in fks:
        op.drop_constraint('fk_calendar_events_creator_id_users', 'calendar_events', type_='foreignkey')
    
    columns = [col['name'] for col in inspector.get_columns('calendar_events')]
    if 'creator_id' in columns:
        op.drop_column('calendar_events', 'creator_id')
