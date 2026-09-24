import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Task, TaskComment, Message, Conversation, CalendarEvent, CommunityPost
from app.auth import create_access_token, get_password_hash

client = TestClient(app)

def run_investigation():
    db = SessionLocal()
    print("=" * 80)
    print("NEXORA FORENSIC DELETE & TAKE-DOWN ACTION INVESTIGATION")
    print("=" * 80)
    
    try:
        # Create 2 Test Users & 1 Project
        u1_id = uuid.uuid4()
        u2_id = uuid.uuid4()
        proj_id = uuid.uuid4()

        user1 = User(
            id=u1_id,
            username=f"invest_u1_{u1_id.hex[:6]}",
            email=f"invest_u1_{u1_id.hex[:6]}@example.com",
            full_name="Investigator Lead",
            password_hash=get_password_hash("pass123"),
            system_role="student",
        )
        user2 = User(
            id=u2_id,
            username=f"invest_u2_{u2_id.hex[:6]}",
            email=f"invest_u2_{u2_id.hex[:6]}@example.com",
            full_name="Investigator Member",
            password_hash=get_password_hash("pass123"),
            system_role="student",
        )
        project = Project(
            id=proj_id,
            name=f"Invest Project {proj_id.hex[:4]}",
            description="Testing delete actions",
            status="Active"
        )
        db.add_all([user1, user2, project])
        db.commit()

        # Memberships
        m1 = ProjectMember(project_id=proj_id, user_id=u1_id, project_role="manager")
        m2 = ProjectMember(project_id=proj_id, user_id=u2_id, project_role="member")
        db.add_all([m1, m2])
        db.commit()

        token1 = create_access_token({"sub": str(u1_id), "username": user1.username})
        token2 = create_access_token({"sub": str(u2_id), "username": user2.username})
        auth1 = {"Authorization": f"Bearer {token1}"}
        auth2 = {"Authorization": f"Bearer {token2}"}

        # ----------------------------------------------------
        # 1. COMMUNITY FEED POST DELETE
        # ----------------------------------------------------
        print("\n[1] Investigating: Community Feed Post Delete (DELETE /community/posts/{id})")
        # Create
        c_post_res = client.post("/community/posts", json={
            "title": "Community Test Post",
            "content": "Testing delete flow",
            "category": "General"
        }, headers=auth1)
        print(f"    Create Status: {c_post_res.status_code}")
        c_post_id = c_post_res.json()["id"]
        
        # Non-author delete attempt
        c_del_nonauthor = client.delete(f"/community/posts/{c_post_id}", headers=auth2)
        print(f"    Non-author delete Status: {c_del_nonauthor.status_code} (Expected: 403)")
        
        # Author delete attempt
        c_del_author = client.delete(f"/community/posts/{c_post_id}", headers=auth1)
        print(f"    Author delete Status: {c_del_author.status_code} (Expected: 200)")
        
        db.expire_all()
        c_db_check = db.get(CommunityPost, uuid.UUID(c_post_id))
        print(f"    PostgreSQL Record Exists: {c_db_check is not None} (Expected: False)")

        # ----------------------------------------------------
        # 2. TASK DISCUSSION MESSAGE DELETE
        # ----------------------------------------------------
        print("\n[2] Investigating: Task Discussion Comment Delete (DELETE /tasks/{id}/discussion/{comment_id})")
        # Create task
        task = Task(
            id=uuid.uuid4(),
            project_id=proj_id,
            title="Discussion Test Task",
            status="TODO",
            priority="MEDIUM",
            reporter_id=u1_id,
        )
        db.add(task)
        db.commit()

        # Create comment by User 1
        comm_res = client.post(f"/tasks/{task.id}/discussion", json={
            "content": "Test comment by User 1"
        }, headers=auth1)
        print(f"    Create Comment Status: {comm_res.status_code}")
        comm_id = comm_res.json()["id"]

        # Non-author delete attempt
        comm_del_nonauthor = client.delete(f"/tasks/{task.id}/discussion/{comm_id}", headers=auth2)
        print(f"    Non-author delete Status: {comm_del_nonauthor.status_code} (Expected: 403)")

        # Author delete attempt
        comm_del_author = client.delete(f"/tasks/{task.id}/discussion/{comm_id}", headers=auth1)
        print(f"    Author delete Status: {comm_del_author.status_code} (Expected: 200)")

        db.expire_all()
        comm_db_check = db.get(TaskComment, uuid.UUID(comm_id))
        print(f"    PostgreSQL Record Exists: {comm_db_check is not None} (Expected: False)")

        # ----------------------------------------------------
        # 3. PROJECT CHAT MESSAGE DELETE
        # ----------------------------------------------------
        print(f"\n[3] Investigating: Project Chat Message Delete (DELETE /projects/{proj_id}/chat/messages/{'{id}'})")
        # Create chat message by User 1
        chat_res = client.post(f"/projects/{proj_id}/chat/messages", json={
            "content": "Test chat message"
        }, headers=auth1)
        print(f"    Create Chat Msg Status: {chat_res.status_code}")
        chat_msg_id = chat_res.json()["id"]

        # Non-author delete attempt
        chat_del_nonauthor = client.delete(f"/projects/{proj_id}/chat/messages/{chat_msg_id}", headers=auth2)
        print(f"    Non-author delete Status: {chat_del_nonauthor.status_code} (Expected: 403)")

        # Author delete attempt
        chat_del_author = client.delete(f"/projects/{proj_id}/chat/messages/{chat_msg_id}", headers=auth1)
        print(f"    Author delete Status: {chat_del_author.status_code} (Expected: 200)")

        db.expire_all()
        chat_db_check = db.get(Message, uuid.UUID(chat_msg_id))
        print(f"    PostgreSQL Record Exists: {chat_db_check is not None} (Expected: False)")

        # ----------------------------------------------------
        # 4. TASK DELETE
        # ----------------------------------------------------
        print(f"\n[4] Investigating: Task Delete (DELETE /projects/{proj_id}/tasks/{'{id}'})")
        task2 = Task(
            id=uuid.uuid4(),
            project_id=proj_id,
            title="Task To Be Deleted",
            status="TODO",
            priority="LOW",
            reporter_id=u1_id,
        )
        db.add(task2)
        db.commit()

        task2_id = task2.id
        task_del_res = client.delete(f"/projects/{proj_id}/tasks/{task2_id}", headers=auth1)
        print(f"    Delete Task Status: {task_del_res.status_code} (Expected: 204)")

        db.expire_all()
        task_db_check = db.get(Task, task2_id)
        print(f"    PostgreSQL Record Exists: {task_db_check is not None} (Expected: False)")

        # ----------------------------------------------------
        # 5. MEETING CANCELLATION / DELETE
        # ----------------------------------------------------
        print(f"\n[5] Investigating: Meeting Cancel (DELETE /workflow/calendar/events/{'{id}'})")
        # User 1 schedules a meeting
        evt_res = client.post(f"/workflow/calendar/events/{proj_id}", json={
            "title": "Sprint Sync Meeting",
            "start_time": "2026-09-25T10:00:00Z",
            "event_type": "MEETING"
        }, headers=auth1)
        print(f"    Schedule Event Status: {evt_res.status_code}")
        evt_id = evt_res.json()["id"]

        # Non-scheduler cancels -> 403
        evt_del_nonauth = client.delete(f"/workflow/calendar/events/{evt_id}", headers=auth2)
        print(f"    Non-scheduler cancel Status: {evt_del_nonauth.status_code} (Expected: 403)")

        # Scheduler cancels -> 200
        evt_del_auth = client.delete(f"/workflow/calendar/events/{evt_id}", headers=auth1)
        print(f"    Scheduler cancel Status: {evt_del_auth.status_code} (Expected: 200)")

        db.expire_all()
        evt_db_check = db.get(CalendarEvent, uuid.UUID(evt_id))
        print(f"    PostgreSQL Record Exists: {evt_db_check is not None} (Expected: False)")

        # ----------------------------------------------------
        # 6. LEAVE PROJECT
        # ----------------------------------------------------
        print(f"\n[6] Investigating: Leave Project (POST /projects/{proj_id}/leave & DELETE /projects/{proj_id})")
        leave_res = client.post(f"/projects/{proj_id}/leave", headers=auth2)
        print(f"    User 2 Leave Status: {leave_res.status_code} (Expected: 200)")

        db.expire_all()
        m2_db_check = db.get(ProjectMember, (proj_id, u2_id))
        print(f"    User 2 Member Exists: {m2_db_check is not None} (Expected: False)")
        proj_db_check = db.get(Project, proj_id)
        print(f"    Project Entity Intact: {proj_db_check is not None} (Expected: True)")

        print("\n" + "=" * 80)
        print("ALL BACKEND DELETE & TAKE-DOWN ENDPOINTS AUDIT COMPLETED")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_investigation()
