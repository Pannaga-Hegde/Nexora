"""Add user_mfa table
 
Revision ID: 0004_add_user_mfa
Revises: 0003_add_community_posts
Create Date: 2026-09-25 22:00:00.000000
 
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
 
# revision identifiers, used by Alembic.
revision: str = '0004_add_user_mfa'
down_revision: Union[str, Sequence[str], None] = '0003_add_community_posts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
 
 
def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
 
    if 'user_mfa' not in tables:
        op.create_table(
            'user_mfa',
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True, nullable=False),
            sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('encrypted_secret', sa.Text(), nullable=True),
            sa.Column('pending_secret', sa.Text(), nullable=True),
            sa.Column('recovery_codes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
 
 
def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
 
    if 'user_mfa' in tables:
        op.drop_table('user_mfa')
