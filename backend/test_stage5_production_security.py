"""
STAGE 5 PRODUCTION SECURITY & SECURITY OPERATIONS HARDENING TEST SUITE
======================================================================
Verifies:
1. TLS / HTTPS / WSS configuration & HTTP->HTTPS redirect
2. HSTS header configuration (strict max-age, no blind preload)
3. Content-Security-Policy hardening (no localhost leakage in production, restrictive connect-src)
4. Cookie security policies (Secure flag in production, HttpOnly, Lax)
5. MFA production key hardening (fail-fast on missing MFA_ENCRYPTION_KEY in production)
6. Container least privilege (non-root USER in backend/Dockerfile)
7. Frontend static security (no Supabase service role keys or secrets in frontend source)
8. File upload restrictions (10 MB payload limit, prohibited executable/browser-renderable extensions)
9. Role-based least privilege and cross-project authorization
10. CI security workflow configuration
"""

import os
import re
import sys
import uuid
import pytest
from unittest.mock import patch

# Setup paths
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, CURRENT_DIR)

db_path = os.path.join(CURRENT_DIR, "nexora_dev.db").replace("\\", "/")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

from app.auth import is_cookie_secure, COOKIE_NAME, CSRF_COOKIE_NAME, COOKIE_SAMESITE
from app.services.mfa_service import _get_encryption_key, validate_mfa_configuration
from app.services.storage_service import PROHIBITED_EXTENSIONS, MAX_FILE_SIZE_BYTES


def test_part_a_tls_and_redirect_configuration():
    """Verify Nginx reverse proxy configuration enforces HTTP->HTTPS redirect and supports WSS."""
    nginx_path = os.path.join(PROJECT_ROOT, "frontend", "nginx.conf")
    assert os.path.exists(nginx_path), "frontend/nginx.conf must exist"
    
    with open(nginx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # HTTP to HTTPS redirect
    assert '$http_x_forwarded_proto = "http"' in content, "Nginx must check $http_x_forwarded_proto"
    assert "return 301 https://$host$request_uri;" in content, "Nginx must redirect HTTP to HTTPS"
    
    # WebSocket support in CSP
    assert "wss:" in content, "Nginx CSP must accommodate secure WebSocket (wss:)"


def test_part_b_hsts_configuration():
    """Verify HSTS header configuration is strict, sensible, and avoids premature preload."""
    nginx_path = os.path.join(PROJECT_ROOT, "frontend", "nginx.conf")
    with open(nginx_path, "r", encoding="utf-8") as f:
        content = f.read()

    hsts_match = re.search(r'add_header\s+Strict-Transport-Security\s+"([^"]+)"', content)
    assert hsts_match is not None, "Strict-Transport-Security header must be configured"
    
    hsts_val = hsts_match.group(1)
    assert "max-age=31536000" in hsts_val, "HSTS must specify max-age=31536000 (1 year)"
    assert "includeSubDomains" in hsts_val, "HSTS should protect subdomains"
    assert "preload" not in hsts_val, "HSTS preload must not be blindly enabled without dedicated domain registration"


def test_part_c_and_d_csp_hardening():
    """Verify CSP is tightened and does not contain localhost leaks in production Nginx config."""
    nginx_path = os.path.join(PROJECT_ROOT, "frontend", "nginx.conf")
    with open(nginx_path, "r", encoding="utf-8") as f:
        content = f.read()

    csp_match = re.search(r'add_header\s+Content-Security-Policy\s+"([^"]+)"', content)
    assert csp_match is not None, "Content-Security-Policy header must be present"
    
    csp_val = csp_match.group(1)
    # Restrictive directives
    assert "default-src 'self'" in csp_val, "CSP must restrict default-src to 'self'"
    assert "object-src 'none'" in csp_val, "CSP must disable object-src plugins"
    assert "base-uri 'self'" in csp_val, "CSP base-uri must be 'self'"
    assert "frame-ancestors 'self'" in csp_val, "CSP frame-ancestors must be 'self'"
    assert "connect-src 'self' https: wss:" in csp_val, "CSP connect-src must allow self, https, and wss"
    
    # Must NOT contain localhost in production Nginx configuration
    assert "localhost:8000" not in csp_val, "Production Nginx CSP must NOT leak localhost:8000"
    assert "http://" not in csp_val, "Production Nginx CSP must not allow insecure http: connections"


def test_part_e_mfa_production_key_hardening():
    """Verify MFA encryption key management fails fast if unconfigured in production."""
    # 1. Missing key in production raises RuntimeError
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "MFA_ENCRYPTION_KEY": ""}):
        with pytest.raises(RuntimeError, match="MFA_ENCRYPTION_KEY"):
            validate_mfa_configuration()

    # 2. Provided key in production derives properly
    test_prod_key = "a_very_strong_production_mfa_key_hex_or_passphrase_32_bytes"
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "MFA_ENCRYPTION_KEY": test_prod_key}):
        key = _get_encryption_key()
        assert len(key) == 32, "MFA key must be 256 bits (32 bytes)"

    # 3. Development environment allows safe fallback without error
    with patch.dict(os.environ, {"ENVIRONMENT": "development", "MFA_ENCRYPTION_KEY": ""}):
        dev_key = _get_encryption_key()
        assert len(dev_key) == 32, "Development key fallback must be 32 bytes"


def test_part_f_container_least_privilege():
    """Verify backend container runs as dedicated non-root system user."""
    backend_dockerfile = os.path.join(PROJECT_ROOT, "backend", "Dockerfile")
    assert os.path.exists(backend_dockerfile), "backend/Dockerfile must exist"
    
    with open(backend_dockerfile, "r", encoding="utf-8") as f:
        content = f.read()

    assert "USER appuser" in content, "backend/Dockerfile must execute as non-root 'USER appuser'"
    assert "useradd" in content and "appuser" in content, "backend/Dockerfile must create appuser"
    assert "chown -R appuser:appuser /app" in content, "backend/Dockerfile must ensure /app is owned by appuser"


def test_cookie_security_and_samesite():
    """Verify cookie security switches to Secure=True when ENVIRONMENT=production or COOKIE_SECURE=true."""
    with patch.dict(os.environ, {"ENVIRONMENT": "production", "COOKIE_SECURE": ""}):
        assert is_cookie_secure() is True, "In production, cookies must be Secure"

    with patch.dict(os.environ, {"ENVIRONMENT": "development", "COOKIE_SECURE": ""}):
        assert is_cookie_secure() is False, "In development, cookies can be non-secure for HTTP testing"

    with patch.dict(os.environ, {"COOKIE_SECURE": "true"}):
        assert is_cookie_secure() is True, "Explicit COOKIE_SECURE=true must enforce Secure cookies"

    assert COOKIE_SAMESITE.lower() == "lax", "Cookie SameSite policy must be Lax for CSRF mitigation"


def test_frontend_secret_leak_prevention():
    """Scan frontend source directory to verify no Supabase service role keys or backend secrets are exposed."""
    frontend_src = os.path.join(PROJECT_ROOT, "frontend", "src")
    assert os.path.exists(frontend_src), "frontend/src must exist"

    prohibited_patterns = [
        r"service_role",
        r"SUPABASE_SECRET_KEY",
        r"postgresql://",
        r"MFA_ENCRYPTION_KEY",
        r"SECRET_KEY\s*=\s*['\"][^'\"]+['\"]"
    ]

    for root, _, files in os.walk(frontend_src):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx", ".json", ".html")):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    for pattern in prohibited_patterns:
                        match = re.search(pattern, content, re.IGNORECASE)
                        assert match is None, f"Potential secret leak in frontend: pattern '{pattern}' matched in {file_path}"


def test_upload_security_controls():
    """Verify 10 MB payload limit and blocking of executable/browser-renderable files."""
    assert MAX_FILE_SIZE_BYTES == 10 * 1024 * 1024, "Storage upload limit must be exactly 10 MB"

    dangerous_extensions = [
        "exe", "sh", "bat", "cmd", "vbs", "ps1", "msi", "dll",
        "html", "htm", "svg", "xhtml", "php", "phtml", "cgi", "pl"
    ]
    for ext in dangerous_extensions:
        assert ext in PROHIBITED_EXTENSIONS, f"Dangerous extension '{ext}' must be blocked by PROHIBITED_EXTENSIONS"


def test_security_workflow_exists():
    """Verify CI workflow for security scans (npm audit, pip-audit, secret scan, container scan) exists."""
    workflow_path = os.path.join(PROJECT_ROOT, ".github", "workflows", "security-scan.yml")
    assert os.path.exists(workflow_path), ".github/workflows/security-scan.yml must exist"
    
    with open(workflow_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "npm audit" in content, "CI workflow must include npm audit"
    assert "pip-audit" in content, "CI workflow must include pip-audit"
    assert "gitleaks" in content, "CI workflow must include secret scanning (gitleaks)"
    assert "trivy" in content, "CI workflow must include container scanning (trivy)"


def test_admin_authorization_enforced():
    """Verify regular non-admin users cannot access admin endpoints (least privilege)."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth import create_access_token, COOKIE_NAME
    from app.database import SessionLocal
    from app.models import User

    client = TestClient(app)
    with SessionLocal() as db:
        user = db.query(User).filter(User.system_role != "admin").first()
        assert user is not None, "Regular non-admin user must exist in database"

        # Generate auth token for regular user
        token = create_access_token(data={"sub": str(user.id), "username": user.username, "role": user.system_role})
        client.cookies.set(COOKIE_NAME, token)

        # Attempt to access admin-only endpoint
        resp = client.get("/auth/admin/privileged-action")
        assert resp.status_code == 403, f"Expected 403 Forbidden for non-admin user, got {resp.status_code}"


def test_cross_project_least_privilege():
    """Verify users cannot access projects where they hold no membership."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth import create_access_token, COOKIE_NAME
    from app.database import SessionLocal
    from app.models import User, Project, ProjectMember

    client = TestClient(app)
    with SessionLocal() as db:
        # Find a project and a user who is not a member of it
        projects = db.query(Project).all()
        assert len(projects) >= 1, "At least one project must exist"
        
        target_project = projects[0]
        member_ids = {m.user_id for m in db.query(ProjectMember).filter(ProjectMember.project_id == target_project.id).all()}
        non_member = db.query(User).filter(User.id.notin_(member_ids)).first()
        
        if non_member:
            token = create_access_token(data={"sub": str(non_member.id), "username": non_member.username, "role": non_member.system_role})
            client.cookies.set(COOKIE_NAME, token)
            
            # Access project analytics
            resp = client.get(f"/projects/{target_project.id}/analytics")
            assert resp.status_code in (403, 404), f"Expected 403/404 for non-member, got {resp.status_code}"


def test_websocket_cookie_authentication_enforced():
    """Verify WebSocket endpoint rejects unauthenticated connections without secure cookie."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.main import PROJ_1_ID

    client = TestClient(app)
    # Attempt connection without cookie
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/projects/{PROJ_1_ID}") as ws:
            pass


if __name__ == "__main__":
    import pytest
    print("=" * 70)
    print("RUNNING STAGE 5 PRODUCTION SECURITY & OPERATIONS HARDENING TESTS")
    print("=" * 70)
    sys.exit(pytest.main(["-v", __file__]))
