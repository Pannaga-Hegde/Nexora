import time
import requests
import uuid

BASE_URL = "http://localhost:8000"

def test_delete_account():
    print("=" * 60)
    print("TESTING DELETE ACCOUNT WORKFLOW")
    print("=" * 60)

    # 1. Register a test user
    ts = int(time.time() * 1000)
    test_user = {
        "username": f"del_user_{ts}",
        "email": f"del_{ts}@example.com",
        "password": "Password123!",
        "full_name": "Delete Me Tester"
    }

    reg_res = requests.post(f"{BASE_URL}/auth/register", json=test_user)
    assert reg_res.status_code == 201, f"Failed to register user: {reg_res.text}"
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"PASS: User created ({test_user['username']}, ID: {user_id})")

    # 2. Verify /users/me returns 200
    me_res = requests.get(f"{BASE_URL}/users/me", headers=headers)
    assert me_res.status_code == 200, f"Expected 200, got {me_res.status_code}"
    print("PASS: Verified user is authenticated")

    # 3. Create a project with this user
    proj_res = requests.post(f"{BASE_URL}/projects", headers=headers, json={
        "name": f"Project for {test_user['username']}",
        "description": "Will test deletion cascade",
        "project_type": "custom"
    })
    assert proj_res.status_code == 201, f"Failed to create project: {proj_res.text}"
    proj_id = proj_res.json()["id"]
    print(f"PASS: User created project (ID: {proj_id})")

    # 4. Create a task in the project
    task_res = requests.post(f"{BASE_URL}/projects/{proj_id}/tasks", headers=headers, json={
        "title": "Task assigned to user",
        "status": "TODO",
        "priority": "HIGH",
        "assignee_id": user_id
    })
    assert task_res.status_code == 201, f"Failed to create task: {task_res.text}"
    task_id = task_res.json()["id"]
    print(f"PASS: Task created and assigned to user (ID: {task_id})")

    # 5. Call DELETE /users/me
    del_res = requests.delete(f"{BASE_URL}/users/me", headers=headers)
    assert del_res.status_code == 200, f"Expected 200, got {del_res.status_code}: {del_res.text}"
    assert del_res.json()["status"] == "success"
    print("PASS: DELETE /users/me returned 200 OK with success message")

    # 6. Verify previous token is now rejected (401 User not found)
    post_del_res = requests.get(f"{BASE_URL}/users/me", headers=headers)
    assert post_del_res.status_code == 401, f"Expected 401, got {post_del_res.status_code}"
    print("PASS: Subsequent authenticated requests with token are rejected (401)")

    # 7. Verify task assignee was safely nullified
    from app.database import SessionLocal
    from app.models import Task, User
    db = SessionLocal()
    try:
        t = db.get(Task, uuid.UUID(task_id))
        assert t is not None, "Task should still exist"
        assert t.assignee_id is None, "Task assignee_id should be None"
        print("PASS: Task remains intact with assignee_id safely nullified")

        u = db.get(User, uuid.UUID(user_id))
        assert u is None, "User should be completely deleted from database"
        print("PASS: User record completely purged from database")
    finally:
        db.close()

    print("=" * 60)
    print("ALL DELETE ACCOUNT TESTS PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_delete_account()
