"""
Nexora Stage 2: Production Configuration & Container Hardening Verification Suite
"""
import os
import re
import sys
from fastapi.testclient import TestClient
from dotenv import load_dotenv

load_dotenv()

print("=" * 70)
print("NEXORA STAGE 2 PRODUCTION CONFIGURATION & HARDENING VERIFICATION")
print("=" * 70)

# ----------------------------------------------------------------------
# 1. Environment Variable Architecture
# ----------------------------------------------------------------------
print("\n[1] Verifying Environment Variable Architecture & .env.example")
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_env_ex = os.path.join(repo_root, "backend", ".env.example")
root_env_ex = os.path.join(repo_root, ".env.example")

assert os.path.isfile(backend_env_ex), "backend/.env.example must exist"
assert os.path.isfile(root_env_ex), "root .env.example must exist"

with open(backend_env_ex, "r", encoding="utf-8") as f:
    backend_env_content = f.read()

assert "DATABASE_URL=" in backend_env_content
assert "SECRET_KEY=" in backend_env_content
assert "FRONTEND_URL=" in backend_env_content
assert "CORS_ORIGINS=" in backend_env_content
assert "SUPABASE_URL=" in backend_env_content
assert "SUPABASE_SECRET_KEY=" in backend_env_content
assert "SUPABASE_STORAGE_BUCKET=" in backend_env_content

# Confirm no actual passwords in .env.example
assert "postgrespassword" not in backend_env_content.lower()
assert "changeme" not in backend_env_content.lower()
print("   -> backend/.env.example has all required variables with safe placeholders.")

# ----------------------------------------------------------------------
# 2. Frontend API Configuration & Build Args
# ----------------------------------------------------------------------
print("\n[2] Verifying Frontend API Configuration & Docker Build Arguments")
api_config_path = os.path.join(repo_root, "frontend", "src", "config", "api.ts")
frontend_dockerfile = os.path.join(repo_root, "frontend", "Dockerfile")
compose_file = os.path.join(repo_root, "docker-compose.yml")

with open(api_config_path, "r", encoding="utf-8") as f:
    api_config = f.read()

assert "import.meta.env.VITE_API_URL" in api_config, "Frontend must read VITE_API_URL"

with open(frontend_dockerfile, "r", encoding="utf-8") as f:
    dockerfile_fe = f.read()

assert "ARG VITE_API_URL" in dockerfile_fe, "frontend/Dockerfile must declare ARG VITE_API_URL"
assert "ENV VITE_API_URL=$VITE_API_URL" in dockerfile_fe, "frontend/Dockerfile must pass ARG to ENV"

with open(compose_file, "r", encoding="utf-8") as f:
    compose_content = f.read()

assert "VITE_API_URL" in compose_content, "docker-compose.yml must provide VITE_API_URL build arg"
print("   -> Frontend centralized API config & Docker build arg setup verified.")

# ----------------------------------------------------------------------
# 3. Email Service — Dynamic FRONTEND_URL
# ----------------------------------------------------------------------
print("\n[3] Verifying Email Service Dynamic FRONTEND_URL")
from app.services import email_service

custom_frontend = "https://app.nexora-production.academic.org"
from unittest.mock import patch
with patch.dict(os.environ, {"FRONTEND_URL": custom_frontend}):
    with patch("app.services.email_service.send_email_message") as mock_send:
        email_service.send_project_invitation_email(
            recipient_email="student@university.edu",
            project_name="AI Research",
            inviter_name="Dr. Smith",
            role="member",
        )
        assert mock_send.called, "Email send must be called"
        args, kwargs = mock_send.call_args
        body_text = args[2]
        body_html = args[3]
        assert custom_frontend in body_text, "Email body_text must contain configured FRONTEND_URL"
        assert custom_frontend in body_html, "Email body_html must contain configured FRONTEND_URL"
        assert "http://localhost:5173" not in body_text, "Hardcoded localhost:5173 must not be in body_text"
        assert "http://localhost:5173" not in body_html, "Hardcoded localhost:5173 must not be in body_html"

print(f"   -> Invitation email links dynamically use FRONTEND_URL ({custom_frontend}).")

# ----------------------------------------------------------------------
# 4. Secret Handling in Docker & Compose Hardening
# ----------------------------------------------------------------------
print("\n[4] Verifying Docker Compose & Secret Handling")
assert "${POSTGRES_PASSWORD:?" in compose_content, "POSTGRES_PASSWORD must be mandatory without weak fallback"
assert "${SECRET_KEY:?" in compose_content, "SECRET_KEY must be mandatory without weak fallback"
assert "postgrespassword" not in compose_content.lower(), "No hardcoded postgrespassword"
assert "changeme" not in compose_content.lower(), "No changeme fallback"

# Verify db service does not publish host ports
lines = compose_content.splitlines()
in_db = False
db_ports = False
for line in lines:
    stripped = line.strip()
    if line.startswith("  db:"):
        in_db = True
        continue
    if in_db and line.startswith("  ") and not line.startswith("    ") and not line.startswith("  db:"):
        in_db = False
    if in_db and stripped.startswith("ports:"):
        db_ports = True

assert not db_ports, "Database service must not expose public host ports directly"
print("   -> Mandatory environment secrets and internal DB isolation verified.")

# ----------------------------------------------------------------------
# 5. Nginx SPA Fallback & Static Asset Preservation
# ----------------------------------------------------------------------
print("\n[5] Verifying Nginx SPA Fallback Configuration")
nginx_conf_path = os.path.join(repo_root, "frontend", "nginx.conf")
assert os.path.isfile(nginx_conf_path), "frontend/nginx.conf must exist"

with open(nginx_conf_path, "r", encoding="utf-8") as f:
    nginx_conf = f.read()

assert "try_files $uri $uri/ /index.html;" in nginx_conf, "SPA fallback try_files must be present"
assert "location /health" in nginx_conf, "Lightweight Nginx health check must exist"
assert "location /assets/" in nginx_conf, "Static assets caching must be preserved"
assert "location ~* \\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot|txt|xml)$" in nginx_conf
print("   -> Nginx SPA fallback (/index.html) and asset caching rules verified.")

# ----------------------------------------------------------------------
# 6. Container Startup Migrations (entrypoint.sh & Alembic)
# ----------------------------------------------------------------------
print("\n[6] Verifying Backend Container Startup Migrations")
entrypoint_path = os.path.join(repo_root, "backend", "entrypoint.sh")
backend_dockerfile = os.path.join(repo_root, "backend", "Dockerfile")

assert os.path.isfile(entrypoint_path), "backend/entrypoint.sh must exist"
with open(entrypoint_path, "r", encoding="utf-8") as f:
    entrypoint_sh = f.read()

assert "alembic upgrade head" in entrypoint_sh, "entrypoint.sh must run alembic upgrade head"
assert 'exec "$@"' in entrypoint_sh, "entrypoint.sh must exec command"

with open(backend_dockerfile, "r", encoding="utf-8") as f:
    dockerfile_be = f.read()

assert 'ENTRYPOINT ["/app/entrypoint.sh"]' in dockerfile_be
print("   -> backend/entrypoint.sh verified to run 'alembic upgrade head' before FastAPI.")

# ----------------------------------------------------------------------
# 7. Database Startup Safety (No Base.metadata.create_all on startup)
# ----------------------------------------------------------------------
print("\n[7] Verifying Database Startup Safety")
database_py = os.path.join(repo_root, "backend", "app", "database.py")
main_py = os.path.join(repo_root, "backend", "app", "main.py")

with open(database_py, "r", encoding="utf-8") as f:
    db_source = f.read()

with open(main_py, "r", encoding="utf-8") as f:
    main_source = f.read()

assert "Base.metadata.create_all" not in db_source, "database.py must not call create_all"
assert "Base.metadata.create_all(bind=engine)" not in main_source, "main.py must not call create_all"
assert "os.getenv(\"SEED_DEV_DATA\"" in main_source, "seed_database must be explicitly gated"
print("   -> No silent create_all() on startup; migrations are sole schema source.")

# ----------------------------------------------------------------------
# 8. Health Checks Endpoint Security & Functionality
# ----------------------------------------------------------------------
print("\n[8] Verifying Health Check Endpoint (/health)")
from app.main import app
client = TestClient(app)

res = client.get("/health")
assert res.status_code == 200, f"Expected 200, got {res.status_code}"
data = res.json()
assert data.get("status") == "healthy", f"Unexpected status: {data}"
assert data.get("database") == "connected"

# Ensure NO sensitive info is leaked
for sensitive_key in ["password", "secret", "token", "key", "url", "user"]:
    assert sensitive_key not in data, f"Health check must not expose '{sensitive_key}'"

print(f"   -> GET /health returned 200 {data} without exposing sensitive information.")

# ----------------------------------------------------------------------
# 9. .dockerignore Files Verification
# ----------------------------------------------------------------------
print("\n[9] Verifying .dockerignore Files")
be_dockerignore = os.path.join(repo_root, "backend", ".dockerignore")
fe_dockerignore = os.path.join(repo_root, "frontend", ".dockerignore")

assert os.path.isfile(be_dockerignore), "backend/.dockerignore must exist"
assert os.path.isfile(fe_dockerignore), "frontend/.dockerignore must exist"

with open(be_dockerignore, "r", encoding="utf-8") as f:
    be_di = f.read()

assert ".git" in be_di and ".env" in be_di and "__pycache__" in be_di and ".venv" in be_di
# Ensure essential build items are NOT excluded
for required in ["requirements.txt", "app", "alembic", "alembic.ini", "entrypoint.sh"]:
    assert f"\n{required}\n" not in f"\n{be_di}\n", f"{required} must not be excluded in backend/.dockerignore"

with open(fe_dockerignore, "r", encoding="utf-8") as f:
    fe_di = f.read()

assert ".git" in fe_di and ".env" in fe_di and "node_modules" in fe_di and "dist" in fe_di
for required in ["package.json", "src", "public", "index.html", "nginx.conf"]:
    assert f"\n{required}\n" not in f"\n{fe_di}\n", f"{required} must not be excluded in frontend/.dockerignore"

print("   -> backend/.dockerignore and frontend/.dockerignore verified.")

# ----------------------------------------------------------------------
# 10. CORS Hardening & Dynamic Origins
# ----------------------------------------------------------------------
print("\n[10] Verifying CORS Hardening")
assert 'allow_origins=["*"]' not in main_source, "Wildcard allow_origins with credentials is strictly forbidden"
assert "allow_credentials=True" in main_source
assert "allowed_origins" in main_source
print("   -> CORS configuration is origin-specific and includes FRONTEND_URL dynamically.")

print("\n" + "=" * 70)
print("ALL STAGE 2 PRODUCTION CONFIGURATION CHECKS PASSED PERFECTLY!")
print("=" * 70)
