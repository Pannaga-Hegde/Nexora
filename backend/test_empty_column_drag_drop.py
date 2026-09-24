import time
import requests

BASE_URL = "http://localhost:8000"

timestamp = int(time.time() * 1000)
reg_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": f"empty_col_user_{timestamp}",
    "email": f"empty_col_{timestamp}@example.com",
    "password": "Password123!",
    "full_name": "Empty Column Tester"
})
assert reg_res.status_code == 201, f"Reg failed: {reg_res.text}"
token = reg_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Create test project
proj_res = requests.post(f"{BASE_URL}/projects", headers=headers, json={
    "name": f"Empty Column Test Project {timestamp}",
    "description": "Testing empty column drops",
    "project_type": "FINAL_YEAR"
})
assert proj_res.status_code == 201, f"Project creation failed: {proj_res.text}"
project_id = proj_res.json()["id"]

# Create 1 task in TODO; all other columns (IN_PROGRESS, IN_REVIEW, BLOCKED, DONE) are empty
t_res = requests.post(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers, json={
    "title": "Solo Task for Empty Column Testing",
    "description": "Will be moved across all empty columns",
    "status": "TODO",
    "priority": "HIGH"
})
assert t_res.status_code == 201
task_id = t_res.json()["id"]

# 1. TODO -> empty IN_PROGRESS
p1 = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={"status": "IN_PROGRESS"})
assert p1.status_code == 200
assert p1.json()["status"] == "IN_PROGRESS"
print("PASS: TODO -> empty IN_PROGRESS")

# 2. IN_PROGRESS -> empty IN_REVIEW
p2 = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={"status": "IN_REVIEW"})
assert p2.status_code == 200
assert p2.json()["status"] == "IN_REVIEW"
print("PASS: IN_PROGRESS -> empty IN_REVIEW")

# 3. IN_REVIEW -> empty BLOCKED
p3 = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={"status": "BLOCKED"})
assert p3.status_code == 200
assert p3.json()["status"] == "BLOCKED"
print("PASS: IN_REVIEW -> empty BLOCKED")

# 4. BLOCKED -> empty DONE
p4 = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={"status": "DONE"})
assert p4.status_code == 200
assert p4.json()["status"] == "DONE"
print("PASS: BLOCKED -> empty DONE")

# 5. DONE -> empty TODO
p5 = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={"status": "TODO"})
assert p5.status_code == 200
assert p5.json()["status"] == "TODO"
print("PASS: DONE -> empty TODO")

# Verify final persisted state
get_res = requests.get(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers)
assert get_res.status_code == 200
tasks = get_res.json()
assert tasks[0]["status"] == "TODO"
print("PASS: Final status persisted in PostgreSQL")

print("\nALL EMPTY COLUMN DRAG & DROP BACKEND TESTS PASSED PERFECTLY!\n")
