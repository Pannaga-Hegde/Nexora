"""Add community_posts table

Revision ID: 0003_add_community_posts
Revises: 0002_add_calendar_event_creator
Create Date: 2026-09-21 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003_add_community_posts'
down_revision: Union[str, Sequence[str], None] = '0002_add_calendar_event_creator'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'community_posts' not in tables:
        op.create_table(
            'community_posts',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('category', sa.String(length=100), nullable=False, server_default='General'),
            sa.Column('likes_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_community_posts_author_id', 'community_posts', ['author_id'])
        op.create_index('ix_community_posts_created_at', 'community_posts', ['created_at'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'community_posts' in tables:
        op.drop_index('ix_community_posts_created_at', table_name='community_posts')
        op.drop_index('ix_community_posts_author_id', table_name='community_posts')
        op.drop_table('community_posts')
