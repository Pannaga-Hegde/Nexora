"""
STAGE 3A: HIGH-SEVERITY AUTHORIZATION REMEDIATION TEST SUITE

Tests cross-project isolation across the 6 high-severity vulnerability targets:
H-01: Analytics Global Search (Tasks, Messages, Files)
H-02: Contribution Reports (Download & Email)
H-03: Calendar Events (Read, Create, Cancel)
H-04: Milestones & Academic Templates (Read, Create, Toggle, Template)
H-05: Task Activities (Read & Create Comment)
H-06: Scheduling Suggestions (Team Availability)

Verifies User A (member of Project A only) CANNOT access or mutate Project B resources,
and that unauthenticated access returns 401.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import engine, Base, SessionLocal
from app.models import (
    User,
    Project,
    ProjectMember,
    Task,
    Conversation,
    Message,
    FileStorage,
    Milestone,
    CalendarEvent,
    TaskActivity,
    ActivityType,
)
from app.auth import get_password_hash, create_access_token

Base.metadata.create_all(bind=engine)
client = TestClient(app)

print("=" * 70)
print("STAGE 3A AUTHORIZATION: CROSS-PROJECT REGRESSION TEST MATRIX")
print("=" * 70)


def run_stage3a_tests():
    db = SessionLocal()
    passed_count = 0
    failed_count = 0

    def assert_test(condition, name):
        nonlocal passed_count, failed_count
        if condition:
            print(f"  [PASS] {name}")
            passed_count += 1
        else:
            print(f"  [FAIL] {name}")
            failed_count += 1
            raise AssertionError(f"Test failed: {name}")

    try:
        # 1. Setup isolated test users
        u_a_id = uuid.uuid4()
        u_b_id = uuid.uuid4()
        dev_hash = get_password_hash("Password123!")

        u_a = User(
            id=u_a_id,
            username=f"stage3a_a_{uuid.uuid4().hex[:6]}",
            email=f"stage3a_a_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Alice Alpha",
            password_hash=dev_hash,
            system_role="student",
        )
        u_b = User(
            id=u_b_id,
            username=f"stage3a_b_{uuid.uuid4().hex[:6]}",
            email=f"stage3a_b_{uuid.uuid4().hex[:6]}@example.com",
            full_name="Bob Beta",
            password_hash=dev_hash,
            system_role="student",
        )
        db.add_all([u_a, u_b])

        # 2. Setup isolated projects
        proj_a_id = uuid.uuid4()
        proj_b_id = uuid.uuid4()

        proj_a = Project(
            id=proj_a_id,
            name="Project Alpha Confidential",
            description="Alpha isolation scope",
            status="Active",
            project_type="Academic",
        )
        proj_b = Project(
            id=proj_b_id,
            name="Project Beta Confidential",
            description="Beta isolation scope",
            status="Active",
            project_type="Academic",
        )
        db.add_all([proj_a, proj_b])
        db.flush()

        # 3. Associate memberships: User A -> Project A ONLY, User B -> Project B ONLY
        mem_a = ProjectMember(project_id=proj_a_id, user_id=u_a_id, project_role="manager")
        mem_b = ProjectMember(project_id=proj_b_id, user_id=u_b_id, project_role="manager")
        db.add_all([mem_a, mem_b])

        # 4. Populate Project A resources
        task_a_id = uuid.uuid4()
        task_a = Task(
            id=task_a_id,
            project_id=proj_a_id,
            title="Alpha Unique Roadmap Task",
            description="Alpha task details",
            status="TODO",
            reporter_id=u_a_id,
        )
        conv_a_id = uuid.uuid4()
        conv_a = Conversation(id=conv_a_id, project_id=proj_a_id, name="Alpha Channel")
        msg_a = Message(
            id=uuid.uuid4(),
            conversation_id=conv_a_id,
            sender_id=u_a_id,
            content="Alpha Secret Protocol Message",
        )
        file_a = FileStorage(
            id=uuid.uuid4(),
            project_id=proj_a_id,
            uploader_id=u_a_id,
            file_name="Alpha_Confidential_Doc.pdf",
            file_url="/storage/alpha_doc.pdf",
            file_size=1024,
        )
        milestone_a_id = uuid.uuid4()
        milestone_a = Milestone(
            id=milestone_a_id,
            project_id=proj_a_id,
            title="Alpha Milestone V1",
            is_completed=False,
        )
        cal_event_a = CalendarEvent(
            id=uuid.uuid4(),
            project_id=proj_a_id,
            creator_id=u_a_id,
            title="Alpha Team Sync",
            event_type="MEETING",
            start_time=datetime.now(timezone.utc),
        )
        act_a = TaskActivity(
            id=uuid.uuid4(),
            task_id=task_a_id,
            actor_id=u_a_id,
            activity_type=ActivityType.COMMENT,
            content="Alpha internal progress note",
        )
        db.add_all([task_a, conv_a, msg_a, file_a, milestone_a, cal_event_a, act_a])

        # 5. Populate Project B resources
        task_b_id = uuid.uuid4()
        task_b = Task(
            id=task_b_id,
            project_id=proj_b_id,
            title="Beta Unique Roadmap Task",
            description="Beta task details",
            status="TODO",
            reporter_id=u_b_id,
        )
        conv_b_id = uuid.uuid4()
        conv_b = Conversation(id=conv_b_id, project_id=proj_b_id, name="Beta Channel")
        msg_b = Message(
            id=uuid.uuid4(),
            conversation_id=conv_b_id,
            sender_id=u_b_id,
            content="Beta Secret Protocol Message",
        )
        file_b = FileStorage(
            id=uuid.uuid4(),
            project_id=proj_b_id,
            uploader_id=u_b_id,
            file_name="Beta_Confidential_Doc.pdf",
            file_url="/storage/beta_doc.pdf",
            file_size=2048,
        )
        milestone_b_id = uuid.uuid4()
        milestone_b = Milestone(
            id=milestone_b_id,
            project_id=proj_b_id,
            title="Beta Milestone V1",
            is_completed=False,
        )
        cal_event_b = CalendarEvent(
            id=uuid.uuid4(),
            project_id=proj_b_id,
            creator_id=u_b_id,
            title="Beta Team Sync",
            event_type="MEETING",
            start_time=datetime.now(timezone.utc),
        )
        act_b = TaskActivity(
            id=uuid.uuid4(),
            task_id=task_b_id,
            actor_id=u_b_id,
            activity_type=ActivityType.COMMENT,
            content="Beta internal progress note",
        )
        db.add_all([task_b, conv_b, msg_b, file_b, milestone_b, cal_event_b, act_b])
        db.commit()

        # Generate tokens
        token_a = create_access_token(data={"sub": str(u_a_id), "username": u_a.username})
        token_b = create_access_token(data={"sub": str(u_b_id), "username": u_b.username})

        auth_a = {"Authorization": f"Bearer {token_a}"}
        auth_b = {"Authorization": f"Bearer {token_b}"}

        print("\n--- 1. Analytics Global Search Scoping (H-01) ---")
        # 1. Search Project B tasks: User A searching for 'Beta' must NOT receive Beta tasks
        res = client.get("/analytics/search?q=Beta", headers=auth_a)
        assert_test(res.status_code == 200, "Search query returns 200 for authenticated user")
        items = res.json()
        assert_test(not any(i["type"] == "task" and "Beta" in i["title"] for i in items), "1. Search Project B tasks: User A CANNOT see Beta tasks")

        # 2. Search Project B messages: User A searching for 'Beta Secret' must NOT receive Beta messages
        assert_test(not any(i["type"] == "message" and "Beta" in i["title"] for i in items), "2. Search Project B messages: User A CANNOT see Beta messages")

        # 3. Search Project B files: User A searching for 'Beta' must NOT receive Beta files
        assert_test(not any(i["type"] == "file" and "Beta" in i["title"] for i in items), "3. Search Project B files: User A CANNOT see Beta files")

        # Verify User A CAN find Alpha resources
        res_alpha = client.get("/analytics/search?q=Alpha", headers=auth_a)
        alpha_items = res_alpha.json()
        assert_test(any(i["type"] == "task" and "Alpha" in i["title"] for i in alpha_items), "User A CAN search and see own Project A tasks")
        assert_test(any(i["type"] == "message" and "Alpha" in i["title"] for i in alpha_items), "User A CAN search and see own Project A messages")
        assert_test(any(i["type"] == "file" and "Alpha" in i["title"] for i in alpha_items), "User A CAN search and see own Project A files")

        # Unauthenticated search
        res_unauth = client.get("/analytics/search?q=Alpha")
        assert_test(res_unauth.status_code == 401, "Unauthenticated global search rejected with 401")

        print("\n--- 2. Contribution Report Authorization (H-02) ---")
        # 4. Download Project B contribution report
        res = client.get(f"/projects/{proj_b_id}/reports/contribution", headers=auth_a)
        assert_test(res.status_code == 403, "4. Download Project B contribution report: User A blocked with 403")

        res_unauth = client.get(f"/projects/{proj_b_id}/reports/contribution")
        assert_test(res_unauth.status_code == 401, "Download contribution report unauthenticated blocked with 401")

        res_own = client.get(f"/projects/{proj_a_id}/reports/contribution", headers=auth_a)
        assert_test(res_own.status_code == 200 and "application/pdf" in res_own.headers.get("content-type", ""), "User A CAN download own Project A contribution report")

        # 5. Email Project B contribution report
        email_payload = {"recipient_email": "advisor@university.edu", "note": "Check project progress"}
        res = client.post(f"/projects/{proj_b_id}/reports/email", json=email_payload, headers=auth_a)
        assert_test(res.status_code == 403, "5. Email Project B contribution report: User A blocked with 403")

        res_unauth = client.post(f"/projects/{proj_b_id}/reports/email", json=email_payload)
        assert_test(res_unauth.status_code == 401, "Email contribution report unauthenticated blocked with 401")

        print("\n--- 3. Calendar Authorization (H-03) ---")
        # 6. Read Project B calendar events
        res = client.get(f"/workflow/calendar/events/{proj_b_id}", headers=auth_a)
        assert_test(res.status_code == 403, "6. Read Project B calendar events: User A blocked with 403")

        res_unauth = client.get(f"/workflow/calendar/events/{proj_b_id}")
        assert_test(res_unauth.status_code == 401, "Read calendar events unauthenticated blocked with 401")

        res_own = client.get(f"/workflow/calendar/events/{proj_a_id}", headers=auth_a)
        assert_test(res_own.status_code == 200, "User A CAN read own Project A calendar events")

        # 7. Create Project B calendar events
        event_payload = {
            "title": "Unauthorized Cross-Project Event",
            "description": "Injection test",
            "event_type": "MEETING",
            "start_time": "2026-10-15T14:00:00Z",
        }
        res = client.post(f"/workflow/calendar/events/{proj_b_id}", json=event_payload, headers=auth_a)
        assert_test(res.status_code == 403, "7. Create Project B calendar events: User A blocked with 403")

        res_unauth = client.post(f"/workflow/calendar/events/{proj_b_id}", json=event_payload)
        assert_test(res_unauth.status_code == 401, "Create calendar event unauthenticated blocked with 401")

        res_create_own = client.post(f"/workflow/calendar/events/{proj_a_id}", json=event_payload, headers=auth_a)
        assert_test(res_create_own.status_code == 201, "User A CAN create events in own Project A")

        print("\n--- 4. Milestones & Academic Templates Authorization (H-04) ---")
        # 8. Read Project B milestones
        res = client.get(f"/analytics/milestones/{proj_b_id}", headers=auth_a)
        assert_test(res.status_code == 403, "8. Read Project B milestones: User A blocked with 403")

        res_unauth = client.get(f"/analytics/milestones/{proj_b_id}")
        assert_test(res_unauth.status_code == 401, "Read milestones unauthenticated blocked with 401")

        res_own = client.get(f"/analytics/milestones/{proj_a_id}", headers=auth_a)
        assert_test(res_own.status_code == 200, "User A CAN read own Project A milestones")

        # 9. Create Project B milestones
        ms_payload = {"title": "Unauthorized Milestone", "description": "Exploit"}
        res = client.post(f"/analytics/milestones/{proj_b_id}", json=ms_payload, headers=auth_a)
        assert_test(res.status_code == 403, "9. Create Project B milestones: User A blocked with 403")

        res_unauth = client.post(f"/analytics/milestones/{proj_b_id}", json=ms_payload)
        assert_test(res_unauth.status_code == 401, "Create milestone unauthenticated blocked with 401")

        res_create_own = client.post(f"/analytics/milestones/{proj_a_id}", json=ms_payload, headers=auth_a)
        assert_test(res_create_own.status_code == 201, "User A CAN create milestone in own Project A")

        # 10. Toggle Project B milestone
        res = client.patch(f"/analytics/milestones/{milestone_b_id}/toggle", headers=auth_a)
        assert_test(res.status_code == 403, "10. Toggle Project B milestone: User A blocked with 403")

        res_unauth = client.patch(f"/analytics/milestones/{milestone_b_id}/toggle")
        assert_test(res_unauth.status_code == 401, "Toggle milestone unauthenticated blocked with 401")

        res_toggle_b = client.patch(f"/analytics/milestones/{milestone_b_id}/toggle", headers=auth_b)
        assert_test(res_toggle_b.status_code == 200, "User B CAN toggle own Project B milestone")

        # 11. Apply Project B academic template
        template_payload = {"template_type": "CAPSTONE"}
        res = client.post(f"/analytics/templates/{proj_b_id}", json=template_payload, headers=auth_a)
        assert_test(res.status_code == 403, "11. Apply Project B academic template: User A blocked with 403")

        res_unauth = client.post(f"/analytics/templates/{proj_b_id}", json=template_payload)
        assert_test(res_unauth.status_code == 401, "Apply academic template unauthenticated blocked with 401")

        res_template_b = client.post(f"/analytics/templates/{proj_b_id}", json=template_payload, headers=auth_b)
        assert_test(res_template_b.status_code == 200, "User B CAN apply academic template to own Project B")

        print("\n--- 5. Task Activities Authorization (H-05) ---")
        # 12. Read Project B task activities
        res = client.get(f"/projects/{proj_b_id}/tasks/{task_b_id}/activities", headers=auth_a)
        assert_test(res.status_code == 403, "12. Read Project B task activities: User A blocked with 403")

        res_unauth = client.get(f"/projects/{proj_b_id}/tasks/{task_b_id}/activities")
        assert_test(res_unauth.status_code == 401, "Read task activities unauthenticated blocked with 401")

        res_own = client.get(f"/projects/{proj_a_id}/tasks/{task_a_id}/activities", headers=auth_a)
        assert_test(res_own.status_code == 200, "User A CAN read own Project A task activities")

        # 13. Create Project B task activities (comment)
        comment_payload = {"content": "Unauthorized injected comment"}
        res = client.post(f"/projects/{proj_b_id}/tasks/{task_b_id}/activities", json=comment_payload, headers=auth_a)
        assert_test(res.status_code == 403, "13. Create Project B task activities: User A blocked with 403")

        res_unauth = client.post(f"/projects/{proj_b_id}/tasks/{task_b_id}/activities", json=comment_payload)
        assert_test(res_unauth.status_code == 401, "Create task activity unauthenticated blocked with 401")

        res_own_comment = client.post(f"/projects/{proj_a_id}/tasks/{task_a_id}/activities", json=comment_payload, headers=auth_a)
        assert_test(res_own_comment.status_code == 201, "User A CAN add comments to own Project A task")

        print("\n--- 6. Scheduling Suggestions Authorization (H-06) ---")
        # 14. Read Project B scheduling suggestions
        res = client.get(f"/scheduling/projects/{proj_b_id}/suggestions", headers=auth_a)
        assert_test(res.status_code == 403, "14. Read Project B scheduling suggestions: User A blocked with 403")

        res_unauth = client.get(f"/scheduling/projects/{proj_b_id}/suggestions")
        assert_test(res_unauth.status_code == 401, "Read scheduling suggestions unauthenticated blocked with 401")

        res_own_sched = client.get(f"/scheduling/projects/{proj_a_id}/suggestions", headers=auth_a)
        assert_test(res_own_sched.status_code == 200, "User A CAN read own Project A scheduling suggestions")

        print("\n" + "=" * 70)
        print(f"STAGE 3A TEST COMPLETE: {passed_count} PASSED, {failed_count} FAILED")
        print("=" * 70)
        return passed_count, failed_count

    finally:
        db.close()


if __name__ == "__main__":
    passed, failed = run_stage3a_tests()
    if failed > 0:
        exit(1)
    exit(0)
