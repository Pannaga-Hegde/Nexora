import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models import User, Notification
from app.auth import get_password_hash, create_access_token
from app.services.notifications import trigger_notification

client = TestClient(app)

def test_actionable_notifications_suite():
    """
    Verify Actionable Notifications backend contracts:
    1. Unauthenticated notification access is rejected (401).
    2. Notifications are created with internal link_url destinations.
    3. User can list their own notifications.
    4. Marking notification as read updates is_read flag.
    5. Already-read notifications remain read and accessible.
    6. Notifications without link_url (None) are supported cleanly.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    dev_hash = get_password_hash("password123")

    db: Session = SessionLocal()
    try:
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            username=f"notif_user_{unique_suffix}",
            email=f"notif_{unique_suffix}@example.com",
            full_name=f"Notif User {unique_suffix}",
            password_hash=dev_hash,
            system_role="student"
        )
        db.add(user)
        db.commit()

        # Create 3 notifications:
        # 1. Actionable Task notification with link_url
        notif_task = trigger_notification(
            db=db,
            user_id=user_id,
            title="Task Assigned: Build API",
            message="You were assigned a new task.",
            link_url="/tasks"
        )
        # 2. Actionable Meeting notification with link_url
        notif_meeting = trigger_notification(
            db=db,
            user_id=user_id,
            title="Sprint Review Meeting",
            message="Meeting scheduled for tomorrow.",
            link_url="/calendar"
        )
        # 3. Informational notification without link_url
        notif_info = trigger_notification(
            db=db,
            user_id=user_id,
            title="System Maintenance",
            message="Scheduled platform update tonight.",
            link_url=None
        )

        token = create_access_token(data={"sub": str(user_id), "username": user.username})
        headers = {"Authorization": f"Bearer {token}"}

        # Step 1: Unauthenticated request rejected
        res_unauth = client.get("/workflow/notifications")
        assert res_unauth.status_code == 401
        print("PASS: Unauthenticated notifications request rejected (401)")

        # Step 2: List notifications for user
        res_list = client.get("/workflow/notifications", headers=headers)
        assert res_list.status_code == 200, res_list.text
        notifs = res_list.json()
        assert len(notifs) >= 3

        task_item = next(n for n in notifs if n["id"] == str(notif_task.id))
        meeting_item = next(n for n in notifs if n["id"] == str(notif_meeting.id))
        info_item = next(n for n in notifs if n["id"] == str(notif_info.id))

        assert task_item["link_url"] == "/tasks"
        assert task_item["is_read"] is False
        assert meeting_item["link_url"] == "/calendar"
        assert meeting_item["is_read"] is False
        assert info_item["link_url"] is None
        assert info_item["is_read"] is False
        print("PASS: Notification payloads correctly returned with valid link_url destinations")

        # Step 3: Mark task notification as read
        res_read = client.patch(f"/workflow/notifications/{notif_task.id}/read", headers=headers)
        assert res_read.status_code == 200
        assert res_read.json()["status"] == "success"

        # Step 4: Verify read state updated in database
        res_list_after = client.get("/workflow/notifications", headers=headers)
        assert res_list_after.status_code == 200
        notifs_after = res_list_after.json()
        task_item_after = next(n for n in notifs_after if n["id"] == str(notif_task.id))
        assert task_item_after["is_read"] is True
        print("PASS: Notification read status updated and verified")

        # Step 5: Mark already-read notification again (idempotent)
        res_read_again = client.patch(f"/workflow/notifications/{notif_task.id}/read", headers=headers)
        assert res_read_again.status_code == 200
        print("PASS: Idempotent mark-as-read verified")

        print("\nALL ACTIONABLE NOTIFICATIONS BACKEND TESTS PASSED PERFECTLY!")

    finally:
        db.close()

if __name__ == "__main__":
    test_actionable_notifications_suite()
