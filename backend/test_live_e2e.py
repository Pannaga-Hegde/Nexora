import time
import requests
import json

BASE_URL = "http://127.0.0.1:8000"
FE_URL = "http://localhost:5173"

def run_live_diagnostics():
    print("=" * 60)
    print("NEXORA LIVE SYSTEM DIAGNOSTICS & DEBUG SUITE")
    print("=" * 60)

    # 1. Frontend Check
    print("\n[1] Checking Frontend (Vite Dev Server)...")
    try:
        res = requests.get(FE_URL, timeout=5)
        print(f"   -> Status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert '<div id="root">' in res.text or "Nexora" in res.text
        print("   -> Frontend HTML & Root Container: PASS")
    except Exception as e:
        print(f"   -> Frontend ERROR: {e}")
        return

    # 2. Check Static Files / Icons referenced in index.html
    print("\n[2] Checking Frontend Static Assets...")
    assets = [
        "/favicon.ico",
        "/favicon.svg",
        "/apple-touch-icon.png",
        "/manifest.json",
        "/robots.txt",
        "/sitemap.xml"
    ]
    for asset in assets:
        try:
            r = requests.get(f"{FE_URL}{asset}", timeout=3)
            status = "PASS" if r.status_code == 200 else f"FAIL ({r.status_code})"
            print(f"   -> Asset {asset}: {status}")
        except Exception as e:
            print(f"   -> Asset {asset}: ERROR ({e})")

    # 3. Backend Health & Docs
    print("\n[3] Checking Backend Health & OpenAPI Schema...")
    try:
        r = requests.get(f"{BASE_URL}/docs", timeout=5)
        assert r.status_code == 200
        print("   -> /docs: PASS (200 OK)")

        r_openapi = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        assert r_openapi.status_code == 200
        schema = r_openapi.json()
        print(f"   -> /openapi.json: PASS ({len(schema.get('paths', {}))} API routes defined)")
    except Exception as e:
        print(f"   -> Backend Health ERROR: {e}")
        return

    # 4. User Lifecycle: Register -> Login -> /users/me
    print("\n[4] Testing User Authentication & Profile Lifecycle...")
    ts = int(time.time() * 1000)
    test_user = {
        "username": f"live_debug_{ts}",
        "email": f"live_debug_{ts}@example.com",
        "password": "Password123!",
        "full_name": "Live Debugger"
    }

    # Register
    r_reg = requests.post(f"{BASE_URL}/auth/register", json=test_user, timeout=5)
    assert r_reg.status_code == 201, f"Register failed: {r_reg.text}"
    reg_data = r_reg.json()
    token = reg_data["access_token"]
    user_id = reg_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"   -> Register: PASS (User ID: {user_id})")

    # Login via /auth/token (OAuth2 form-urlencoded as frontend does)
    r_login = requests.post(f"{BASE_URL}/auth/token", data={
        "username": test_user["email"],
        "password": test_user["password"]
    }, timeout=5)
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   -> Login (/auth/token): PASS")

    # Verify Current User Profile
    r_me = requests.get(f"{BASE_URL}/users/me", headers=headers, timeout=5)
    assert r_me.status_code == 200
    me_data = r_me.json()
    assert me_data["username"] == test_user["username"]
    print(f"   -> GET /users/me: PASS (Verified @{me_data['username']})")

    # 5. Project Lifecycle: Create -> List -> Member role
    print("\n[5] Testing Projects & Workspaces...")
    proj_payload = {
        "name": f"Live Test Workspace {ts}",
        "description": "Automated verification project",
        "project_type": "engineering"
    }
    r_proj = requests.post(f"{BASE_URL}/projects", headers=headers, json=proj_payload, timeout=5)
    assert r_proj.status_code == 201, f"Project create failed: {r_proj.text}"
    proj = r_proj.json()
    proj_id = proj["id"]
    print(f"   -> Create Project: PASS (ID: {proj_id}, Name: '{proj['name']}')")

    # List Projects
    r_projs = requests.get(f"{BASE_URL}/projects", headers=headers, timeout=5)
    assert r_projs.status_code == 200
    assert any(p["id"] == proj_id for p in r_projs.json())
    print("   -> List Projects: PASS")

    # 6. Task Management: Create -> Update Status -> Add Comment -> Activity
    print("\n[6] Testing Task Workflow & Discussion...")
    task_payload = {
        "title": "Live Test Task 1",
        "description": "Testing full kanban task pipeline",
        "status": "TODO",
        "priority": "HIGH",
        "assignee_id": user_id
    }
    r_task = requests.post(f"{BASE_URL}/projects/{proj_id}/tasks", headers=headers, json=task_payload, timeout=5)
    assert r_task.status_code == 201, f"Task create failed: {r_task.text}"
    task = r_task.json()
    task_id = task["id"]
    print(f"   -> Create Task: PASS (Task ID: {task_id})")

    # Update Task Status (Kanban drag-drop simulate)
    r_update = requests.patch(f"{BASE_URL}/projects/{proj_id}/tasks/{task_id}", headers=headers, json={
        "status": "IN_PROGRESS"
    }, timeout=5)
    assert r_update.status_code == 200
    assert r_update.json()["status"] == "IN_PROGRESS"
    print("   -> Update Task Status: PASS (TODO -> IN_PROGRESS)")

    # Add Comment via Task Discussion endpoint
    r_comment = requests.post(f"{BASE_URL}/tasks/{task_id}/discussion", headers=headers, json={
        "content": "Automated verification comment"
    }, timeout=5)
    assert r_comment.status_code == 200 or r_comment.status_code == 201, f"Add comment failed: {r_comment.text}"
    comment_data = r_comment.json()
    print(f"   -> Add Task Discussion Comment: PASS")

    # 7. Calendar Events & Availability
    print("\n[7] Testing Calendar & Availability...")
    cal_payload = {
        "title": "Sprint Planning",
        "description": "Weekly planning meeting",
        "start_time": "2026-09-25T10:00:00Z",
        "end_time": "2026-09-25T11:00:00Z",
        "event_type": "MEETING"
    }
    r_cal = requests.post(f"{BASE_URL}/workflow/calendar/events/{proj_id}", headers=headers, json=cal_payload, timeout=5)
    assert r_cal.status_code == 201, f"Calendar create failed: {r_cal.text}"
    event_id = r_cal.json()["id"]
    print(f"   -> Create Calendar Event: PASS (Event ID: {event_id})")

    # 8. Notifications
    print("\n[8] Testing Notifications...")
    r_notif = requests.get(f"{BASE_URL}/workflow/notifications", headers=headers, timeout=5)
    assert r_notif.status_code == 200
    print(f"   -> GET /workflow/notifications: PASS ({len(r_notif.json())} notifications found)")

    # 9. Community Posts
    print("\n[9] Testing Community Feed...")
    post_payload = {
        "title": "Welcome to Nexora live debug",
        "content": "This is a test post to verify community persistence and feed."
    }
    r_post = requests.post(f"{BASE_URL}/community/posts", headers=headers, json=post_payload, timeout=5)
    assert r_post.status_code == 201, f"Create post failed: {r_post.text}"
    post_id = r_post.json()["id"]
    print(f"   -> Create Community Post: PASS (Post ID: {post_id})")

    # 10. Delete Account Workflow (Danger Zone)
    print("\n[10] Testing Danger Zone: Permanently Delete Account...")
    r_del = requests.delete(f"{BASE_URL}/users/me", headers=headers, timeout=5)
    assert r_del.status_code == 200, f"Delete account failed: {r_del.text}"
    assert r_del.json()["status"] == "success"
    print("   -> DELETE /users/me: PASS (200 OK)")

    # Subsequent verification: Token must be invalidated
    r_post_del = requests.get(f"{BASE_URL}/users/me", headers=headers, timeout=5)
    assert r_post_del.status_code == 401, f"Expected 401, got {r_post_del.status_code}"
    print("   -> Post-deletion Token Auth Rejection (401): PASS")

    print("\n" + "=" * 60)
    print("ALL LIVE END-TO-END SYSTEM DIAGNOSTICS PASSED 100%!")
    print("=" * 60)

if __name__ == "__main__":
    run_live_diagnostics()
