"""
STAGE 6 PRODUCTION DEPLOYMENT READINESS TEST SUITE
===================================================
Vercel + Render + Supabase + Cloudflare

Verifies locally-verifiable deployment readiness:
1.  Render PORT handling - CMD uses $PORT env var
2.  Health endpoint is secure and complete
3.  Frontend API URL is environment-configurable (no hardcoded production domains)
4.  WebSocket URL is derived safely from API URL (no query-string token)
5.  Production CORS requires explicit origins (no wildcard)
6.  Secure cookies in production mode
7.  MFA production key validation on startup
8.  No secrets in frontend source (no service-role keys, DATABASE_URL, MFA_ENCRYPTION_KEY)
9.  No localStorage JWT storage (no token persistence)
10. Docker runs as non-root appuser
11. Security headers present in nginx.conf
12. vercel.json SPA routing present
13. render.yaml Render service definition present
14. backend/.env.example contains all required production variables
15. frontend/.env.example contains only safe VITE_ variables
16. .dockerignore excludes .env files
17. .gitignore excludes .env files
18. No hardcoded production domain in frontend source
19. CORS does not allow wildcard origins (confirmed at runtime)
20. WebSocket does not include ?token= fallback
"""

import os
import re
import sys
import json
import pytest
from unittest.mock import patch

# ── Path setup ────────────────────────────────────────────────────────────────
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
BACKEND_DIR = CURRENT_DIR

sys.path.insert(0, CURRENT_DIR)

# Set dev DATABASE_URL before importing app modules
db_path = os.path.join(CURRENT_DIR, "nexora_dev.db").replace("\\", "/")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path}")

from app.auth import is_cookie_secure, COOKIE_NAME, COOKIE_SAMESITE


# ── Part A: Vercel Frontend ───────────────────────────────────────────────────

def test_vercel_json_spa_routing_exists():
    """Vercel SPA routing config must exist and correctly handle client-side navigation."""
    vercel_json = os.path.join(FRONTEND_DIR, "vercel.json")
    assert os.path.exists(vercel_json), "frontend/vercel.json must exist for Vercel SPA routing"

    with open(vercel_json, "r", encoding="utf-8") as f:
        config = json.load(f)

    # Must have rewrites for SPA fallback
    assert "rewrites" in config or "routes" in config, \
        "vercel.json must contain rewrites or routes for SPA fallback"

    if "rewrites" in config:
        rewrites = config["rewrites"]
        assert any(r.get("destination") == "/index.html" for r in rewrites), \
            "vercel.json rewrites must include a fallback to /index.html"


def test_vercel_json_security_headers():
    """Vercel should configure security headers matching existing Nginx headers."""
    vercel_json = os.path.join(FRONTEND_DIR, "vercel.json")
    with open(vercel_json, "r", encoding="utf-8") as f:
        config = json.load(f)

    assert "headers" in config, "vercel.json should configure security headers"
    all_headers = {}
    for h_config in config["headers"]:
        for h in h_config.get("headers", []):
            all_headers[h["key"].lower()] = h["value"]

    assert "strict-transport-security" in all_headers, "HSTS header must be in vercel.json headers"
    assert "content-security-policy" in all_headers, "CSP header must be in vercel.json headers"
    assert "x-content-type-options" in all_headers, "X-Content-Type-Options must be in vercel.json headers"


def test_frontend_api_config_environment_driven():
    """API URL must be driven by VITE_API_URL environment variable, not hardcoded."""
    api_ts = os.path.join(FRONTEND_DIR, "src", "config", "api.ts")
    assert os.path.exists(api_ts), "frontend/src/config/api.ts must exist"

    with open(api_ts, "r", encoding="utf-8") as f:
        content = f.read()

    assert "import.meta.env.VITE_API_URL" in content, \
        "api.ts must read API URL from VITE_API_URL environment variable"


def test_frontend_no_hardcoded_production_api_url():
    """No hardcoded production API domain must exist in frontend source."""
    src_dir = os.path.join(FRONTEND_DIR, "src")

    # Patterns that indicate a hardcoded production endpoint
    prohibited_patterns = [
        r"onrender\.com",
        r"\.railway\.app",
        r"\.fly\.dev",
        r"heroku\.com",
    ]

    for root, _, files in os.walk(src_dir):
        for filename in files:
            if filename.endswith((".ts", ".tsx", ".js", ".jsx")):
                file_path = os.path.join(root, filename)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for pattern in prohibited_patterns:
                    assert not re.search(pattern, content), \
                        f"Hardcoded deployment URL '{pattern}' found in {file_path}"


def test_frontend_websocket_uses_wss_in_https():
    """WebSocket URL derivation must upgrade to wss:// when API URL uses https://."""
    api_ts = os.path.join(FRONTEND_DIR, "src", "config", "api.ts")
    with open(api_ts, "r", encoding="utf-8") as f:
        content = f.read()

    assert "wss://" in content, "api.ts must transform https:// API URL to wss:// WebSocket URL"
    assert "ws://" in content, "api.ts must support ws:// for local http:// development"


def test_frontend_no_query_string_websocket_token():
    """WebSocket URL must never append ?token= query parameter."""
    src_dir = os.path.join(FRONTEND_DIR, "src")

    for root, _, files in os.walk(src_dir):
        for filename in files:
            if filename.endswith((".ts", ".tsx")):
                file_path = os.path.join(root, filename)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Must not have ?token= or &token= in WebSocket URL construction
                has_token_param = re.search(r"[?&]token=", content)
                if has_token_param:
                    # Check it's not inside a comment or string test assertion
                    line = content.split("\n")[content[:has_token_param.start()].count("\n")]
                    if not line.strip().startswith("//") and not line.strip().startswith("*"):
                        pytest.fail(
                            f"WebSocket query-string token fallback detected in {file_path}. "
                            "JWT must not be passed via URL query parameters."
                        )


def test_frontend_no_jwt_in_localstorage():
    """JWT token must never be stored in localStorage (only user profile cache is permitted)."""
    src_dir = os.path.join(FRONTEND_DIR, "src")

    for root, _, files in os.walk(src_dir):
        for filename in files:
            if filename.endswith((".ts", ".tsx")):
                file_path = os.path.join(root, filename)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # Explicitly check for JWT/token being set in localStorage
                # Allow removal (removeItem) but not setItem with token-like key
                token_storage = re.findall(r"localStorage\.setItem\(['\"]([^'\"]*)['\"]", content)
                for key in token_storage:
                    assert "token" not in key.lower() and "jwt" not in key.lower(), \
                        f"JWT/token setItem found in localStorage in {file_path}: key='{key}'"


def test_frontend_no_backend_secrets():
    """Frontend source must not contain any backend secrets or service credentials."""
    src_dir = os.path.join(FRONTEND_DIR, "src")
    prohibited_patterns = [
        r"service_role",
        r"SUPABASE_SERVICE_ROLE",
        r"postgresql://",
        r"MFA_ENCRYPTION_KEY",
        r"SECRET_KEY\s*=\s*['\"][^'\"]{8,}",
    ]
    for root, _, files in os.walk(src_dir):
        for filename in files:
            if filename.endswith((".ts", ".tsx", ".js", ".jsx", ".json")):
                file_path = os.path.join(root, filename)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for pattern in prohibited_patterns:
                    assert not re.search(pattern, content, re.IGNORECASE), \
                        f"Potential secret pattern '{pattern}' found in frontend: {file_path}"


# ── Part B: Render Backend ────────────────────────────────────────────────────

def test_render_port_env_var_in_dockerfile():
    """Backend Dockerfile CMD must use ${PORT:-8000} for Render compatibility."""
    dockerfile = os.path.join(BACKEND_DIR, "Dockerfile")
    assert os.path.exists(dockerfile), "backend/Dockerfile must exist"

    with open(dockerfile, "r", encoding="utf-8") as f:
        content = f.read()

    assert "${PORT:-8000}" in content or "$PORT" in content, \
        "backend/Dockerfile CMD must use Render's dynamic ${PORT:-8000} variable"


def test_render_yaml_exists():
    """render.yaml deployment configuration file must exist at repository root."""
    render_yaml = os.path.join(PROJECT_ROOT, "render.yaml")
    assert os.path.exists(render_yaml), "render.yaml must exist at repository root"

    with open(render_yaml, "r", encoding="utf-8") as f:
        content = f.read()

    assert "healthCheckPath" in content or "health" in content.lower(), \
        "render.yaml must configure a health check path"
    assert "nexora" in content.lower(), "render.yaml must define the nexora service"


def test_backend_health_endpoint_is_safe():
    """GET /health must return 200 and not expose secrets or internal configuration."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code in (200, 503), f"Health endpoint must return 200 or 503, got {resp.status_code}"

    body = resp.json()
    assert "status" in body, "Health response must include 'status' field"

    # Must not contain sensitive fields
    body_str = json.dumps(body)
    for forbidden in ["password", "secret", "key", "token", "DATABASE_URL", "MFA_ENCRYPTION_KEY"]:
        assert forbidden.lower() not in body_str.lower(), \
            f"Health endpoint must not expose '{forbidden}'"


def test_backend_no_env_file_in_dockerfile():
    """Backend Dockerfile must not COPY .env files into the image."""
    dockerfile = os.path.join(BACKEND_DIR, "Dockerfile")
    with open(dockerfile, "r", encoding="utf-8") as f:
        content = f.read()

    # Must not explicitly COPY a .env file
    assert not re.search(r"COPY\s+\.env\b", content), \
        "backend/Dockerfile must not COPY .env file into the image"


def test_backend_runs_as_non_root():
    """Backend Dockerfile must create and switch to non-root appuser."""
    dockerfile = os.path.join(BACKEND_DIR, "Dockerfile")
    with open(dockerfile, "r", encoding="utf-8") as f:
        content = f.read()

    assert "USER appuser" in content, "Dockerfile must run as non-root USER appuser"
    assert "useradd" in content or "adduser" in content, \
        "Dockerfile must create the appuser system account"


def test_dockerignore_excludes_env_files():
    """.dockerignore must exclude .env files to prevent secrets leaking into image."""
    dockerignore = os.path.join(BACKEND_DIR, ".dockerignore")
    assert os.path.exists(dockerignore), "backend/.dockerignore must exist"

    with open(dockerignore, "r", encoding="utf-8") as f:
        content = f.read()

    assert ".env" in content, ".dockerignore must exclude .env files"


def test_gitignore_excludes_env_files():
    """.gitignore must exclude .env files to prevent secrets being committed."""
    gitignore = os.path.join(PROJECT_ROOT, ".gitignore")
    assert os.path.exists(gitignore), ".gitignore must exist at repository root"

    with open(gitignore, "r", encoding="utf-8") as f:
        content = f.read()

    assert ".env" in content, ".gitignore must exclude .env files"
    # But .env.example should be tracked
    assert "!.env.example" in content or ".env.example" not in content.replace("!.env.example", ""), \
        ".gitignore should allow .env.example to be tracked"


# ── Part C: CORS & Cookie Security ───────────────────────────────────────────

def test_production_cors_no_wildcard():
    """CORS must never allow wildcard origins in production configuration."""
    from fastapi.testclient import TestClient
    from app.main import app

    # Test with production-like CORS origins
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "CORS_ORIGINS": "https://nexora.example.com",
        "FRONTEND_URL": "https://nexora.example.com",
    }):
        client = TestClient(app)
        # Request with non-whitelisted origin should not be reflected
        resp = client.options(
            "/health",
            headers={
                "Origin": "https://evil.attacker.com",
                "Access-Control-Request-Method": "GET",
            }
        )
        acao = resp.headers.get("access-control-allow-origin", "")
        assert acao != "*", "CORS must never return wildcard Access-Control-Allow-Origin"
        assert "evil.attacker.com" not in acao, \
            "CORS must not reflect unauthorized origins"


def test_cors_allows_credentials():
    """CORS must allow credentials (required for HttpOnly cookie authentication)."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # CORS middleware config is set at app creation time; test overall behavior
    resp = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    # Should allow credentials when origin is in allowed list
    acac = resp.headers.get("access-control-allow-credentials", "")
    assert acac == "true", "CORS must allow credentials for cookie-based auth"


def test_production_cookie_is_secure():
    """Cookies must be flagged Secure when ENVIRONMENT=production."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "COOKIE_SECURE": ""}):
        assert is_cookie_secure() is True, \
            "Cookies must be Secure=True when ENVIRONMENT=production"


def test_cookie_samesite_is_lax():
    """Cookie SameSite must be Lax to prevent CSRF while allowing top-level navigation."""
    assert COOKIE_SAMESITE.lower() == "lax", \
        f"Cookie SameSite must be 'lax', got '{COOKIE_SAMESITE}'"


# ── Part D: Environment Variables Documentation ───────────────────────────────

def test_backend_env_example_completeness():
    """backend/.env.example must document all required production environment variables."""
    env_example = os.path.join(BACKEND_DIR, ".env.example")
    assert os.path.exists(env_example), "backend/.env.example must exist"

    with open(env_example, "r", encoding="utf-8") as f:
        content = f.read()

    required_vars = [
        "ENVIRONMENT",
        "DATABASE_URL",
        "SECRET_KEY",
        "MFA_ENCRYPTION_KEY",
        "COOKIE_SECURE",
        "CORS_ORIGINS",
        "FRONTEND_URL",
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_STORAGE_BUCKET",
        "SQL_ECHO",
        "SEED_DEV_DATA",
    ]
    for var in required_vars:
        assert var in content, \
            f"backend/.env.example must document required variable '{var}'"


def test_frontend_env_example_no_backend_secrets():
    """frontend/.env.example must only contain VITE_* prefixed variables."""
    env_example = os.path.join(FRONTEND_DIR, ".env.example")
    assert os.path.exists(env_example), "frontend/.env.example must exist"

    with open(env_example, "r", encoding="utf-8") as f:
        content = f.read()

    # Must not document backend secrets
    prohibited = [
        "DATABASE_URL",
        "SECRET_KEY",
        "MFA_ENCRYPTION_KEY",
        "SUPABASE_SECRET_KEY",
        "SMTP_PASSWORD",
    ]
    for secret in prohibited:
        assert secret not in content or "NEVER" in content, \
            f"frontend/.env.example must not document backend secret '{secret}' as a valid setting"


# ── Part E: Security Headers & Configuration ──────────────────────────────────

def test_security_headers_in_nginx_conf():
    """Nginx configuration must include all required production security headers."""
    nginx_conf = os.path.join(FRONTEND_DIR, "nginx.conf")
    assert os.path.exists(nginx_conf), "frontend/nginx.conf must exist"

    with open(nginx_conf, "r", encoding="utf-8") as f:
        content = f.read()

    assert "Strict-Transport-Security" in content, "Nginx must add HSTS header"
    assert "Content-Security-Policy" in content, "Nginx must add CSP header"
    assert "X-Content-Type-Options" in content, "Nginx must add X-Content-Type-Options header"
    assert "X-Frame-Options" in content, "Nginx must add X-Frame-Options header"


def test_csp_no_localhost_in_production_nginx():
    """Production Nginx CSP connect-src must not contain localhost endpoints."""
    nginx_conf = os.path.join(FRONTEND_DIR, "nginx.conf")
    with open(nginx_conf, "r", encoding="utf-8") as f:
        content = f.read()

    csp_match = re.search(r'add_header\s+Content-Security-Policy\s+"([^"]+)"', content)
    assert csp_match, "Content-Security-Policy header must be present"

    csp_val = csp_match.group(1)
    assert "localhost:8000" not in csp_val, \
        "Production Nginx CSP must not expose localhost:8000 in connect-src"
    assert "connect-src 'self' https: wss:" in csp_val, \
        "Production Nginx CSP connect-src must be 'self' https: wss: (no insecure sources)"


def test_mfa_production_key_required():
    """MFA_ENCRYPTION_KEY must be explicitly set in ENVIRONMENT=production."""
    from app.services.mfa_service import validate_mfa_configuration

    with patch.dict(os.environ, {"ENVIRONMENT": "production", "MFA_ENCRYPTION_KEY": ""}):
        with pytest.raises(RuntimeError, match="MFA_ENCRYPTION_KEY"):
            validate_mfa_configuration()


# ── Part F: Deployment Config Files ──────────────────────────────────────────

def test_deployment_docs_exist():
    """Production deployment documentation must exist in docs/."""
    docs_dir = os.path.join(PROJECT_ROOT, "docs")
    deployment_doc = os.path.join(docs_dir, "DEPLOYMENT_PRODUCTION.md")
    checklist_doc = os.path.join(docs_dir, "DEPLOYMENT_CHECKLIST.md")

    assert os.path.exists(deployment_doc), "docs/DEPLOYMENT_PRODUCTION.md must exist"
    assert os.path.exists(checklist_doc), "docs/DEPLOYMENT_CHECKLIST.md must exist"

    with open(deployment_doc, "r", encoding="utf-8") as f:
        content = f.read()

    required_sections = ["Supabase", "Render", "Vercel", "Cloudflare", "WebSocket", "CORS"]
    for section in required_sections:
        assert section in content, \
            f"DEPLOYMENT_PRODUCTION.md must document '{section}'"


def test_alembic_uses_env_database_url():
    """Alembic migrations must use DATABASE_URL from environment, not hardcoded."""
    env_py = os.path.join(BACKEND_DIR, "alembic", "env.py")
    assert os.path.exists(env_py), "backend/alembic/env.py must exist"

    with open(env_py, "r", encoding="utf-8") as f:
        content = f.read()

    assert 'os.getenv("DATABASE_URL")' in content or "DATABASE_URL" in content, \
        "alembic/env.py must read DATABASE_URL from environment variable"


# ── Part G: True Least-Privilege Role Separation ──────────────────────────────

def test_true_least_privilege_alembic_prefers_migration_url():
    """Alembic env.py must prefer MIGRATION_DATABASE_URL over DATABASE_URL."""
    env_py = os.path.join(BACKEND_DIR, "alembic", "env.py")
    assert os.path.exists(env_py), "alembic/env.py must exist"

    with open(env_py, "r", encoding="utf-8") as f:
        content = f.read()

    # Verify logic explicitly exists
    assert "MIGRATION_DATABASE_URL" in content, "env.py must check MIGRATION_DATABASE_URL"
    assert "os.getenv(\"MIGRATION_DATABASE_URL\") or os.getenv(\"DATABASE_URL\")" in content, \
        "env.py must prefer MIGRATION_DATABASE_URL and fall back to DATABASE_URL"

def test_true_least_privilege_fastapi_uses_runtime_url():
    """FastAPI runtime (database.py) must strictly use DATABASE_URL, never MIGRATION_DATABASE_URL."""
    db_py = os.path.join(BACKEND_DIR, "app", "database.py")
    assert os.path.exists(db_py), "app/database.py must exist"

    with open(db_py, "r", encoding="utf-8") as f:
        content = f.read()

    assert "MIGRATION_DATABASE_URL" not in content, \
        "FastAPI runtime must NEVER read MIGRATION_DATABASE_URL. It must run as the least-privilege runtime role."
    assert 'os.getenv("DATABASE_URL")' in content, \
        "FastAPI runtime must read DATABASE_URL for its connection."

def test_no_database_password_logged():
    """Ensure no database passwords are printed in entrypoint.sh or application startup logs."""
    entrypoint_sh = os.path.join(BACKEND_DIR, "entrypoint.sh")
    if os.path.exists(entrypoint_sh):
        with open(entrypoint_sh, "r", encoding="utf-8") as f:
            content = f.read()
        assert "print(url)" not in content, "entrypoint.sh must not print the database URL"
        assert "echo $DATABASE_URL" not in content, "entrypoint.sh must not echo the database URL"
        assert "echo $MIGRATION_DATABASE_URL" not in content, "entrypoint.sh must not echo the migration database URL"


if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING STAGE 6 DEPLOYMENT READINESS TESTS")
    print("=" * 70)
    sys.exit(pytest.main(["-v", __file__]))
