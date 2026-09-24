import time
import requests
import uuid

BASE_URL = "http://localhost:8000"

# Register a test user
timestamp = int(time.time() * 1000)
reg_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": f"duedate_user_{timestamp}",
    "email": f"duedate_user_{timestamp}@example.com",
    "password": "Password123!",
    "full_name": "Due Date Tester"
})
assert reg_res.status_code == 201, f"Reg failed: {reg_res.text}"
user_data = reg_res.json()
token = user_data["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Create a test project
proj_res = requests.post(f"{BASE_URL}/projects", headers=headers, json={
    "name": f"Due Date Test Project {timestamp}",
    "description": "Testing Create Task Due Date",
    "project_type": "FINAL_YEAR"
})
assert proj_res.status_code == 201, f"Project creation failed: {proj_res.text}"
project_id = proj_res.json()["id"]

# TEST 1: Create task WITHOUT due date
res_no_due = requests.post(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers, json={
    "title": "Task without due date",
    "description": "No due date specified",
    "status": "TODO",
    "priority": "MEDIUM"
})
assert res_no_due.status_code == 201, f"Create task failed: {res_no_due.text}"
task_no_due = res_no_due.json()
assert task_no_due["due_date"] is None, f"Expected None due_date, got {task_no_due['due_date']}"
print("PASS: Create task without due date (due_date is None)")

# TEST 2: Create task WITH due date
test_due_date = "2026-10-15T00:00:00"
res_with_due = requests.post(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers, json={
    "title": "Task with due date",
    "description": "Oct 15 deadline",
    "status": "TODO",
    "priority": "HIGH",
    "due_date": test_due_date
})
assert res_with_due.status_code == 201, f"Create task with due date failed: {res_with_due.text}"
task_with_due = res_with_due.json()
assert task_with_due["due_date"] is not None
assert task_with_due["due_date"].startswith("2026-10-15"), f"Expected date starting 2026-10-15, got {task_with_due['due_date']}"
task_id = task_with_due["id"]
print(f"PASS: Create task with due date ({task_with_due['due_date']})")

# TEST 3: Verify task in GET /projects/{project_id}/tasks
get_tasks_res = requests.get(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers)
assert get_tasks_res.status_code == 200
tasks_list = get_tasks_res.json()
found_task = next((t for t in tasks_list if t["id"] == task_id), None)
assert found_task is not None, "Task not found in tasks list"
assert found_task["due_date"].startswith("2026-10-15"), f"Expected 2026-10-15, got {found_task['due_date']}"
print("PASS: Task list contains task with persisted due date")

# TEST 4: Update task due date via PATCH
new_due_date = "2026-11-20T00:00:00"
patch_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={
    "due_date": new_due_date
})
assert patch_res.status_code == 200, f"Patch failed: {patch_res.text}"
patched_task = patch_res.json()
assert patched_task["due_date"].startswith("2026-11-20"), f"Expected 2026-11-20, got {patched_task['due_date']}"
print("PASS: Update task due date via PATCH")

# TEST 5: Clear task due date via PATCH (null)
clear_res = requests.patch(f"{BASE_URL}/projects/{project_id}/tasks/{task_id}", headers=headers, json={
    "due_date": None
})
assert clear_res.status_code == 200, f"Clear due date failed: {clear_res.text}"
cleared_task = clear_res.json()
assert cleared_task["due_date"] is None, f"Expected None after clearing, got {cleared_task['due_date']}"
print("PASS: Clear task due date via PATCH (due_date is None)")

# TEST 6: Risk endpoint with due date
# Re-set due date and test risk evaluation endpoint
res_due_overdue = requests.post(f"{BASE_URL}/projects/{project_id}/tasks", headers=headers, json={
    "title": "Overdue task",
    "description": "Past date",
    "status": "TODO",
    "priority": "CRITICAL",
    "due_date": "2025-01-01T00:00:00"
})
assert res_due_overdue.status_code == 201
overdue_task_id = res_due_overdue.json()["id"]

risk_res = requests.get(f"{BASE_URL}/projects/{project_id}/tasks/{overdue_task_id}/risk", headers=headers)
assert risk_res.status_code == 200, f"Risk query failed: {risk_res.text}"
risk_data = risk_res.json()
assert "risk" in risk_data
print(f"PASS: Task risk evaluation works with due date (Risk: {risk_data['risk'].get('level', risk_data['risk'].get('score'))})")

print("\nALL CREATE TASK DUE DATE BACKEND TESTS PASSED PERFECTLY!\n")
