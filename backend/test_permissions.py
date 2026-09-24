import uuid
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Message, Conversation, Task, TaskComment, CalendarEvent, Notification
from app.auth import get_password_hash, create_access_token

client = TestClient(app)

def test_permissions_suite():
    db: Session = SessionLocal()
    try:
        # 1. Setup two test users
        u1_id = uuid.uuid4()
        u2_id = uuid.uuid4()
        dev_hash = get_password_hash("password123")

        u1 = User(id=u1_id, username=f"test_u1_{uuid.uuid4().hex[:6]}", email=f"u1_{uuid.uuid4().hex[:6]}@example.com", full_name="User One", password_hash=dev_hash, system_role="student")
        u2 = User(id=u2_id, username=f"test_u2_{uuid.uuid4().hex[:6]}", email=f"u2_{uuid.uuid4().hex[:6]}@example.com", full_name="User Two", password_hash=dev_hash, system_role="student")
        db.add_all([u1, u2])
        db.commit()

        token1 = create_access_token(data={"sub": str(u1_id), "username": u1.username})
        token2 = create_access_token(data={"sub": str(u2_id), "username": u2.username})

        auth1 = {"Authorization": f"Bearer {token1}"}
        auth2 = {"Authorization": f"Bearer {token2}"}

        # 2. Setup project with both members
        proj = Project(
            id=uuid.uuid4(),
            name="Permissions Test Project",
            description="Testing permissions",
            status="Active",
            project_type="Academic"
        )
        db.add(proj)
        db.flush()

        m1 = ProjectMember(project_id=proj.id, user_id=u1_id, project_role="manager")
        m2 = ProjectMember(project_id=proj.id, user_id=u2_id, project_role="member")
        db.add_all([m1, m2])
        db.commit()

        # ----------------------------------------------------
        # TEST A: Project Chat Message Deletion (Sender only)
        # ----------------------------------------------------
        # User 1 sends a message
        res = client.post(f"/projects/{proj.id}/chat/messages", json={"content": "Hello from U1"}, headers=auth1)
        assert res.status_code == 201, res.text
        msg_id = res.json()["id"]

        # Unauthenticated cannot delete
        res_unauth = client.delete(f"/projects/{proj.id}/chat/messages/{msg_id}")
        assert res_unauth.status_code == 401

        # User 2 (not sender) cannot delete User 1's message -> 403
        res_forbidden = client.delete(f"/projects/{proj.id}/chat/messages/{msg_id}", headers=auth2)
        assert res_forbidden.status_code == 403

        # User 1 (sender) CAN delete their own message -> 200
        res_ok = client.delete(f"/projects/{proj.id}/chat/messages/{msg_id}", headers=auth1)
        assert res_ok.status_code == 200

        # Verify message is gone
        res_check = client.get(f"/projects/{proj.id}/chat/messages", headers=auth1)
        assert not any(m["id"] == msg_id for m in res_check.json())
        print("PASS: Project Chat message deletion (Sender only, 401 unauthenticated, 403 non-sender, 200 sender)")

        # ----------------------------------------------------
        # TEST B: Task Discussion Comment Deletion (Sender only)
        # ----------------------------------------------------
        task = Task(id=uuid.uuid4(), project_id=proj.id, title="Test Task", reporter_id=u1_id)
        db.add(task)
        db.commit()

        # User 1 creates comment
        res_comm = client.post(f"/tasks/{task.id}/discussion", json={"content": "Discussion comment by U1"}, headers=auth1)
        assert res_comm.status_code == 200, res_comm.text
        comment_id = res_comm.json()["id"]

        # User 2 tries to delete User 1's comment -> 403
        res_comm_forbid = client.delete(f"/tasks/{task.id}/discussion/{comment_id}", headers=auth2)
        assert res_comm_forbid.status_code == 403

        # User 1 deletes their own comment -> 200
        res_comm_ok = client.delete(f"/tasks/{task.id}/discussion/{comment_id}", headers=auth1)
        assert res_comm_ok.status_code == 200
        print("PASS: Task discussion comment deletion (Sender only, 403 non-sender, 200 sender)")

        # ----------------------------------------------------
        # TEST C: Meeting Scheduling & Cancellation (Scheduler only + Notifications)
        # ----------------------------------------------------
        start_time_iso = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        res_meet = client.post(f"/workflow/calendar/events/{proj.id}", json={
            "title": "Sprint Review",
            "description": "Weekly progress review",
            "event_type": "MEETING",
            "start_time": start_time_iso,
        }, headers=auth1)
        assert res_meet.status_code == 201, res_meet.text
        meeting_id = res_meet.json()["id"]
        assert res_meet.json()["creator_id"] == str(u1_id)

        # Verify User 2 received notification for scheduled meeting
        res_notifs_u2 = client.get("/workflow/notifications", headers=auth2)
        assert res_notifs_u2.status_code == 200
        assert any("Sprint Review" in n["message"] or "Sprint Review" in n["title"] for n in res_notifs_u2.json())

        # User 2 tries to cancel User 1's meeting -> 403
        res_meet_forbid = client.delete(f"/workflow/calendar/events/{meeting_id}", headers=auth2)
        assert res_meet_forbid.status_code == 403

        # User 1 (scheduler) cancels meeting -> 200
        res_meet_cancel = client.delete(f"/workflow/calendar/events/{meeting_id}", headers=auth1)
        assert res_meet_cancel.status_code == 200

        # Verify User 2 received cancellation notification
        res_notifs_u2_after = client.get("/workflow/notifications", headers=auth2)
        assert any("cancelled" in n["title"].lower() or "cancelled" in n["message"].lower() for n in res_notifs_u2_after.json())
        print("PASS: Meeting scheduling & cancellation permissions & notifications")

        # ----------------------------------------------------
        # TEST D: Community Post Take-down (Author only)
        # ----------------------------------------------------
        res_post = client.post("/community/posts", json={
            "title": "My Post",
            "content": "Content of my post",
            "category": "Tech"
        }, headers=auth1)
        assert res_post.status_code == 201, res_post.text
        post_id = res_post.json()["id"]

        # User 2 tries to delete User 1's post -> 403
        res_post_forbid = client.delete(f"/community/posts/{post_id}", headers=auth2)
        assert res_post_forbid.status_code == 403

        # User 1 deletes their own post -> 200
        res_post_ok = client.delete(f"/community/posts/{post_id}", headers=auth1)
        assert res_post_ok.status_code == 200
        print("PASS: Community Post take-down (Author only, 403 non-author, 200 author)")

        # ----------------------------------------------------
        # TEST E: Leave Project (Non-destructive removal of user only)
        # ----------------------------------------------------
        # User 2 leaves the project
        res_leave = client.post(f"/projects/{proj.id}/leave", headers=auth2)
        assert res_leave.status_code == 200, res_leave.text

        # Verify User 2 is no longer in ProjectMember
        m2_check = db.scalar(select(ProjectMember).where(ProjectMember.project_id == proj.id, ProjectMember.user_id == u2_id))
        assert m2_check is None

        # Verify Project still exists
        proj_check = db.get(Project, proj.id)
        assert proj_check is not None

        # Verify User 1 is still a member and project manager
        m1_check = db.scalar(select(ProjectMember).where(ProjectMember.project_id == proj.id, ProjectMember.user_id == u1_id))
        assert m1_check is not None
        assert m1_check.project_role == "manager"

        # Verify User 2 cannot access discussion anymore -> 403
        res_access_denied = client.get(f"/tasks/{task.id}/discussion", headers=auth2)
        assert res_access_denied.status_code == 403

        print("PASS: Leave Project (Preserves project & remaining members, removes user access)")

        print("\nALL BACKEND PERMISSION TESTS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    test_permissions_suite()
