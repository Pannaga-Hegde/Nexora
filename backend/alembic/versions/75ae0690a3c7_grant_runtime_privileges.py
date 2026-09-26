"""grant_runtime_privileges

Revision ID: 75ae0690a3c7
Revises: 0004_add_user_mfa
Create Date: 2026-09-26 23:20:55.234127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75ae0690a3c7'
down_revision: Union[str, Sequence[str], None] = '0004_add_user_mfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexora_runtime;")
    op.execute("ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_runtime;")
    op.execute("GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO nexora_runtime;")
    op.execute("ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO nexora_runtime;")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA public REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM nexora_runtime;")
    op.execute("REVOKE USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM nexora_runtime;")
    op.execute("ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrator IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM nexora_runtime;")
    op.execute("REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM nexora_runtime;")
