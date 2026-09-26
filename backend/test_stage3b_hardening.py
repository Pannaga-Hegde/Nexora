"""
NEXORA - STAGE 3B SECURITY HARDENING TEST SUITE

Verifies the 5 medium-severity security hardening implementations:
1. File Upload Extension Hardening (.html, .htm, .xhtml, .svg, case-insensitive, safe formats allowed)
2. Calendar Cancellation Authorization (creator, manager, non-member blocked, null creator blocked for member, 401 unauth)
3. Payload Size / Length Limits (chat, task discussion comments, replies, community posts, oversized rejected 422)
4. Nginx Security Headers (CSP, HSTS, SPA fallback, static asset rules)
"""

import io
import os
import re
import uuid
from datetime import datetime, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.database import engine, Base, SessionLocal
from app.models import (
    User,
    Project,
    ProjectMember,
    Task,
    CalendarEvent,
    CommunityPost,
    Conversation,
    Message,
)
from app.auth import get_password_hash, create_access_token
from app.services.storage_service import (
    SupabaseStorageService,
    storage_service,
    FileValidationError,
)

Base.metadata.create_all(bind=engine)
client = TestClient(app)

print("=" * 70)
print("STAGE 3B: MEDIUM SECURITY HARDENING VERIFICATION")
print("=" * 70)


def run_stage3b_tests():
    db = SessionLocal()
    passed = 0
    failed = 0

    def assert_test(condition, name):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name}")
            failed += 1
            raise AssertionError(f"Test failed: {name}")

    try:
        # ============================================================
        # 1. FILE UPLOAD EXTENSION HARDENING
        # ============================================================
        print("\n--- 1. File Upload Extension Hardening ---")

        # 1.1 Prohibited browser-renderable extensions rejected by validator
        prohibited_samples = [
            "exploit.html",
            "page.htm",
            "doc.xhtml",
            "vector.svg",
            "UPPER.HTML",
            "Mixed.Svg",
            "XML.XHTML",
            "OLD.HTM",
        ]
        for fname in prohibited_samples:
            caught = False
            try:
                SupabaseStorageService.validate_file_safety(fname, 1024, "text/html")
            except FileValidationError as e:
                caught = True
                assert "prohibited" in str(e).lower()
            assert_test(caught, f"Prohibited extension rejected: '{fname}'")

        # 1.2 Allowed safe formats accepted by validator
        safe_samples = [
            ("document.pdf", "application/pdf"),
            ("photo.png", "image/png"),
            ("picture.jpg", "image/jpeg"),
            ("graphic.jpeg", "image/jpeg"),
            ("animation.gif", "image/gif"),
            ("web.webp", "image/webp"),
            ("notes.txt", "text/plain"),
            ("spreadsheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ]
        for fname, mime in safe_samples:
            try:
                SupabaseStorageService.validate_file_safety(fname, 2048, mime)
                assert_test(True, f"Safe format accepted: '{fname}'")
            except FileValidationError:
                assert_test(False, f"Safe format rejected unexpectedly: '{fname}'")

        # 1.3 Endpoint-level extension rejection
        u_lead_id = uuid.uuid4()
        dev_hash = get_password_hash("Stage3bPass123!")
        u_lead = User(
            id=u_lead_id,
            username=f"upload_lead_{uuid.uuid4().hex[:6]}",
            email=f"upload_lead_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Upload Lead",
            password_hash=dev_hash,
            system_role="student",
        )
        proj_up_id = uuid.uuid4()
        proj_up = Project(id=proj_up_id, name="Upload Security Project", status="Active")
        db.add_all([u_lead, proj_up])
        db.flush()

        mem_up = ProjectMember(project_id=proj_up_id, user_id=u_lead_id, project_role="manager")
        t_up = Task(id=uuid.uuid4(), project_id=proj_up_id, title="Attachment Task", reporter_id=u_lead_id)
        db.add_all([mem_up, t_up])
        db.commit()

        token_lead = create_access_token({"sub": str(u_lead_id), "username": u_lead.username})
        auth_lead = {"Authorization": f"Bearer {token_lead}"}

        with patch.object(storage_service, "is_configured", return_value=True):
            # Prohibited uploads via API
            for bad_name in ["bad.html", "script.svg", "UPPER.SVG", "payload.xhtml"]:
                res = client.post(
                    f"/tasks/{t_up.id}/discussion/attachments",
                    headers=auth_lead,
                    files={"file": (bad_name, io.BytesIO(b"<svg></svg>"), "image/svg+xml")},
                )
                assert_test(res.status_code == 400, f"API rejected prohibited upload: '{bad_name}' (400 Bad Request)")
                assert_test("prohibited" in res.text, f"API response specifies prohibited extension for '{bad_name}'")

            # Safe upload via API
            with patch.object(storage_service, "upload_file", return_value="projects/safe.pdf"), \
                 patch.object(storage_service, "create_signed_url", return_value="https://supabase.co/signed/safe.pdf"):
                res = client.post(
                    f"/tasks/{t_up.id}/discussion/attachments",
                    headers=auth_lead,
                    files={"file": ("safe_report.pdf", io.BytesIO(b"%PDF-1.4 sample"), "application/pdf")},
                )
                assert_test(res.status_code == 200, "API accepts safe PDF upload (200 OK)")

        # ============================================================
        # 2. CALENDAR CANCELLATION AUTHORIZATION
        # ============================================================
        print("\n--- 2. Calendar Cancellation Authorization ---")

        # Setup users: manager, creator (member), other member, cross-project user
        u_mgr_id = uuid.uuid4()
        u_m1_id = uuid.uuid4()
        u_m2_id = uuid.uuid4()
        u_cross_id = uuid.uuid4()

        u_mgr = User(id=u_mgr_id, username=f"mgr_{uuid.uuid4().hex[:6]}", email=f"mgr_{uuid.uuid4().hex[:6]}@example.com", password_hash=dev_hash)
        u_m1 = User(id=u_m1_id, username=f"m1_{uuid.uuid4().hex[:6]}", email=f"m1_{uuid.uuid4().hex[:6]}@example.com", password_hash=dev_hash)
        u_m2 = User(id=u_m2_id, username=f"m2_{uuid.uuid4().hex[:6]}", email=f"m2_{uuid.uuid4().hex[:6]}@example.com", password_hash=dev_hash)
        u_cross = User(id=u_cross_id, username=f"cross_{uuid.uuid4().hex[:6]}", email=f"cross_{uuid.uuid4().hex[:6]}@example.com", password_hash=dev_hash)

        proj_cal_id = uuid.uuid4()
        proj_other_id = uuid.uuid4()

        proj_cal = Project(id=proj_cal_id, name="Calendar Auth Project", status="Active")
        proj_other = Project(id=proj_other_id, name="Other Project", status="Active")

        db.add_all([u_mgr, u_m1, u_m2, u_cross, proj_cal, proj_other])
        db.flush()

        mem_mgr = ProjectMember(project_id=proj_cal_id, user_id=u_mgr_id, project_role="manager")
        mem_m1 = ProjectMember(project_id=proj_cal_id, user_id=u_m1_id, project_role="member")
        mem_m2 = ProjectMember(project_id=proj_cal_id, user_id=u_m2_id, project_role="member")
        mem_cross = ProjectMember(project_id=proj_other_id, user_id=u_cross_id, project_role="manager")
        db.add_all([mem_mgr, mem_m1, mem_m2, mem_cross])

        # Event 1: Created by Member 1
        evt1 = CalendarEvent(
            id=uuid.uuid4(),
            project_id=proj_cal_id,
            creator_id=u_m1_id,
            title="Sprint Planning (M1)",
            start_time=datetime.now(timezone.utc),
        )
        # Event 2: NULL creator_id (legacy / unassigned meeting)
        evt2 = CalendarEvent(
            id=uuid.uuid4(),
            project_id=proj_cal_id,
            creator_id=None,
            title="Unassigned Legacy Meeting",
            start_time=datetime.now(timezone.utc),
        )
        # Event 3: Created by Member 1 for Manager cancellation test
        evt3 = CalendarEvent(
            id=uuid.uuid4(),
            project_id=proj_cal_id,
            creator_id=u_m1_id,
            title="Retro Meeting (M1)",
            start_time=datetime.now(timezone.utc),
        )
        db.add_all([evt1, evt2, evt3])
        db.commit()

        token_mgr = create_access_token({"sub": str(u_mgr_id), "username": u_mgr.username})
        token_m1 = create_access_token({"sub": str(u_m1_id), "username": u_m1.username})
        token_m2 = create_access_token({"sub": str(u_m2_id), "username": u_m2.username})
        token_cross = create_access_token({"sub": str(u_cross_id), "username": u_cross.username})

        auth_mgr = {"Authorization": f"Bearer {token_mgr}"}
        auth_m1 = {"Authorization": f"Bearer {token_m1}"}
        auth_m2 = {"Authorization": f"Bearer {token_m2}"}
        auth_cross = {"Authorization": f"Bearer {token_cross}"}

        # 2.1 Unauthenticated request gets 401
        res = client.delete(f"/workflow/calendar/events/{evt1.id}")
        assert_test(res.status_code == 401, "Unauthenticated calendar cancellation rejected with 401")

        # 2.2 Cross-project user gets 403
        res = client.delete(f"/workflow/calendar/events/{evt1.id}", headers=auth_cross)
        assert_test(res.status_code == 403, "Cross-project user cancellation rejected with 403")

        # 2.3 Normal member (m2) cannot cancel another member's event (evt1 by m1)
        res = client.delete(f"/workflow/calendar/events/{evt1.id}", headers=auth_m2)
        assert_test(res.status_code == 403, "Normal member cannot cancel another member's event (403 Forbidden)")

        # 2.4 Normal member (m1) cannot cancel event with NULL creator_id (evt2)
        res = client.delete(f"/workflow/calendar/events/{evt2.id}", headers=auth_m1)
        assert_test(res.status_code == 403, "Normal member cannot cancel event with NULL creator_id (403 Forbidden)")

        # 2.5 Project manager CAN cancel event with NULL creator_id (evt2)
        res = client.delete(f"/workflow/calendar/events/{evt2.id}", headers=auth_mgr)
        assert_test(res.status_code == 200, "Project manager CAN cancel event with NULL creator_id (200 OK)")

        # 2.6 Event creator (m1) CAN cancel own event (evt1)
        res = client.delete(f"/workflow/calendar/events/{evt1.id}", headers=auth_m1)
        assert_test(res.status_code == 200, "Event creator CAN cancel own event (200 OK)")

        # 2.7 Project manager CAN cancel another member's event (evt3 by m1)
        res = client.delete(f"/workflow/calendar/events/{evt3.id}", headers=auth_mgr)
        assert_test(res.status_code == 200, "Project manager CAN cancel another member's event (200 OK)")

        # ============================================================
        # 3. PAYLOAD SIZE / LENGTH LIMITS
        # ============================================================
        print("\n--- 3. Payload Size / Length Limits ---")

        # 3.1 Chat messages: normal succeeds (201), oversized rejected (422)
        normal_msg = "Hello team, this is a standard project chat message."
        res = client.post(
            f"/projects/{proj_cal_id}/chat/messages",
            headers=auth_m1,
            json={"content": normal_msg},
        )
        assert_test(res.status_code == 201, "Normal chat message succeeds (201 Created)")

        oversized_msg = "A" * 4001
        res = client.post(
            f"/projects/{proj_cal_id}/chat/messages",
            headers=auth_m1,
            json={"content": oversized_msg},
        )
        assert_test(res.status_code == 422, "Oversized chat message rejected with 422 Unprocessable Entity")

        # 3.2 Task discussion comments: normal succeeds (200), oversized rejected (422)
        normal_comment = "This is a detailed code review comment on the architecture."
        res = client.post(
            f"/tasks/{t_up.id}/discussion",
            headers=auth_lead,
            json={"content": normal_comment},
        )
        assert_test(res.status_code == 200, "Normal task discussion comment succeeds (200 OK)")
        parent_comment_id = res.json()["id"]

        oversized_comment = "B" * 10001
        res = client.post(
            f"/tasks/{t_up.id}/discussion",
            headers=auth_lead,
            json={"content": oversized_comment},
        )
        assert_test(res.status_code == 422, "Oversized task discussion comment rejected with 422 Unprocessable Entity")

        # 3.3 Task discussion replies: normal succeeds (200), oversized rejected (422)
        normal_reply = "I agree with your review point. Fixing now."
        res = client.post(
            f"/tasks/{t_up.id}/discussion",
            headers=auth_lead,
            json={"content": normal_reply, "parent_comment_id": parent_comment_id},
        )
        assert_test(res.status_code == 200, "Normal task discussion reply succeeds (200 OK)")

        oversized_reply = "C" * 10001
        res = client.post(
            f"/tasks/{t_up.id}/discussion",
            headers=auth_lead,
            json={"content": oversized_reply, "parent_comment_id": parent_comment_id},
        )
        assert_test(res.status_code == 422, "Oversized task discussion reply rejected with 422 Unprocessable Entity")

        # 3.4 Task activities: normal succeeds (201), oversized rejected (422)
        normal_act = "Updated task progress notes."
        res = client.post(
            f"/projects/{proj_up_id}/tasks/{t_up.id}/activities",
            headers=auth_lead,
            json={"content": normal_act},
        )
        assert_test(res.status_code == 201, "Normal task activity comment succeeds (201 Created)")

        oversized_act = "D" * 10001
        res = client.post(
            f"/projects/{proj_up_id}/tasks/{t_up.id}/activities",
            headers=auth_lead,
            json={"content": oversized_act},
        )
        assert_test(res.status_code == 422, "Oversized task activity comment rejected with 422 Unprocessable Entity")

        # 3.5 Community posts: normal succeeds (201), oversized rejected (422)
        normal_post = {
            "title": "Welcome to Nexora Engineering Community",
            "content": "This is a great forum for sharing development insights and milestones.",
            "category": "Engineering",
        }
        res = client.post("/community/posts", headers=auth_lead, json=normal_post)
        assert_test(res.status_code == 201, "Normal community post succeeds (201 Created)")
        created_post_id = res.json()["id"]

        # Oversized content
        oversized_content_post = {
            "title": "Valid Title",
            "content": "E" * 20001,
            "category": "Engineering",
        }
        res = client.post("/community/posts", headers=auth_lead, json=oversized_content_post)
        assert_test(res.status_code == 422, "Oversized community post content rejected with 422 Unprocessable Entity")

        # Oversized title
        oversized_title_post = {
            "title": "F" * 256,
            "content": "Valid content body",
            "category": "Engineering",
        }
        res = client.post("/community/posts", headers=auth_lead, json=oversized_title_post)
        assert_test(res.status_code == 422, "Oversized community post title rejected with 422 Unprocessable Entity")

        # Clean up created community post
        client.delete(f"/community/posts/{created_post_id}", headers=auth_lead)

        # ============================================================
        # 4. NGINX CONFIGURATION & SECURITY HEADERS
        # ============================================================
        print("\n--- 4. Nginx Configuration & Security Headers ---")

        nginx_conf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "nginx.conf"))
        assert_test(os.path.exists(nginx_conf_path), f"frontend/nginx.conf exists at '{nginx_conf_path}'")

        with open(nginx_conf_path, "r", encoding="utf-8") as f:
            nginx_content = f.read()

        # 4.1 Strict-Transport-Security presence and params
        assert_test("Strict-Transport-Security" in nginx_content, "Strict-Transport-Security header present in nginx.conf")
        assert_test("max-age=31536000" in nginx_content, "HSTS includes production max-age=31536000 (1 year)")
        assert_test("includeSubDomains" in nginx_content, "HSTS includes includeSubDomains")

        # 4.2 Content-Security-Policy presence and restrictive directives
        assert_test("Content-Security-Policy" in nginx_content, "Content-Security-Policy header present in nginx.conf")
        csp_match = re.search(r'add_header\s+Content-Security-Policy\s+"([^"]+)"', nginx_content)
        assert_test(csp_match is not None, "Content-Security-Policy header value matches standard syntax")
        if csp_match:
            csp_val = csp_match.group(1)
            assert_test("default-src 'self'" in csp_val, "CSP contains restrictive default-src 'self'")
            assert_test("script-src 'self' 'unsafe-inline'" in csp_val, "CSP contains script-src 'self' 'unsafe-inline' (supports inline theme script)")
            assert_test("https://fonts.googleapis.com" in csp_val, "CSP style-src allows Google Fonts")
            assert_test("https://fonts.gstatic.com" in csp_val, "CSP font-src allows Google Fonts gstatic")
            assert_test("connect-src" in csp_val and "wss:" in csp_val, "CSP connect-src permits WebSocket (wss:)")
            assert_test("object-src 'none'" in csp_val, "CSP object-src is 'none' (blocks plugins)")
            assert_test("base-uri 'self'" in csp_val, "CSP base-uri is 'self'")
            assert_test("frame-ancestors 'self'" in csp_val, "CSP frame-ancestors is 'self'")

        # 4.3 SPA fallback & routing preservation
        assert_test("try_files $uri $uri/ /index.html;" in nginx_content, "SPA fallback (try_files $uri $uri/ /index.html) is preserved")

        # 4.4 Existing security headers preserved
        assert_test('add_header X-Frame-Options "SAMEORIGIN"' in nginx_content, "X-Frame-Options SAMEORIGIN preserved")
        assert_test('add_header X-Content-Type-Options "nosniff"' in nginx_content, "X-Content-Type-Options nosniff preserved")
        assert_test('add_header Referrer-Policy "strict-origin-when-cross-origin"' in nginx_content, "Referrer-Policy preserved")

        print("\n" + "=" * 70)
        print(f"STAGE 3B HARDENING COMPLETE: {passed} PASSED, {failed} FAILED")
        print("=" * 70)
        return passed, failed

    finally:
        db.close()


if __name__ == "__main__":
    p, f = run_stage3b_tests()
    if f > 0:
        exit(1)
    exit(0)
