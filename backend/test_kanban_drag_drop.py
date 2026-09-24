import time
import requests

BASE_URL = "http://localhost:8000"

# Register test user
timestamp = int(time.time() * 1000)
reg_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": f"kanban_user_{timestamp}",
    "email": f"kanban_{timestamp}@example.com",
    "password": "Password123!",
    "full_name": "Kanban Tester"
})
assert reg_res.status_code == 201, f"Reg failed: {reg_res.text}"
user_data = reg_res.json()
token = user_data["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Create test project
proj_res = requests.post(f"{BASE_URL}/projects", headers=headers, json={
    "name": f"Kanban DND Test Project {timestamp}",
    "description": "Testing Kanban drag and drop status transitions",
    "project_type": "SOFTWARE"
})
assert proj_res.status_code == 201, f"Project creation failed: {proj_res.text}"
project_id = proj_res.json()["id"]

# Create task in TODO status
create_res = requests.post(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers, json={
    "title": "Drag Drop Status Workflow Task",
    "description": "Testing status moves",
    "status": "TODO",
    "priority": "HIGH"
})
assert create_res.status_code == 201, f"Create task failed: {create_res.text}"
task = create_res.json()
task_id = task["id"]
assert task["status"] == "TODO"
print("PASS: Initial task created with status TODO")

# TEST 1: Move TODO -> IN_PROGRESS
p1_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={
    "status": "IN_PROGRESS"
})
assert p1_res.status_code == 200, f"Move to IN_PROGRESS failed: {p1_res.text}"
assert p1_res.json()["status"] == "IN_PROGRESS"
print("PASS: Task moved TODO -> IN_PROGRESS successfully")

# TEST 2: Move IN_PROGRESS -> IN_REVIEW
p2_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={
    "status": "IN_REVIEW"
})
assert p2_res.status_code == 200, f"Move to IN_REVIEW failed: {p2_res.text}"
assert p2_res.json()["status"] == "IN_REVIEW"
print("PASS: Task moved IN_PROGRESS -> IN_REVIEW successfully")

# TEST 3: Move IN_REVIEW -> DONE
p3_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={
    "status": "DONE"
})
assert p3_res.status_code == 200, f"Move to DONE failed: {p3_res.text}"
assert p3_res.json()["status"] == "DONE"
print("PASS: Task moved IN_REVIEW -> DONE successfully")

# TEST 4: Verify persistence in PostgreSQL
get_res = requests.get(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers)
assert get_res.status_code == 200
tasks = get_res.json()
persisted_task = next((t for t in tasks if t["id"] == task_id), None)
assert persisted_task is not None
assert persisted_task["status"] == "DONE"
print("PASS: Verified final status DONE persisted in PostgreSQL")

# TEST 5: Unauthorized move rejection (Non-member)
reg_hacker = requests.post(f"{BASE_URL}/auth/register", json={
    "username": f"hacker_{timestamp}",
    "email": f"hacker_{timestamp}@example.com",
    "password": "Password123!",
    "full_name": "Non Member"
})
hacker_token = reg_hacker.json()["access_token"]
hacker_headers = {"Authorization": f"Bearer {hacker_token}", "Content-Type": "application/json"}

unauth_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=hacker_headers, json={
    "status": "TODO"
})
assert unauth_res.status_code == 403, f"Expected 403 Forbidden, got {unauth_res.status_code}"
print("PASS: Unauthorized user status change correctly rejected with 403 Forbidden")

print("\nALL KANBAN DRAG & DROP STATUS BACKEND TESTS PASSED PERFECTLY!\n")
