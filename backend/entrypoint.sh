#!/bin/sh
set -e

echo "[Nexora Backend] Checking database connectivity..."
python -c '
import os, time, sys
from sqlalchemy import create_engine, select

url = os.getenv("DATABASE_URL")
if not url:
    print("[Nexora Backend] ERROR: DATABASE_URL environment variable is not set!")
    sys.exit(1)

max_retries = 30
retry_interval = 2

for attempt in range(1, max_retries + 1):
    try:
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine = create_engine(url, connect_args=connect_args)
        with engine.connect() as conn:
            conn.execute(select(1))
        print("[Nexora Backend] Database connectivity verified.")
        sys.exit(0)
    except Exception as exc:
        print(f"[Nexora Backend] Waiting for database (attempt {attempt}/{max_retries})...")
        time.sleep(retry_interval)

print("[Nexora Backend] ERROR: Failed to connect to database within timeout.")
sys.exit(1)
'

echo "[Nexora Backend] Running database migrations with Alembic..."
alembic upgrade head
echo "[Nexora Backend] Migrations completed successfully."

echo "[Nexora Backend] Starting FastAPI server..."
exec "$@"
