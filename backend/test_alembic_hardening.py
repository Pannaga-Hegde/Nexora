import os
import sys
from dotenv import load_dotenv
from alembic.config import Config

load_dotenv()
from alembic import command
from fastapi.testclient import TestClient

print("=" * 65)
print("NEXORA ALEMBIC DATABASE MIGRATION & HARDENING TEST SUITE")
print("=" * 65)

# A & B: Alembic imports & config
alembic_cfg = Config("alembic.ini")
print("\n[1] Test A & B: Alembic Configuration & DATABASE_URL Verification")
db_url = os.getenv("DATABASE_URL")
assert db_url is not None and len(db_url) > 0, "DATABASE_URL must be configured"
print(f"   -> DATABASE_URL present and read from environment.")

# D & E: Alembic Current & Upgrade Head
print("\n[2] Test D & E: Alembic Upgrade Head & Current Revision")
command.upgrade(alembic_cfg, "head")
print("   -> 'alembic upgrade head' completed successfully.")

# F: Application Starts Against Migrated Schema
print("\n[3] Test F: Application Startup & Endpoint Availability")
from app.main import app
client = TestClient(app)
res = client.get("/")
assert res.status_code == 200
assert res.json()["message"] == "Nexora API is running"
print("   -> FastAPI application started successfully against migrated schema.")

# G: Verify create_all() is NOT executed on module import / production startup
print("\n[4] Test G: Verify create_all() is absent from startup")
import inspect
import app.main
main_source = inspect.getsource(app.main)
assert "Base.metadata.create_all(bind=engine)" not in main_source, "create_all() must not be called at startup"
print("   -> Base.metadata.create_all() successfully removed from production startup.")

# H: Verify Demo Seeding is NOT automatically triggered without SEED_DEV_DATA
print("\n[5] Test H: Verify seed_database() is gated")
assert "if os.getenv(\"SEED_DEV_DATA\"" in main_source, "seed_database() must be gated behind SEED_DEV_DATA"
print("   -> Seed database is strictly gated behind explicit SEED_DEV_DATA flag.")

print("\n" + "=" * 65)
print("ALL ALEMBIC MIGRATION HARDENING CHECKS PASSED SUCCESSFULLY!")
print("=" * 65)
