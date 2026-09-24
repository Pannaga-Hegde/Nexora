import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.models import User, Project, ProjectMember, Task
from app.auth import get_password_hash, create_access_token

client = TestClient(app)

def test_dynamic_task_assignees_and_project_isolation():
    """
    Verify dynamic task assignees:
    1. Project A has Member 1 and Member 2.
    2. Project B has Member 3 only.
    3. Creating a task in Project A with Member 2 succeeds.
    4. Attempting to assign Member 3 to a task in Project A fails (400 - not a member).
    5. Reassigning task in Project A to Member 1 succeeds.
    6. Unassigning task succeeds.
    7. Members endpoint returns only project members for Project A vs Project B.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    dev_hash = get_password_hash("password123")
    
    db: Session = SessionLocal()
    try:
        # Create 3 users
        u1_id = uuid.uuid4()
        u2_id = uuid.uuid4()
        u3_id = uuid.uuid4()

        u1 = User(
            id=u1_id,
            username=f"assignee_u1_{unique_suffix}",
            email=f"u1_{unique_suffix}@example.com",
            full_name=f"User One {unique_suffix}",
            password_hash=dev_hash,
            system_role="student"
        )
        u2 = User(
            id=u2_id,
            username=f"assignee_u2_{unique_suffix}",
            email=f"u2_{unique_suffix}@example.com",
            full_name=f"User Two {unique_suffix}",
            password_hash=dev_hash,
            system_role="student"
        )
        u3 = User(
            id=u3_id,
            username=f"assignee_u3_{unique_suffix}",
            email=f"u3_{unique_suffix}@example.com",
            full_name=f"User Three {unique_suffix}",
            password_hash=dev_hash,
            system_role="student"
        )
        db.add_all([u1, u2, u3])
        db.commit()

        # Create Project A with u1 (owner/lead) and u2 (member)
        proj_a_id = uuid.uuid4()
        proj_a = Project(
            id=proj_a_id,
            name=f"Project A {unique_suffix}",
            description="Test Project A"
        )
        # Create Project B with u3 (owner/lead)
        proj_b_id = uuid.uuid4()
        proj_b = Project(
            id=proj_b_id,
            name=f"Project B {unique_suffix}",
            description="Test Project B"
        )
        db.add_all([proj_a, proj_b])
        db.commit()

        # Memberships
        pm_a1 = ProjectMember(project_id=proj_a_id, user_id=u1_id, project_role="lead")
        pm_a2 = ProjectMember(project_id=proj_a_id, user_id=u2_id, project_role="student")
        pm_b3 = ProjectMember(project_id=proj_b_id, user_id=u3_id, project_role="lead")
        db.add_all([pm_a1, pm_a2, pm_b3])
        db.commit()

        # Auth headers for u1
        token_u1 = create_access_token(data={"sub": str(u1_id), "username": u1.username})
        headers_u1 = {"Authorization": f"Bearer {token_u1}"}

        # Step 1: Verify Project A members list
        res_a_members = client.get(f"/projects/{proj_a_id}/members", headers=headers_u1)
        assert res_a_members.status_code == 200, res_a_members.text
        a_members = res_a_members.json()
        a_member_ids = {m["id"] for m in a_members}
        assert str(u1_id) in a_member_ids
        assert str(u2_id) in a_member_ids
        assert str(u3_id) not in a_member_ids
        print("PASS: Project A members correctly isolated")

        # Step 2: Create task in Project A assigned to u2 (valid member)
        res_create_task = client.post(
            f"/projects/{proj_a_id}/tasks",
            headers=headers_u1,
            json={
                "title": "Task for Member 2",
                "description": "Integration test task",
                "priority": "HIGH",
                "status": "TODO",
                "assignee_id": str(u2_id)
            }
        )
        assert res_create_task.status_code == 201, res_create_task.text
        task_data = res_create_task.json()
        assert task_data["assignee_id"] == str(u2_id)
        task_id = task_data["id"]
        print("PASS: Task creation with valid project member assignee succeeded (201)")

        # Step 3: Attempt to create task in Project A assigned to u3 (non-member) -> MUST FAIL (400)
        res_invalid_assign = client.post(
            f"/projects/{proj_a_id}/tasks",
            headers=headers_u1,
            json={
                "title": "Invalid Task Assignment",
                "priority": "LOW",
                "status": "TODO",
                "assignee_id": str(u3_id)
            }
        )
        assert res_invalid_assign.status_code == 400
        print("PASS: Non-member assignment properly rejected by backend (400 Bad Request)")

        # Step 4: Update task in Project A: reassign to u1 (valid member)
        res_update_u1 = client.patch(
            f"/projects/{proj_a_id}/tasks/{task_id}",
            headers=headers_u1,
            json={"assignee_id": str(u1_id)}
        )
        assert res_update_u1.status_code == 200, res_update_u1.text
        assert res_update_u1.json()["assignee_id"] == str(u1_id)
        print("PASS: Reassigning task to valid member succeeded (200)")

        # Step 5: Attempt to reassign task in Project A to u3 (non-member) -> MUST FAIL (400)
        res_update_invalid = client.patch(
            f"/projects/{proj_a_id}/tasks/{task_id}",
            headers=headers_u1,
            json={"assignee_id": str(u3_id)}
        )
        assert res_update_invalid.status_code == 400
        print("PASS: Reassigning to non-member rejected (400 Bad Request)")

        # Step 6: Unassign task (set to None)
        res_unassign = client.patch(
            f"/projects/{proj_a_id}/tasks/{task_id}",
            headers=headers_u1,
            json={"assignee_id": None}
        )
        assert res_unassign.status_code == 200, res_unassign.text
        assert res_unassign.json()["assignee_id"] is None
        print("PASS: Unassigning task succeeded (200)")

        print("\nALL DYNAMIC TASK ASSIGNEES & ISOLATION TESTS PASSED PERFECTLY!")
    finally:
        db.close()

if __name__ == "__main__":
    test_dynamic_task_assignees_and_project_isolation()
