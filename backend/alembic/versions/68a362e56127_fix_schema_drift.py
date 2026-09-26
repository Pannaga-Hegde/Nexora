"""fix_schema_drift

Revision ID: 68a362e56127
Revises: 75ae0690a3c7
Create Date: 2026-09-26 23:53:25.673192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68a362e56127'
down_revision: Union[str, Sequence[str], None] = '75ae0690a3c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Notifications: Add missing link_url
    op.add_column('notifications', sa.Column('link_url', sa.String(length=255), nullable=True))
    
    # 2. Tasks: Add missing milestone_id
    # Using the same UUID type as the initial migration
    op.add_column('tasks', sa.Column('milestone_id', sa.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_tasks_milestone_id', 'tasks', 'milestones', ['milestone_id'], ['id'], ondelete='SET NULL')
    
    # 3. Task Attachments: Rename to match model
    op.alter_column('task_attachments', 'uploaded_at', new_column_name='created_at')
    
    # 4. Requests: Rename to match model
    op.alter_column('requests', 'description', new_column_name='details')
    op.alter_column('requests', 'sender_id', new_column_name='requester_id')


def downgrade() -> None:
    op.alter_column('requests', 'requester_id', new_column_name='sender_id')
    op.alter_column('requests', 'details', new_column_name='description')
    op.alter_column('task_attachments', 'created_at', new_column_name='uploaded_at')
    op.drop_constraint('fk_tasks_milestone_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'milestone_id')
    op.drop_column('notifications', 'link_url')
