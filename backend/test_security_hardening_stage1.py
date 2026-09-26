import uuid
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Conversation, Message
from app.auth import get_password_hash, create_access_token

client = TestClient(app)

print("=" * 65)
print("STAGE 1 SECURITY HARDENING: REGRESSION TEST SUITE")
print("=" * 65)

def run_tests():
    db = SessionLocal()
    try:
        # Setup test IDs
        user_a_id = uuid.uuid4()
        user_b_id = uuid.uuid4()
        proj_a_id = uuid.uuid4()
        proj_b_id = uuid.uuid4()

        # Clean/seed User A and User B
        dev_hash = get_password_hash("ValidPass123!")
        user_a = User(
            id=user_a_id,
            username=f"sec_user_a_{uuid.uuid4().hex[:6]}",
            email=f"user_a_{uuid.uuid4().hex[:6]}@example.com",
            full_name="User Alpha",
            password_hash=dev_hash,
            system_role="student",
        )
        user_b = User(
            id=user_b_id,
            username=f"sec_user_b_{uuid.uuid4().hex[:6]}",
            email=f"user_b_{uuid.uuid4().hex[:6]}@example.com",
            full_name="User Beta",
            password_hash=dev_hash,
            system_role="student",
        )
        db.add_all([user_a, user_b])

        # Projects
        proj_a = Project(
            id=proj_a_id,
            name="Project Alpha",
            description="Alpha isolation test",
            status="Active",
        )
        proj_b = Project(
            id=proj_b_id,
            name="Project Beta",
            description="Beta isolation test",
            status="Active",
        )
        db.add_all([proj_a, proj_b])
        db.flush()

        # User A is in Project A only; User B is in Project B only
        mem_a = ProjectMember(project_id=proj_a_id, user_id=user_a_id, project_role="manager")
        mem_b = ProjectMember(project_id=proj_b_id, user_id=user_b_id, project_role="manager")
        db.add_all([mem_a, mem_b])
        db.commit()

        token_a = create_access_token({"sub": str(user_a.id), "username": user_a.username})
        token_b = create_access_token({"sub": str(user_b.id), "username": user_b.username})
        expired_token = create_access_token({"sub": str(user_a.id), "username": user_a.username}, expires_delta=timedelta(seconds=-10))

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        passed = 0
        total = 0

        def check(cond, name):
            nonlocal passed, total
            total += 1
            if cond:
                passed += 1
                print(f"[PASS] Test {total}: {name}")
            else:
                print(f"[FAIL] Test {total}: {name}")
                assert cond, f"Failed: {name}"

        # ---------------- AUTH TESTS (1-8) ----------------
        # 1. /auth/register valid password -> 201
        reg_uname = f"reg_u_{uuid.uuid4().hex[:6]}"
        reg_email = f"reg_e_{uuid.uuid4().hex[:6]}@example.com"
        r1 = client.post("/auth/register", json={
            "username": reg_uname,
            "email": reg_email,
            "password": "ValidPassword123!",
            "full_name": "Registered User"
        })
        check(r1.status_code == 201 and "access_token" in r1.json(), "/auth/register valid password -> 201")

        # 2. /auth/register password < 8 -> 422
        r2 = client.post("/auth/register", json={
            "username": f"u_{uuid.uuid4().hex[:6]}",
            "email": f"e_{uuid.uuid4().hex[:6]}@example.com",
            "password": "short",
        })
        check(r2.status_code == 422, "/auth/register password < 8 -> 422")

        # 3. /auth/register password > 128 -> 422
        r3 = client.post("/auth/register", json={
            "username": f"u_{uuid.uuid4().hex[:6]}",
            "email": f"e_{uuid.uuid4().hex[:6]}@example.com",
            "password": "A" * 129,
        })
        check(r3.status_code == 422, "/auth/register password > 128 -> 422")

        # 4. duplicate email -> 400
        r4 = client.post("/auth/register", json={
            "username": f"diff_u_{uuid.uuid4().hex[:6]}",
            "email": reg_email,
            "password": "ValidPassword123!",
        })
        check(r4.status_code == 400 and "already registered" in r4.text.lower(), "duplicate email -> 400")

        # 5. duplicate username -> 400
        r5 = client.post("/auth/register", json={
            "username": reg_uname,
            "email": f"diff_e_{uuid.uuid4().hex[:6]}@example.com",
            "password": "ValidPassword123!",
        })
        check(r5.status_code == 400 and "already registered" in r5.text.lower(), "duplicate username -> 400")

        # 6. wrong password -> 401
        r6 = client.post("/auth/token", data={
            "username": reg_uname,
            "password": "WrongPassword123!"
        })
        check(r6.status_code == 401, "wrong password -> 401")

        # 7. invalid token -> 401
        r7 = client.get("/users/me", headers={"Authorization": "Bearer invalid.token.xyz"})
        check(r7.status_code == 401, "invalid token -> 401")

        # 8. expired token -> 401
        r8 = client.get("/users/me", headers={"Authorization": f"Bearer {expired_token}"})
        check(r8.status_code == 401, "expired token -> 401")

        # ---------------- USERS (9) ----------------
        # 9. POST /users unauthenticated -> 404 (removed)
        r9 = client.post("/users", json={"username": "hacker", "email": "h@example.com", "password": "pass"})
        check(r9.status_code in (404, 405), "POST /users unauthenticated -> 404/405 (endpoint removed)")

        # ---------------- PROJECT MEMBERS (10-12) ----------------
        # 10. member -> GET members succeeds
        r10 = client.get(f"/projects/{proj_a_id}/members", headers=headers_a)
        check(r10.status_code == 200 and len(r10.json()) >= 1, "member -> GET members succeeds")

        # 11. non-member -> GET members = 403
        r11 = client.get(f"/projects/{proj_b_id}/members", headers=headers_a)
        check(r11.status_code == 403, "non-member -> GET members = 403")

        # 12. unauthenticated -> 401
        r12 = client.get(f"/projects/{proj_a_id}/members")
        check(r12.status_code == 401, "unauthenticated -> GET members = 401")

        # ---------------- CHAT REST (13-19) ----------------
        # 13. project member can GET chat
        r13 = client.get(f"/projects/{proj_a_id}/chat/messages", headers=headers_a)
        check(r13.status_code == 200, "project member can GET chat")

        # 14. non-member cannot GET chat
        r14 = client.get(f"/projects/{proj_a_id}/chat/messages", headers=headers_b)
        check(r14.status_code == 403, "non-member cannot GET chat (403)")

        # 15. project member can POST chat
        r15 = client.post(f"/projects/{proj_a_id}/chat/messages", headers=headers_a, json={"content": "Hello Alpha Team"})
        check(r15.status_code == 201, "project member can POST chat (201)")
        msg_a_id = r15.json()["id"]

        # 16. non-member cannot POST chat
        r16 = client.post(f"/projects/{proj_a_id}/chat/messages", headers=headers_b, json={"content": "Spying message"})
        check(r16.status_code == 403, "non-member cannot POST chat (403)")

        # Post another message from User A to test deletion
        r_msg2 = client.post(f"/projects/{proj_a_id}/chat/messages", headers=headers_a, json={"content": "Message to delete"})
        msg_to_del_id = r_msg2.json()["id"]

        # 17. sender can delete own message
        r17 = client.delete(f"/projects/{proj_a_id}/chat/messages/{msg_to_del_id}", headers=headers_a)
        check(r17.status_code == 200, "sender can delete own message (200)")

        # 18. non-sender (even if in project) cannot delete another user's message
        # Add User C to Project A
        user_c = User(
            id=uuid.uuid4(),
            username=f"user_c_{uuid.uuid4().hex[:6]}",
            email=f"user_c_{uuid.uuid4().hex[:6]}@example.com",
            full_name="User Charlie",
            password_hash=dev_hash,
            system_role="student",
        )
        db.add(user_c)
        db.flush()
        db.add(ProjectMember(project_id=proj_a_id, user_id=user_c.id, project_role="member"))
        db.commit()
        token_c = create_access_token({"sub": str(user_c.id), "username": user_c.username})
        headers_c = {"Authorization": f"Bearer {token_c}"}

        r18 = client.delete(f"/projects/{proj_a_id}/chat/messages/{msg_a_id}", headers=headers_c)
        check(r18.status_code == 403, "non-sender cannot delete another user's message (403)")

        # 19. non-member cannot delete project messages
        r19 = client.delete(f"/projects/{proj_a_id}/chat/messages/{msg_a_id}", headers=headers_b)
        check(r19.status_code == 403, "non-member cannot delete project messages (403)")

        # ---------------- WEBSOCKET (20-25) ----------------
        client.cookies.clear()
        # 20. missing cookie -> rejected
        ws_rejected_20 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_a_id}") as ws:
                pass
        except Exception:
            ws_rejected_20 = True
        check(ws_rejected_20, "missing cookie -> WebSocket rejected")

        # 21. invalid cookie -> rejected
        ws_rejected_21 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_a_id}", cookies={"nexora_auth": "invalid.token.here"}) as ws:
                pass
        except Exception:
            ws_rejected_21 = True
        check(ws_rejected_21, "invalid cookie -> WebSocket rejected")

        # 22. expired cookie -> rejected
        ws_rejected_22 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_a_id}", cookies={"nexora_auth": expired_token}) as ws:
                pass
        except Exception:
            ws_rejected_22 = True
        check(ws_rejected_22, "expired cookie -> WebSocket rejected")

        # 23. valid non-member cookie -> rejected
        ws_rejected_23 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_a_id}", cookies={"nexora_auth": token_b}) as ws:
                pass
        except Exception:
            ws_rejected_23 = True
        check(ws_rejected_23, "valid non-member cookie -> WebSocket rejected")

        # 24. valid member cookie -> accepted
        ws_accepted_24 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_a_id}", cookies={"nexora_auth": token_a}) as ws:
                ws.send_json({"type": "ping"})
                ws_accepted_24 = True
        except Exception as e:
            print("WS accept error:", e)
            ws_accepted_24 = False
        check(ws_accepted_24, "valid member cookie -> WebSocket accepted")

        # 25. Project A member cookie cannot connect to Project B WebSocket
        ws_rejected_25 = False
        try:
            with client.websocket_connect(f"/ws/projects/{proj_b_id}", cookies={"nexora_auth": token_a}) as ws:
                pass
        except Exception:
            ws_rejected_25 = True
        check(ws_rejected_25, "Project A member cookie cannot connect to Project B WebSocket")

        # ---------------- INVITATIONS (26-28) ----------------
        # 26. static 'InvitedGuest123!' must no longer exist anywhere in executable application code
        import inspect
        import app.routers.projects
        proj_source = inspect.getsource(app.routers.projects)
        check("InvitedGuest123!" not in proj_source, "'InvitedGuest123!' absent from executable projects router")

        # 27. invited user cannot log in using a predictable/static password
        external_email = f"ext_{uuid.uuid4().hex[:6]}@university.edu"
        inv_res = client.post(f"/projects/{proj_a_id}/invite", headers=headers_a, json={
            "email_or_username": external_email,
            "role": "member"
        })
        check(inv_res.status_code == 200, "project manager can invite external email")

        # Attempt login with old static password or predictable password
        login_res1 = client.post("/auth/token", data={"username": external_email, "password": "InvitedGuest123!"})
        login_res2 = client.post("/auth/token", data={"username": external_email, "password": "password123"})
        check(login_res1.status_code == 401 and login_res2.status_code == 401, "invited user cannot log in with predictable password")

        # 28. non-member cannot invite users to project
        inv_nonmember = client.post(f"/projects/{proj_a_id}/invite", headers=headers_b, json={
            "email_or_username": f"ext_{uuid.uuid4().hex[:6]}@university.edu",
            "role": "member"
        })
        check(inv_nonmember.status_code == 403, "non-member cannot invite users to project (403)")

        print("=" * 65)
        print(f"RESULTS: {passed} / {total} TESTS PASSED")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
