"""
Stage 4 Production Identity & Transport Security Test Suite.
Tests:
- Cookie-based authentication (HttpOnly, SameSite, Secure, Path)
- CSRF defense (Double-submit cookie + header on state-changing methods)
- RFC 6238 TOTP Multi-Factor Authentication
- Admin/Privileged account MFA enforcement
- Single-use hashed recovery codes
- Authentication rate limiting (Login, MFA, Registration)
- WebSocket cookie authentication handshake
- Stage 1 / Stage 3A regression compliance
"""
import uuid
import time
import secrets
from datetime import timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User, Project, ProjectMember
from app.auth import get_password_hash, create_access_token, COOKIE_NAME, CSRF_COOKIE_NAME
from app.services.mfa_service import mfa_service
from app.services.rate_limiter import auth_rate_limiter

client = TestClient(app)

print("=" * 65)
print("STAGE 4 AUTHENTICATION & TRANSPORT SECURITY: TEST SUITE")
print("=" * 65)

passed_count = 0
total_count = 0

def check(condition: bool, description: str):
    global passed_count, total_count
    total_count += 1
    if condition:
        passed_count += 1
        print(f"[PASS] #{total_count:02d}: {description}")
    else:
        print(f"[FAIL] #{total_count:02d}: {description}")
        raise AssertionError(f"Test failed: {description}")

def run_tests():
    db = SessionLocal()
    # Reset in-memory rate limiter buckets before testing
    auth_rate_limiter.clear()

    try:
        # Seed test user and project
        user_pwd = "Stage4Password123!"
        hashed_pwd = get_password_hash(user_pwd)
        user_id = uuid.uuid4()
        username = f"stage4_user_{uuid.uuid4().hex[:6]}"
        email = f"stage4_{uuid.uuid4().hex[:6]}@example.com"

        user = User(
            id=user_id,
            username=username,
            email=email,
            full_name="Stage 4 Test User",
            password_hash=hashed_pwd,
            system_role="student",
        )
        db.add(user)

        # Seed admin user
        admin_id = uuid.uuid4()
        admin_username = f"stage4_admin_{uuid.uuid4().hex[:6]}"
        admin_email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
        admin_user = User(
            id=admin_id,
            username=admin_username,
            email=admin_email,
            full_name="Stage 4 Admin",
            password_hash=hashed_pwd,
            system_role="admin",
        )
        db.add(admin_user)

        # Seed test project and membership
        proj_id = uuid.uuid4()
        project = Project(
            id=proj_id,
            name="Stage 4 Project",
            description="Testing cookie auth and WS",
            status="Active",
        )
        db.add(project)
        db.flush()

        member = ProjectMember(
            project_id=proj_id,
            user_id=user_id,
            project_role="manager",
        )
        db.add(member)

        # Seed a second project where user is NOT a member
        proj2_id = uuid.uuid4()
        project2 = Project(
            id=proj2_id,
            name="Stage 4 Project Isolated",
            description="Testing isolation",
            status="Active",
        )
        db.add(project2)
        db.commit()

        # ========================================================
        # 1. AUTHENTICATION & COOKIE SECURITY (1-8)
        # ========================================================
        # 1. Valid login sets auth and csrf cookies
        login_res = client.post("/auth/token", data={"username": username, "password": user_pwd})
        check(login_res.status_code == 200, "Valid login returns 200")
        check(login_res.json().get("access_token") is None, "Valid login does NOT return JWT in JSON response body")
        cookies = login_res.cookies
        check(COOKIE_NAME in cookies, f"Login sets {COOKIE_NAME} cookie")
        check(CSRF_COOKIE_NAME in cookies, f"Login sets {CSRF_COOKIE_NAME} cookie")

        auth_cookie_val = cookies[COOKIE_NAME]
        csrf_cookie_val = cookies[CSRF_COOKIE_NAME]

        # Check Set-Cookie headers for security attributes
        cookie_headers = [v for k, v in login_res.headers.raw if k.decode("latin1").lower() == "set-cookie"]
        auth_cookie_header = next((h.decode("latin1") for h in cookie_headers if COOKIE_NAME in h.decode("latin1")), "")
        check("httponly" in auth_cookie_header.lower(), "Auth cookie has HttpOnly flag")
        check("samesite=none" in auth_cookie_header.lower(), "Auth cookie has SameSite=None")
        check("path=/" in auth_cookie_header.lower(), "Auth cookie has Path=/")

        # 2. Invalid password returns 401
        bad_pwd_res = client.post("/auth/token", data={"username": username, "password": "WrongPassword!"})
        check(bad_pwd_res.status_code == 401, "Invalid password returns 401")

        # 3. Expired authentication cookie returns 401
        expired_token = create_access_token(data={"sub": str(user_id)}, expires_delta=timedelta(seconds=-10))
        expired_res = client.get("/auth/me", cookies={COOKIE_NAME: expired_token})
        check(expired_res.status_code == 401, "Expired authentication cookie returns 401")

        # 4. Invalid/tampered authentication cookie returns 401
        tampered_res = client.get("/auth/me", cookies={COOKIE_NAME: "tampered.jwt.payload"})
        check(tampered_res.status_code == 401, "Tampered authentication cookie returns 401")

        # 5. Protected route without authentication returns 401
        client.cookies.clear()
        unauth_res = client.get("/auth/me")
        check(unauth_res.status_code == 401, "Protected route without authentication returns 401")

        # 6. Browser reload retains authentication via cookie
        me_res = client.get("/auth/me", cookies={COOKIE_NAME: auth_cookie_val})
        check(me_res.status_code == 200 and me_res.json()["username"] == username, "Authenticated request using cookie succeeds")

        # 7. Logout clears authentication and CSRF cookies
        logout_res = client.post(
            "/auth/logout",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
            headers={"X-CSRF-Token": csrf_cookie_val},
        )
        check(logout_res.status_code == 200, "Logout endpoint succeeds")
        logout_cookie_headers = [v.decode("latin1") for k, v in logout_res.headers.raw if k.decode("latin1").lower() == "set-cookie"]
        auth_clear = next((h for h in logout_cookie_headers if COOKIE_NAME in h), "")
        check("max-age=0" in auth_clear.lower() or "expires=" in auth_clear.lower(), "Logout clears auth cookie")

        # 8. Authenticated request after logout with cleared cookie returns 401
        post_logout_res = client.get("/auth/me", cookies={COOKIE_NAME: ""})
        check(post_logout_res.status_code == 401, "Request with cleared cookie returns 401")

        # ========================================================
        # 2. CSRF PROTECTION (9-14)
        # ========================================================
        # 9. GET request succeeds without CSRF token
        get_res = client.get("/auth/me", cookies={COOKIE_NAME: auth_cookie_val})
        check(get_res.status_code == 200, "GET request does not require CSRF token")

        # 10. Valid CSRF token on state-changing request succeeds
        csrf_ok_res = client.post(
            "/auth/mfa/setup",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
            headers={"X-CSRF-Token": csrf_cookie_val},
        )
        check(csrf_ok_res.status_code == 200, "State-changing POST with valid CSRF token succeeds")
        setup_data = csrf_ok_res.json()
        totp_secret = setup_data["secret"]

        # 11. State-changing request missing CSRF token returns 403
        csrf_missing_res = client.post(
            "/auth/mfa/setup",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
        )
        check(csrf_missing_res.status_code == 403, "State-changing POST with missing CSRF token returns 403")

        # 12. State-changing request with mismatched/invalid CSRF token returns 403
        csrf_invalid_res = client.post(
            "/auth/mfa/setup",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
            headers={"X-CSRF-Token": "invalid_csrf_token_value"},
        )
        check(csrf_invalid_res.status_code == 403, "State-changing POST with invalid CSRF token returns 403")

        # 13. State-changing request with unauthenticated client does not bypass to 200
        client.cookies.clear()
        unauth_post_res = client.post("/auth/mfa/setup")
        check(unauth_post_res.status_code == 401, "Unauthenticated POST rejected with 401")

        # 14. Dedicated /auth/csrf-token endpoint generates new token and sets cookie
        csrf_gen_res = client.get("/auth/csrf-token")
        check(csrf_gen_res.status_code == 200 and CSRF_COOKIE_NAME in csrf_gen_res.cookies, "CSRF endpoint generates valid token and cookie")

        # ========================================================
        # 3. MFA / TOTP FLOW (15-24)
        # ========================================================
        # 15. MFA Setup returns provisioning URI with otpauth protocol
        check(setup_data["provisioning_uri"].startswith("otpauth://totp/"), "MFA setup returns standard otpauth:// URI")

        # 16. Invalid TOTP code rejected during enable
        bad_totp_res = client.post(
            "/auth/mfa/enable",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
            headers={"X-CSRF-Token": csrf_cookie_val},
            json={"totp_code": "000000"},
        )
        check(bad_totp_res.status_code == 400, "Invalid TOTP code rejected during enable")

        # 17. Valid TOTP code activates MFA and returns recovery codes
        valid_totp = mfa_service.generate_totp_code(totp_secret)
        enable_res = client.post(
            "/auth/mfa/enable",
            cookies={COOKIE_NAME: auth_cookie_val, CSRF_COOKIE_NAME: csrf_cookie_val},
            headers={"X-CSRF-Token": csrf_cookie_val},
            json={"totp_code": valid_totp},
        )
        check(enable_res.status_code == 200, "Valid TOTP code enables MFA")
        recovery_codes = enable_res.json()["recovery_codes"]
        check(len(recovery_codes) >= 8, "MFA enablement returns recovery codes")

        # 18. Subsequent password login requires MFA challenge (mfa_required=True)
        mfa_login_res = client.post("/auth/token", data={"username": username, "password": user_pwd})
        check(mfa_login_res.status_code == 200, "MFA login returns 200")
        mfa_payload = mfa_login_res.json()
        check(mfa_payload.get("mfa_required") is True, "Login response indicates mfa_required=True")
        check(COOKIE_NAME not in mfa_login_res.cookies or not mfa_login_res.cookies[COOKIE_NAME], "Password alone does NOT set auth cookie for MFA account")
        mfa_challenge_token = mfa_payload["mfa_token"]

        # 19a. MFA challenge cannot access protected API endpoints
        chal_api_res = client.get("/auth/me", cookies={COOKIE_NAME: mfa_challenge_token})
        check(chal_api_res.status_code == 401, "MFA challenge token cannot access protected APIs")

        # 19b. MFA challenge cannot connect to WebSockets
        chal_ws_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}", cookies={COOKIE_NAME: mfa_challenge_token}) as ws:
                pass
        except Exception:
            chal_ws_rejected = True
        check(chal_ws_rejected, "MFA challenge token cannot connect to WebSockets")

        # 19c. Invalid TOTP verification on MFA challenge fails
        bad_challenge_res = client.post("/auth/mfa/verify", json={
            "mfa_token": mfa_challenge_token,
            "code": "123456"
        })
        check(bad_challenge_res.status_code in [400, 401], "Invalid TOTP verification fails")

        # 20. Valid TOTP verification succeeds and sets session cookies
        current_valid_totp = mfa_service.generate_totp_code(totp_secret)
        good_challenge_res = client.post("/auth/mfa/verify", json={
            "mfa_token": mfa_challenge_token,
            "code": current_valid_totp
        })
        check(good_challenge_res.status_code == 200, "Valid TOTP verification succeeds")
        check(good_challenge_res.json().get("access_token") is None, "MFA verify does NOT return JWT in JSON response")
        check(COOKIE_NAME in good_challenge_res.cookies, "MFA verification sets auth session cookie")
        new_auth_cookie = good_challenge_res.cookies[COOKIE_NAME]
        new_csrf_cookie = good_challenge_res.cookies[CSRF_COOKIE_NAME]

        # 20b. Consumed MFA challenge cannot be reused (single-use enforced)
        reused_chal_res = client.post("/auth/mfa/verify", json={
            "mfa_token": mfa_challenge_token,
            "code": current_valid_totp
        })
        check(reused_chal_res.status_code == 401, "Consumed MFA challenge cannot be reused (single-use enforced)")

        # 21. Single-use recovery code login succeeds
        mfa_login2 = client.post("/auth/token", data={"username": username, "password": user_pwd})
        token_for_recovery = mfa_login2.json()["mfa_token"]
        first_recovery_code = recovery_codes[0]
        recov_res = client.post("/auth/mfa/verify", json={
            "mfa_token": token_for_recovery,
            "code": first_recovery_code
        })
        check(recov_res.status_code == 200, "Single-use recovery code successfully verifies login")

        # 22. Reused recovery code is rejected
        mfa_login3 = client.post("/auth/token", data={"username": username, "password": user_pwd})
        token_for_reuse = mfa_login3.json()["mfa_token"]
        recov_reuse_res = client.post("/auth/mfa/verify", json={
            "mfa_token": token_for_reuse,
            "code": first_recovery_code
        })
        check(recov_reuse_res.status_code in [400, 401], "Reused recovery code is rejected")

        # 23. Disabling MFA requires current password and valid CSRF
        disable_res = client.post(
            "/auth/mfa/disable",
            cookies={COOKIE_NAME: new_auth_cookie, CSRF_COOKIE_NAME: new_csrf_cookie},
            headers={"X-CSRF-Token": new_csrf_cookie},
            json={"password": user_pwd},
        )
        check(disable_res.status_code == 200, "MFA disable succeeds with password")
        check(not mfa_service.is_mfa_enabled(str(user_id)), "MFA is now disabled for user")

        # 24a. Non-admin user cannot access admin endpoint
        non_admin_token = create_access_token(data={"sub": str(user_id)})
        non_admin_res = client.get("/auth/admin/privileged-action", cookies={COOKIE_NAME: non_admin_token})
        check(non_admin_res.status_code == 403 and "Administrative privileges required" in non_admin_res.json()["detail"],
              "Non-admin cannot access admin-only endpoint")

        # 24b. Admin privileged MFA enforcement: Admin without MFA cannot perform privileged operations
        admin_token = create_access_token(data={"sub": str(admin_id)})
        admin_check_res = client.get("/auth/admin/privileged-action", cookies={COOKIE_NAME: admin_token})
        check(admin_check_res.status_code == 403 and "MFA required" in admin_check_res.json()["detail"],
              "Admin user without MFA is denied privileged action")

        # 24c. Admin cannot disable their own MFA
        admin_secret, _ = mfa_service.setup_enrollment(str(admin_id), admin_username)
        admin_totp = mfa_service.generate_totp_code(admin_secret)
        mfa_service.confirm_enrollment(str(admin_id), admin_totp)
        admin_disable_res = client.post(
            "/auth/mfa/disable",
            cookies={COOKIE_NAME: admin_token, CSRF_COOKIE_NAME: new_csrf_cookie},
            headers={"X-CSRF-Token": new_csrf_cookie},
            json={"password": user_pwd},
        )
        check(admin_disable_res.status_code == 403 and "Administrative accounts cannot disable MFA" in admin_disable_res.json()["detail"],
              "Admin user cannot disable MFA")

        # ========================================================
        # 4. RATE LIMITING (25-27)
        # ========================================================
        # 25. Repeated failed logins trigger 429
        # Reset limiter for clean test
        auth_rate_limiter.clear()
        rate_username = f"rate_user_{uuid.uuid4().hex[:6]}"
        for _ in range(5):
            client.post("/auth/token", data={"username": rate_username, "password": "WrongPassword"})
        # 6th attempt should return 429
        rate_res = client.post("/auth/token", data={"username": rate_username, "password": "WrongPassword"})
        check(rate_res.status_code == 429, "Repeated failed login attempts trigger HTTP 429")

        # 26. Repeated MFA attempts trigger 429
        auth_rate_limiter.clear()
        mfa_fake_token = create_access_token(data={"sub": str(user_id), "mfa_pending": True, "jti": secrets.token_hex(16)})
        for _ in range(5):
            client.post("/auth/mfa/verify", json={"mfa_token": mfa_fake_token, "code": "000000"})
        mfa_rate_res = client.post("/auth/mfa/verify", json={"mfa_token": mfa_fake_token, "code": "000000"})
        check(mfa_rate_res.status_code == 429, "Repeated failed MFA attempts trigger HTTP 429")

        # 27. Registration flooding is rate limited
        auth_rate_limiter.clear()
        for i in range(5):
            client.post("/auth/register", json={
                "username": f"flood_{i}_{uuid.uuid4().hex[:4]}",
                "email": f"flood_{i}_{uuid.uuid4().hex[:4]}@example.com",
                "password": "Password123!",
                "full_name": "Flooder"
            })
        reg_flood_res = client.post("/auth/register", json={
            "username": f"flood_limit_{uuid.uuid4().hex[:4]}",
            "email": f"flood_limit_{uuid.uuid4().hex[:4]}@example.com",
            "password": "Password123!",
            "full_name": "Flooder"
        })
        check(reg_flood_res.status_code == 429, "Registration flooding triggers HTTP 429")

        # ========================================================
        # 5. WEBSOCKET COOKIE AUTHENTICATION (28-33)
        # ========================================================
        # 28. Authenticated member connection via cookie succeeds
        ws_connected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}", cookies={COOKIE_NAME: auth_cookie_val}) as ws:
                ws.send_json({"type": "ping"})
                ws_connected = True
        except Exception as e:
            ws_connected = False
        check(ws_connected, "WebSocket connects successfully using authentication cookie")

        # 29. Unauthenticated WebSocket rejected
        client.cookies.clear()
        ws_unauth_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}") as ws:
                pass
        except Exception:
            ws_unauth_rejected = True
        check(ws_unauth_rejected, "Unauthenticated WebSocket rejected")

        # 30. Expired cookie WebSocket rejected
        ws_expired_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}", cookies={COOKIE_NAME: expired_token}) as ws:
                pass
        except Exception:
            ws_expired_rejected = True
        check(ws_expired_rejected, "Expired cookie WebSocket rejected")

        # 31. Non-member cookie WebSocket rejected
        non_member_id = uuid.uuid4()
        non_member = User(
            id=non_member_id,
            username=f"nonmember_{uuid.uuid4().hex[:6]}",
            email=f"nonmember_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Non Member",
            password_hash=hashed_pwd,
            system_role="student",
        )
        db.add(non_member)
        db.commit()
        non_member_token = create_access_token(data={"sub": str(non_member_id)})

        ws_nonmember_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}", cookies={COOKIE_NAME: non_member_token}) as ws:
                pass
        except Exception:
            ws_nonmember_rejected = True
        check(ws_nonmember_rejected, "Non-member WebSocket connection rejected")

        # 32. Cross-project WebSocket isolation: Project A member cannot connect to Project B WebSocket
        ws_cross_proj_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj2_id}", cookies={COOKIE_NAME: auth_cookie_val}) as ws:
                pass
        except Exception:
            ws_cross_proj_rejected = True
        check(ws_cross_proj_rejected, "Cross-project WebSocket isolation strictly enforced via cookie auth")

        # 33. WebSocket query token fallback is completely removed and rejected
        client.cookies.clear()
        ws_query_rejected = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_id}?token={auth_cookie_val}") as ws:
                pass
        except Exception:
            ws_query_rejected = True
        check(ws_query_rejected, "WebSocket query token fallback is completely removed and rejected without cookie")

        # ========================================================
        # 6. PASSWORD POLICY & ACCOUNT ENUMERATION (34-35)
        # ========================================================
        # 34. Registration rejects passwords shorter than 8 characters
        short_pwd_res = client.post("/auth/register", json={
            "username": f"short_{uuid.uuid4().hex[:4]}",
            "email": f"short_{uuid.uuid4().hex[:4]}@example.com",
            "password": "short",
            "full_name": "Short Pwd"
        })
        check(short_pwd_res.status_code == 422, "Registration rejects password < 8 characters")

        # 35. Login failure message is uniform (no account enumeration)
        nonexistent_res = client.post("/auth/token", data={"username": "non_existent_user_999", "password": "Password123!"})
        wrong_pwd_res = client.post("/auth/token", data={"username": username, "password": "WrongPassword123!"})
        check(
            nonexistent_res.status_code == 401 and wrong_pwd_res.status_code == 401 and
            nonexistent_res.json()["detail"] == wrong_pwd_res.json()["detail"],
            "Login failure message is identical for nonexistent vs bad password (prevents enumeration)"
        )

        print("-" * 65)
        print(f"STAGE 4 TESTS SUMMARY: {passed_count}/{total_count} PASSED")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
