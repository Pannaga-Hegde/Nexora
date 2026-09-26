import os
import sys
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from alembic import context

# Load .env variables
load_dotenv()

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Import Base and models to ensure all models are registered on metadata
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer MIGRATION_DATABASE_URL (nexora_migrator role with DDL privileges) when present.
# Fall back to DATABASE_URL so local development workflows that only set DATABASE_URL
# continue to work without any additional configuration.
migration_database_url = os.getenv("MIGRATION_DATABASE_URL") or os.getenv("DATABASE_URL")
if not migration_database_url:
    raise RuntimeError(
        "Neither MIGRATION_DATABASE_URL nor DATABASE_URL environment variable is set. "
        "Alembic migrations require a valid PostgreSQL connection string. "
        "For production: set MIGRATION_DATABASE_URL (nexora_migrator role). "
        "For local development: set DATABASE_URL."
    )

# Override sqlalchemy.url with the resolved migration URL.
# This value is never printed to logs.
config.set_main_option("sqlalchemy.url", migration_database_url.replace("%", "%%"))

# Add application's model MetaData object for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
