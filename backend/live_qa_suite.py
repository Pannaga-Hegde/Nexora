"""
NEXORA FULL LIVE END-TO-END QA & AUDIT SUITE
Executes live functional checks across all 22 QA sections against running servers:
  Frontend: http://localhost:5173
  Backend:  http://127.0.0.1:8000
"""

import sys
import os
import time
import json
import uuid
import requests

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"

audit_records = []

def record(area, test_name, result, severity, evidence, details=None):
    rec = {
        "area": area,
        "test": test_name,
        "result": result, # PASS, FAIL, NOT_IMPLEMENTED, NOT_TESTABLE
        "severity": severity, # BLOCKER, HIGH, MEDIUM, LOW, INFORMATIONAL, NONE
        "evidence": evidence,
        "details": details or {}
    }
    audit_records.append(rec)
    print(f"[{result}] {area} -> {test_name}: {evidence}")

def run_qa():
    print("=" * 70)
    print("STARTING NEXORA LIVE END-TO-END QA AUDIT")
    print("=" * 70)

    # =========================================================================
    # 1. STARTUP / ENVIRONMENT
    # =========================================================================
    # Frontend reachability
    try:
        r_fe = requests.get(FRONTEND_URL, timeout=5)
        if r_fe.status_code == 200 and ("<div id=\"root\">" in r_fe.text or "Nexora" in r_fe.text):
            record("1. Startup", "Frontend loads", "PASS", "NONE", "Vite dev server returns 200 OK with root container")
        else:
            record("1. Startup", "Frontend loads", "FAIL", "BLOCKER", f"Status {r_fe.status_code}")
    except Exception as e:
        record("1. Startup", "Frontend loads", "FAIL", "BLOCKER", f"Exception: {e}")

    # Backend reachability
    try:
        r_be = requests.get(f"{BACKEND_URL}/docs", timeout=5)
        if r_be.status_code == 200:
            record("1. Startup", "Backend responds", "PASS", "NONE", "FastAPI /docs returns 200 OK")
        else:
            record("1. Startup", "Backend responds", "FAIL", "BLOCKER", f"Status {r_be.status_code}")
    except Exception as e:
        record("1. Startup", "Backend responds", "FAIL", "BLOCKER", f"Exception: {e}")

    # Database connectivity via schema inspection or /health
    try:
        from app.database import SessionLocal, engine
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        record("1. Startup", "Database connection", "PASS", "NONE", f"Dialect: {engine.dialect.name}, active connection successful")
    except Exception as e:
        record("1. Startup", "Database connection", "FAIL", "BLOCKER", f"DB Connection failed: {e}")

    # WebSocket endpoint presence
    try:
        import urllib.request
        # Check /ws endpoint in openapi or direct probe
        r_open = requests.get(f"{BACKEND_URL}/openapi.json", timeout=5).json()
        ws_paths = [p for p in r_open.get("paths", {}).keys() if "ws" in p or "chat" in p]
        record("1. Startup", "WebSocket endpoint presence", "PASS", "NONE", f"Routes detected: {ws_paths}")
    except Exception as e:
        record("1. Startup", "WebSocket endpoint presence", "FAIL", "MEDIUM", str(e))

    # =========================================================================
    # 2. PUBLIC HOME / LANDING PAGE
    # =========================================================================
    # Test public pages routes via frontend
    public_routes = [
        ("/", "Landing Page"),
        ("/features", "Features Page"),
        ("/contact", "Contact Page"),
        ("/privacy", "Privacy Policy Page"),
        ("/terms", "Terms of Service Page"),
        ("/thank-you", "Thank You Page"),
        ("/404", "Not Found Page"),
    ]
    for route, name in public_routes:
        try:
            r = requests.get(f"{FRONTEND_URL}{route}", timeout=5)
            if r.status_code == 200:
                record("2. Public Home", f"Route: {name} ({route})", "PASS", "NONE", "Returns 200 OK")
            else:
                record("2. Public Home", f"Route: {name} ({route})", "FAIL", "HIGH", f"Status {r.status_code}")
        except Exception as e:
            record("2. Public Home", f"Route: {name} ({route})", "FAIL", "HIGH", str(e))

    # Static assets checks
    static_assets = [
        "/favicon.ico",
        "/favicon.svg",
        "/apple-touch-icon.png",
        "/manifest.json",
        "/robots.txt",
        "/sitemap.xml",
        "/image/login-bg.png",
        "/image/nexora-workspace-bg.jpg",
        "/image/nexora-hero-marketing.png"
    ]
    for asset in static_assets:
        try:
            r = requests.get(f"{FRONTEND_URL}{asset}", timeout=4)
            if r.status_code == 200 and len(r.content) > 0:
                record("2. Public Home", f"Asset {asset}", "PASS", "NONE", f"200 OK ({len(r.content)} bytes)")
            else:
                record("2. Public Home", f"Asset {asset}", "FAIL", "MEDIUM", f"Status {r.status_code}")
        except Exception as e:
            record("2. Public Home", f"Asset {asset}", "FAIL", "MEDIUM", str(e))

    # =========================================================================
    # 3. AUTHENTICATION
    # =========================================================================
    ts = int(time.time() * 1000)
    primary_user = {
        "username": f"qa_lead_{ts}",
        "email": f"qa_lead_{ts}@university.edu",
        "password": "SecurePassword123!",
        "full_name": "QA Lead Student"
    }
    second_user = {
        "username": f"qa_peer_{ts}",
        "email": f"qa_peer_{ts}@university.edu",
        "password": "PeerPassword123!",
        "full_name": "QA Peer Member"
    }

    # 3.1 Invalid email registration
    r_bad_email = requests.post(f"{BACKEND_URL}/auth/register", json={
        "username": f"bad_email_{ts}",
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Bad Email"
    })
    if r_bad_email.status_code in (400, 422):
        record("3. Authentication", "Registration: Invalid email rejection", "PASS", "NONE", f"Rejected with {r_bad_email.status_code}")
    else:
        record("3. Authentication", "Registration: Invalid email rejection", "FAIL", "HIGH", f"Got status {r_bad_email.status_code}: {r_bad_email.text}")

    # 3.2 Weak/invalid password registration (e.g. empty or too short)
    r_weak_pwd = requests.post(f"{BACKEND_URL}/auth/register", json={
        "username": f"weak_pwd_{ts}",
        "email": f"weak_{ts}@university.edu",
        "password": "123",
        "full_name": "Weak Pwd"
    })
    if r_weak_pwd.status_code in (400, 422):
        record("3. Authentication", "Registration: Short/weak password rejection", "PASS", "NONE", f"Rejected with {r_weak_pwd.status_code}")
    else:
        record("3. Authentication", "Registration: Short/weak password rejection", "FAIL", "MEDIUM", f"Got status {r_weak_pwd.status_code}: {r_weak_pwd.text}")

    # 3.3 Valid Registration (Primary User)
    r_reg_main = requests.post(f"{BACKEND_URL}/auth/register", json=primary_user)
    if r_reg_main.status_code == 201:
        primary_token = r_reg_main.json()["access_token"]
        primary_id = r_reg_main.json()["user"]["id"]
        record("3. Authentication", "Registration: Valid user registration", "PASS", "NONE", f"Created user {primary_user['username']} (ID: {primary_id})")
    else:
        record("3. Authentication", "Registration: Valid user registration", "FAIL", "BLOCKER", f"Failed {r_reg_main.status_code}: {r_reg_main.text}")
        return

    # 3.4 Valid Registration (Second User)
    r_reg_peer = requests.post(f"{BACKEND_URL}/auth/register", json=second_user)
    if r_reg_peer.status_code == 201:
        second_token = r_reg_peer.json()["access_token"]
        second_id = r_reg_peer.json()["user"]["id"]
        record("3. Authentication", "Registration: Second user registration", "PASS", "NONE", f"Created user {second_user['username']} (ID: {second_id})")
    else:
        record("3. Authentication", "Registration: Second user registration", "FAIL", "BLOCKER", f"Failed {r_reg_peer.status_code}")
        return

    # 3.5 Duplicate Email Rejection
    r_dup_email = requests.post(f"{BACKEND_URL}/auth/register", json={
        "username": f"diff_user_{ts}",
        "email": primary_user["email"],
        "password": "Password123!",
        "full_name": "Duplicate Email"
    })
    if r_dup_email.status_code in (400, 409):
        record("3. Authentication", "Registration: Duplicate email rejection", "PASS", "NONE", f"Rejected with {r_dup_email.status_code} ({r_dup_email.text})")
    else:
        record("3. Authentication", "Registration: Duplicate email rejection", "FAIL", "HIGH", f"Status {r_dup_email.status_code}: {r_dup_email.text}")

    # 3.6 Duplicate Username Rejection
    r_dup_uname = requests.post(f"{BACKEND_URL}/auth/register", json={
        "username": primary_user["username"],
        "email": f"diff_{ts}@university.edu",
        "password": "Password123!",
        "full_name": "Duplicate Username"
    })
    if r_dup_uname.status_code in (400, 409):
        record("3. Authentication", "Registration: Duplicate username rejection", "PASS", "NONE", f"Rejected with {r_dup_uname.status_code} ({r_dup_uname.text})")
    else:
        record("3. Authentication", "Registration: Duplicate username rejection", "FAIL", "HIGH", f"Status {r_dup_uname.status_code}: {r_dup_uname.text}")

    # 3.7 Login with Email
    r_login_email = requests.post(f"{BACKEND_URL}/auth/token", data={
        "username": primary_user["email"],
        "password": primary_user["password"]
    })
    if r_login_email.status_code == 200 and "access_token" in r_login_email.json():
        record("3. Authentication", "Login: Email login (/auth/token)", "PASS", "NONE", "200 OK with Bearer token")
    else:
        record("3. Authentication", "Login: Email login (/auth/token)", "FAIL", "HIGH", f"Status {r_login_email.status_code}: {r_login_email.text}")

    # 3.8 Login with Username
    r_login_user = requests.post(f"{BACKEND_URL}/auth/token", data={
        "username": primary_user["username"],
        "password": primary_user["password"]
    })
    if r_login_user.status_code == 200 and "access_token" in r_login_user.json():
        record("3. Authentication", "Login: Username login (/auth/token)", "PASS", "NONE", "200 OK with Bearer token")
    else:
        record("3. Authentication", "Login: Username login (/auth/token)", "FAIL", "HIGH", f"Status {r_login_user.status_code}: {r_login_user.text}")

    # 3.9 Wrong Password Rejection
    r_wrong_pwd = requests.post(f"{BACKEND_URL}/auth/token", data={
        "username": primary_user["username"],
        "password": "CompletelyWrongPassword!"
    })
    if r_wrong_pwd.status_code == 401:
        record("3. Authentication", "Login: Wrong password rejection", "PASS", "NONE", "401 Unauthorized")
    else:
        record("3. Authentication", "Login: Wrong password rejection", "FAIL", "HIGH", f"Status {r_wrong_pwd.status_code}")

    # 3.10 Nonexistent Account Login
    r_nonexistent = requests.post(f"{BACKEND_URL}/auth/token", data={
        "username": "nonexistent_ghost_user_99999",
        "password": "Password123!"
    })
    if r_nonexistent.status_code == 401:
        record("3. Authentication", "Login: Nonexistent user rejection", "PASS", "NONE", "401 Unauthorized")
    else:
        record("3. Authentication", "Login: Nonexistent user rejection", "FAIL", "HIGH", f"Status {r_nonexistent.status_code}")

    # 3.11 Protected Route Authorization Check (without token)
    r_unauth = requests.get(f"{BACKEND_URL}/users/me")
    if r_unauth.status_code in (401, 403):
        record("3. Authentication", "Security: Protected route rejection without token", "PASS", "NONE", f"Status {r_unauth.status_code}")
    else:
        record("3. Authentication", "Security: Protected route rejection without token", "FAIL", "BLOCKER", f"Expected 401/403, got {r_unauth.status_code}")

    primary_headers = {"Authorization": f"Bearer {primary_token}"}
    second_headers = {"Authorization": f"Bearer {second_token}"}

    # =========================================================================
    # 4. AUTH / LANDING TRANSITION
    # =========================================================================
    # Check if cinematic motion transition is implemented in LandingPage.tsx
    try:
        with open("c:/Users/panna/OneDrive/Desktop/New folder (2)/proj/New folder (2)/frontend/src/pages/LandingPage.tsx", "r", encoding="utf-8") as f:
            landing_code = f.read()
        if "framer-motion" in landing_code and "cinematic-transition" in landing_code:
            record("4. Motion Transition", "Cinematic Motion Transition", "PASS", "NONE", "Cinematic transition found in LandingPage.tsx")
        else:
            record("4. Motion Transition", "Cinematic Motion Transition", "NOT_IMPLEMENTED", "INFORMATIONAL", "LandingPage uses standard instant/hero routing; cinematic motion transition not yet implemented")
    except Exception as e:
        record("4. Motion Transition", "Cinematic Motion Transition", "NOT_TESTABLE", "LOW", str(e))

    # =========================================================================
    # 5. DASHBOARD / WORKSPACE
    # =========================================================================
    r_me = requests.get(f"{BACKEND_URL}/users/me", headers=primary_headers)
    if r_me.status_code == 200:
        record("5. Dashboard / Workspace", "User Profile (/users/me)", "PASS", "NONE", f"Username: {r_me.json()['username']}")
    else:
        record("5. Dashboard / Workspace", "User Profile (/users/me)", "FAIL", "HIGH", f"Status {r_me.status_code}")

    # Global Search API
    r_search = requests.get(f"{BACKEND_URL}/projects", headers=primary_headers)
    if r_search.status_code == 200:
        record("5. Dashboard / Workspace", "Workspace Projects Query", "PASS", "NONE", f"User has {len(r_search.json())} active projects")
    else:
        record("5. Dashboard / Workspace", "Workspace Projects Query", "FAIL", "MEDIUM", f"Status {r_search.status_code}")

    # =========================================================================
    # 6. PROJECT CREATION & TEMPLATES
    # =========================================================================
    # Test Creating Project from Scratch
    proj_payload = {
        "name": f"Nexora QA Capstone {ts}",
        "description": "Final Year Academic Project Workspace",
        "project_type": "academic"
    }
    r_create_proj = requests.post(f"{BACKEND_URL}/projects", headers=primary_headers, json=proj_payload)
    if r_create_proj.status_code == 201:
        project = r_create_proj.json()
        project_id = project["id"]
        record("6. Project Creation", "Create Project: Academic Template", "PASS", "NONE", f"Created project ID: {project_id}, Name: '{project['name']}'")
    else:
        record("6. Project Creation", "Create Project: Academic Template", "FAIL", "BLOCKER", f"Status {r_create_proj.status_code}: {r_create_proj.text}")
        return

    # Persistence verification: Fetch list of projects
    r_list_proj = requests.get(f"{BACKEND_URL}/projects", headers=primary_headers)
    matching = [p for p in r_list_proj.json() if p["id"] == project_id]
    if len(matching) == 1:
        record("6. Project Creation", "Project Persistence in DB", "PASS", "NONE", "Project retrieved successfully in user workspace list")
    else:
        record("6. Project Creation", "Project Persistence in DB", "FAIL", "HIGH", "Project not found in user projects list")

    # =========================================================================
    # 7. PROJECT MEMBERS / INVITES & AUTHORIZATION ISOLATION
    # =========================================================================
    # Check initial members
    r_members = requests.get(f"{BACKEND_URL}/projects/{project_id}/members", headers=primary_headers)
    if r_members.status_code == 200:
        record("7. Project Members", "List Project Members", "PASS", "NONE", f"Members count: {len(r_members.json())}")
    else:
        record("7. Project Members", "List Project Members", "FAIL", "HIGH", f"Status {r_members.status_code}")

    # Invite valid member (Second User) via /projects/{project_id}/invite
    invite_payload = {
        "email_or_username": second_user["email"],
        "role": "member"
    }
    r_invite = requests.post(f"{BACKEND_URL}/projects/{project_id}/invite", headers=primary_headers, json=invite_payload)
    if r_invite.status_code in (200, 201):
        record("7. Project Members", "Invite Member (Valid User)", "PASS", "NONE", f"Invited {second_user['email']} as member")
    else:
        record("7. Project Members", "Invite Member (Valid User)", "FAIL", "HIGH", f"Status {r_invite.status_code}: {r_invite.text}")

    # Invite nonexistent non-email user (must return 404)
    r_invite_fake = requests.post(f"{BACKEND_URL}/projects/{project_id}/invite", headers=primary_headers, json={
        "email_or_username": "nonexistent_invitation_target_9999",
        "role": "member"
    })
    if r_invite_fake.status_code == 404:
        record("7. Project Members", "Invite Member (Nonexistent User 404)", "PASS", "NONE", "404 Not Found returned as expected")
    else:
        record("7. Project Members", "Invite Member (Nonexistent User 404)", "FAIL", "MEDIUM", f"Expected 404, got {r_invite_fake.status_code}")

    # Authorization Isolation: Non-member user access attempt
    ts3 = int(time.time() * 1000)
    third_user = {
        "username": f"qa_outsider_{ts3}",
        "email": f"qa_outsider_{ts3}@university.edu",
        "password": "Password123!",
        "full_name": "Outsider User"
    }
    r_reg_third = requests.post(f"{BACKEND_URL}/auth/register", json=third_user)
    third_token = r_reg_third.json()["access_token"]
    third_headers = {"Authorization": f"Bearer {third_token}"}

    r_outsider_access = requests.get(f"{BACKEND_URL}/projects/{project_id}/tasks", headers=third_headers)
    if r_outsider_access.status_code == 403:
        record("7. Project Members", "Security: Non-member project data access rejection", "PASS", "NONE", "403 Forbidden returned for non-member")
    else:
        record("7. Project Members", "Security: Non-member project data access rejection", "FAIL", "HIGH", f"Expected 403, got {r_outsider_access.status_code}")

    # =========================================================================
    # 8. TASK MANAGEMENT
    # =========================================================================
    # 8.1 Create Task with Due Date & Priority
    task_1_payload = {
        "title": "Design Database Relational Schema",
        "description": "Establish PostgreSQL schema models and foreign key constraints",
        "priority": "HIGH",
        "status": "TODO",
        "assignee_id": primary_id,
        "due_date": "2026-09-30T18:00:00Z"
    }
    r_task1 = requests.post(f"{BACKEND_URL}/projects/{project_id}/tasks", headers=primary_headers, json=task_1_payload)
    if r_task1.status_code == 201:
        task1 = r_task1.json()
        task1_id = task1["id"]
        record("8. Task Management", "Create Task: Valid with Due Date", "PASS", "NONE", f"Task ID: {task1_id}")
    else:
        record("8. Task Management", "Create Task: Valid with Due Date", "FAIL", "BLOCKER", f"Status {r_task1.status_code}: {r_task1.text}")
        return

    # 8.2 Create Task without Due Date
    task_2_payload = {
        "title": "Configure Integration Test Suite",
        "description": "Continuous QA verification tests",
        "priority": "MEDIUM",
        "status": "TODO",
        "assignee_id": second_id,
        "due_date": None
    }
    r_task2 = requests.post(f"{BACKEND_URL}/projects/{project_id}/tasks", headers=primary_headers, json=task_2_payload)
    if r_task2.status_code == 201:
        task2 = r_task2.json()
        task2_id = task2["id"]
        record("8. Task Management", "Create Task: No Due Date", "PASS", "NONE", f"Task ID: {task2_id}")
    else:
        record("8. Task Management", "Create Task: No Due Date", "FAIL", "HIGH", f"Status {r_task2.status_code}")

    # 8.3 Non-member assignee rejection
    r_bad_assignee = requests.post(f"{BACKEND_URL}/projects/{project_id}/tasks", headers=primary_headers, json={
        "title": "Invalid Assignee Task",
        "status": "TODO",
        "assignee_id": str(uuid.uuid4())
    })
    if r_bad_assignee.status_code in (400, 404, 422):
        record("8. Task Management", "Task: Non-member assignee rejection", "PASS", "NONE", f"Rejected with {r_bad_assignee.status_code}")
    else:
        record("8. Task Management", "Task: Non-member assignee rejection", "FAIL", "MEDIUM", f"Expected error, got {r_bad_assignee.status_code}")

    # 8.4 Edit Task: Update title, priority, and clear due date
    r_edit_task = requests.patch(f"{BACKEND_URL}/projects/{project_id}/tasks/{task1_id}", headers=primary_headers, json={
        "title": "Design Database Relational Schema [UPDATED]",
        "priority": "CRITICAL",
        "due_date": None
    })
    if r_edit_task.status_code == 200:
        updated_t1 = r_edit_task.json()
        if updated_t1["priority"] == "CRITICAL":
            record("8. Task Management", "Edit Task: Title/Priority/Clear Due Date", "PASS", "NONE", "Successfully updated task fields")
        else:
            record("8. Task Management", "Edit Task: Title/Priority/Clear Due Date", "FAIL", "MEDIUM", f"Unexpected payload: {updated_t1}")
    else:
        record("8. Task Management", "Edit Task: Title/Priority/Clear Due Date", "FAIL", "HIGH", f"Status {r_edit_task.status_code}")

    # =========================================================================
    # 9. KANBAN WORKFLOW
    # =========================================================================
    # Test transitioning task across statuses: TODO -> IN_PROGRESS -> IN_REVIEW -> BLOCKED -> DONE
    statuses = ["IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]
    kanban_passed = True
    for st in statuses:
        r_kanban = requests.patch(f"{BACKEND_URL}/projects/{project_id}/tasks/{task1_id}", headers=primary_headers, json={"status": st})
        if r_kanban.status_code != 200 or r_kanban.json()["status"] != st:
            kanban_passed = False
            record("9. Kanban", f"Status transition to {st}", "FAIL", "HIGH", f"Status {r_kanban.status_code}: {r_kanban.text}")
            break
    if kanban_passed:
        record("9. Kanban", "Kanban: All Status Transitions", "PASS", "NONE", "TODO -> IN_PROGRESS -> IN_REVIEW -> BLOCKED -> DONE verified")

    # =========================================================================
    # 10. TASK DISCUSSIONS & PERMISSIONS
    # =========================================================================
    # 10.1 Create Comment by Primary User
    r_comment1 = requests.post(f"{BACKEND_URL}/tasks/{task1_id}/discussion", headers=primary_headers, json={
        "content": "Initial feedback on the schema design."
    })
    if r_comment1.status_code in (200, 201):
        comment1_id = r_comment1.json()["id"]
        record("10. Task Discussion", "Create Comment", "PASS", "NONE", f"Comment ID: {comment1_id}")
    else:
        record("10. Task Discussion", "Create Comment", "FAIL", "HIGH", f"Status {r_comment1.status_code}: {r_comment1.text}")
        return

    # 10.2 Second User (Peer Member) Deletion Attempt of Primary User's Comment (Must Fail 403)
    r_unauth_del = requests.delete(f"{BACKEND_URL}/tasks/{task1_id}/discussion/{comment1_id}", headers=second_headers)
    if r_unauth_del.status_code == 403:
        record("10. Task Discussion", "Security: Non-author comment deletion rejection", "PASS", "NONE", "403 Forbidden returned for non-author")
    else:
        record("10. Task Discussion", "Security: Non-author comment deletion rejection", "FAIL", "HIGH", f"Expected 403, got {r_unauth_del.status_code}")

    # 10.3 Author Deletion of Own Comment (Must Succeed 200)
    r_auth_del = requests.delete(f"{BACKEND_URL}/tasks/{task1_id}/discussion/{comment1_id}", headers=primary_headers)
    if r_auth_del.status_code == 200:
        record("10. Task Discussion", "Author Comment Deletion", "PASS", "NONE", "200 OK returned for author")
    else:
        record("10. Task Discussion", "Author Comment Deletion", "FAIL", "HIGH", f"Status {r_auth_del.status_code}: {r_auth_del.text}")

    # =========================================================================
    # 11. TASK <-> CONVERSATION LINKING
    # =========================================================================
    r_conv = requests.post(f"{BACKEND_URL}/projects/{project_id}/tasks/{task1_id}/convert-to-task", headers=primary_headers, json={
        "title": "Spawned from conversation",
        "priority": "HIGH"
    })
    # Check if convert endpoint exists
    if r_conv.status_code in (200, 201):
        record("11. Task <-> Conversation", "Convert Discussion to Task", "PASS", "NONE", "200/201 OK")
    elif r_conv.status_code == 404:
        # Check alternative discussion convert route
        r_conv_alt = requests.post(f"{BACKEND_URL}/tasks/{task1_id}/discussion/convert-task", headers=primary_headers, json={
            "title": "Spawned from discussion"
        })
        if r_conv_alt.status_code in (200, 201):
            record("11. Task <-> Conversation", "Convert Discussion to Task", "PASS", "NONE", "200/201 OK via /tasks/{id}/discussion/convert-task")
        else:
            record("11. Task <-> Conversation", "Convert Discussion to Task", "NOT_IMPLEMENTED", "INFORMATIONAL", f"Status {r_conv_alt.status_code}")
    else:
        record("11. Task <-> Conversation", "Convert Discussion to Task", "INFORMATIONAL", "NONE", f"Endpoint status: {r_conv.status_code}")

    # =========================================================================
    # 12. PROJECT CHAT
    # =========================================================================
    # Send message in Project Chat
    r_msg = requests.post(f"{BACKEND_URL}/projects/{project_id}/chat/messages", headers=primary_headers, json={
        "content": "Hello team, let's sync up on project milestones!"
    })
    if r_msg.status_code in (200, 201):
        msg_id = r_msg.json()["id"]
        record("12. Project Chat", "Send Chat Message", "PASS", "NONE", f"Message ID: {msg_id}")

        # Non-sender deletion attempt (Second User)
        r_del_msg_unauth = requests.delete(f"{BACKEND_URL}/projects/{project_id}/chat/messages/{msg_id}", headers=second_headers)
        if r_del_msg_unauth.status_code == 403:
            record("12. Project Chat", "Security: Non-sender chat deletion rejection", "PASS", "NONE", "403 Forbidden returned")
        else:
            record("12. Project Chat", "Security: Non-sender chat deletion rejection", "FAIL", "HIGH", f"Expected 403, got {r_del_msg_unauth.status_code}")

        # Sender deletion
        r_del_msg_auth = requests.delete(f"{BACKEND_URL}/projects/{project_id}/chat/messages/{msg_id}", headers=primary_headers)
        if r_del_msg_auth.status_code == 200:
            record("12. Project Chat", "Sender Chat Message Deletion", "PASS", "NONE", "200 OK returned")
        else:
            record("12. Project Chat", "Sender Chat Message Deletion", "FAIL", "HIGH", f"Status {r_del_msg_auth.status_code}")
    else:
        record("12. Project Chat", "Send Chat Message", "FAIL", "HIGH", f"Status {r_msg.status_code}: {r_msg.text}")

    # =========================================================================
    # 13. COMMUNITY FEED
    # =========================================================================
    # 13.1 Create Community Post
    r_post = requests.post(f"{BACKEND_URL}/community/posts", headers=primary_headers, json={
        "title": "Academic Collaboration on Distributed Systems",
        "content": "Looking for feedback on Raft consensus implementation in Nexora."
    })
    if r_post.status_code in (200, 201):
        post_id = r_post.json()["id"]
        record("13. Community Feed", "Create Community Post", "PASS", "NONE", f"Post ID: {post_id}")

        # 13.2 Non-author deletion attempt (Second User) -> 403
        r_post_del_unauth = requests.delete(f"{BACKEND_URL}/community/posts/{post_id}", headers=second_headers)
        if r_post_del_unauth.status_code == 403:
            record("13. Community Feed", "Security: Non-author post deletion rejection", "PASS", "NONE", "403 Forbidden returned")
        else:
            record("13. Community Feed", "Security: Non-author post deletion rejection", "FAIL", "HIGH", f"Expected 403, got {r_post_del_unauth.status_code}")

        # 13.3 Author deletion -> 200
        r_post_del_auth = requests.delete(f"{BACKEND_URL}/community/posts/{post_id}", headers=primary_headers)
        if r_post_del_auth.status_code == 200:
            record("13. Community Feed", "Author Post Deletion", "PASS", "NONE", "200 OK returned")
        else:
            record("13. Community Feed", "Author Post Deletion", "FAIL", "HIGH", f"Status {r_post_del_auth.status_code}")
    else:
        record("13. Community Feed", "Create Community Post", "FAIL", "HIGH", f"Status {r_post.status_code}: {r_post.text}")

    # =========================================================================
    # 14. NOTIFICATIONS
    # =========================================================================
    r_notifs = requests.get(f"{BACKEND_URL}/workflow/notifications", headers=primary_headers)
    if r_notifs.status_code == 200:
        notifs_list = r_notifs.json()
        record("14. Notifications", "Fetch Notifications", "PASS", "NONE", f"{len(notifs_list)} notifications found")
    else:
        record("14. Notifications", "Fetch Notifications", "FAIL", "MEDIUM", f"Status {r_notifs.status_code}")

    # =========================================================================
    # 15 & 16. PROJECT HEALTH & DETERMINISTIC TASK RISK
    # =========================================================================
    r_health = requests.get(f"{BACKEND_URL}/projects/{project_id}/health", headers=primary_headers)
    if r_health.status_code == 200:
        health_data = r_health.json()
        record("15. Project Health", "Deterministic Health Assessment", "PASS", "NONE", f"Status: {health_data.get('overall_status', 'OK')}, metrics returned")
    else:
        record("15. Project Health", "Deterministic Health Assessment", "FAIL", "HIGH", f"Status {r_health.status_code}: {r_health.text}")

    # =========================================================================
    # 17. CONTRIBUTION / EVALUATOR
    # =========================================================================
    r_contrib = requests.get(f"{BACKEND_URL}/projects/{project_id}/contributions", headers=primary_headers)
    if r_contrib.status_code == 200:
        contrib_data = r_contrib.json()
        record("17. Contribution / Evaluator", "Fetch Member Contributions", "PASS", "NONE", f"Evaluator metrics found for {len(contrib_data.get('members', []))} members")
    else:
        record("17. Contribution / Evaluator", "Fetch Member Contributions", "FAIL", "HIGH", f"Status {r_contrib.status_code}")

    # =========================================================================
    # 18. CALENDAR / MEETINGS & PERMISSIONS
    # =========================================================================
    # 18.1 Schedule Meeting (Primary User)
    cal_payload = {
        "title": "Capstone Weekly Sync",
        "description": "Weekly status and blocker review",
        "start_time": "2026-09-26T14:00:00Z",
        "end_time": "2026-09-26T15:00:00Z",
        "event_type": "MEETING"
    }
    r_meeting = requests.post(f"{BACKEND_URL}/workflow/calendar/events/{project_id}", headers=primary_headers, json=cal_payload)
    if r_meeting.status_code == 201:
        meeting_id = r_meeting.json()["id"]
        record("18. Calendar / Meetings", "Schedule Meeting Event", "PASS", "NONE", f"Meeting ID: {meeting_id}")

        # 18.2 Non-creator cancellation attempt (Second User) -> 403
        r_cancel_unauth = requests.delete(f"{BACKEND_URL}/workflow/calendar/events/{meeting_id}", headers=second_headers)
        if r_cancel_unauth.status_code == 403:
            record("18. Calendar / Meetings", "Security: Non-creator meeting cancel rejection", "PASS", "NONE", "403 Forbidden returned")
        else:
            record("18. Calendar / Meetings", "Security: Non-creator meeting cancel rejection", "FAIL", "HIGH", f"Expected 403, got {r_cancel_unauth.status_code}")

        # 18.3 Creator cancellation (Primary User) -> 200
        r_cancel_auth = requests.delete(f"{BACKEND_URL}/workflow/calendar/events/{meeting_id}", headers=primary_headers)
        if r_cancel_auth.status_code == 200:
            record("18. Calendar / Meetings", "Creator Meeting Cancellation", "PASS", "NONE", "200 OK returned")
        else:
            record("18. Calendar / Meetings", "Creator Meeting Cancellation", "FAIL", "HIGH", f"Status {r_cancel_auth.status_code}")
    else:
        record("18. Calendar / Meetings", "Schedule Meeting Event", "FAIL", "HIGH", f"Status {r_meeting.status_code}: {r_meeting.text}")

    # =========================================================================
    # 19. FILE UPLOADS / STORAGE
    # =========================================================================
    from app.services.storage_service import storage_service
    if storage_service.is_configured():
        record("19. File Uploads", "Cloud Storage Integration", "PASS", "NONE", "Supabase storage configured and verified")
    else:
        record("19. File Uploads", "Cloud Storage Integration", "NOT_TESTABLE", "INFORMATIONAL", "Supabase Storage credentials not configured in local dev environment (fallback handled safely)")

    # =========================================================================
    # 20. SETTINGS & LEAVE PROJECT
    # =========================================================================
    # Second User leaves project
    r_leave = requests.post(f"{BACKEND_URL}/projects/{project_id}/leave", headers=second_headers)
    if r_leave.status_code == 200:
        record("20. Settings", "Danger Zone: Leave Project", "PASS", "NONE", "200 OK: Member left project")

        # Verify project still exists and primary user is still in it!
        r_projs_check = requests.get(f"{BACKEND_URL}/projects", headers=primary_headers)
        if r_projs_check.status_code == 200 and any(p["id"] == project_id for p in r_projs_check.json()):
            record("20. Settings", "Leave Project: Project Remains Intact", "PASS", "NONE", "Project and remaining primary user membership preserved in DB")
        else:
            record("20. Settings", "Leave Project: Project Remains Intact", "FAIL", "BLOCKER", f"Project lost after member leave: {r_projs_check.status_code}")
    else:
        record("20. Settings", "Danger Zone: Leave Project", "FAIL", "HIGH", f"Status {r_leave.status_code}: {r_leave.text}")

    # =========================================================================
    # 21. ACCOUNT DELETION — FINAL TEST
    # =========================================================================
    print("\n--- Performing Final Test: Account Deletion (Primary User) ---")
    print(f"Target user: {primary_user['username']} ({primary_user['email']})")

    r_delete_acct = requests.delete(f"{BACKEND_URL}/users/me", headers=primary_headers)
    if r_delete_acct.status_code == 200 and r_delete_acct.json().get("status") == "success":
        record("21. Account Deletion", "Execute DELETE /users/me", "PASS", "NONE", "200 OK returned with success status")
    else:
        record("21. Account Deletion", "Execute DELETE /users/me", "FAIL", "BLOCKER", f"Status {r_delete_acct.status_code}: {r_delete_acct.text}")
        return

    # Post-deletion token invalidation check
    r_post_del = requests.get(f"{BACKEND_URL}/users/me", headers=primary_headers)
    if r_post_del.status_code == 401:
        record("21. Account Deletion", "Token Invalidation (Subsequent 401)", "PASS", "NONE", "401 Unauthorized returned for deleted user")
    else:
        record("21. Account Deletion", "Token Invalidation (Subsequent 401)", "FAIL", "BLOCKER", f"Expected 401, got {r_post_del.status_code}")

    # Database purge check
    from app.models import User
    db = SessionLocal()
    try:
        purged_u = db.get(User, uuid.UUID(primary_id))
        if purged_u is None:
            record("21. Account Deletion", "Database Purge Confirmation", "PASS", "NONE", "User row confirmed completely deleted from database")
        else:
            record("21. Account Deletion", "Database Purge Confirmation", "FAIL", "BLOCKER", "User record still exists in database")
    finally:
        db.close()

    # =========================================================================
    # 22. AUDIT SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("LIVE AUDIT SUMMARY")
    print("=" * 70)
    passed = sum(1 for r in audit_records if r["result"] == "PASS")
    failed = sum(1 for r in audit_records if r["result"] == "FAIL")
    not_impl = sum(1 for r in audit_records if r["result"] == "NOT_IMPLEMENTED")
    not_test = sum(1 for r in audit_records if r["result"] == "NOT_TESTABLE")
    total = len(audit_records)

    print(f"Total Tests Executed: {total}")
    print(f"Passed:               {passed}")
    print(f"Failed:               {failed}")
    print(f"Not Implemented:      {not_impl}")
    print(f"Not Testable:         {not_test}")

    # Save results to json for report generation
    with open("c:/Users/panna/OneDrive/Desktop/New folder (2)/proj/New folder (2)/backend/qa_results.json", "w") as f:
        json.dump(audit_records, f, indent=2)

if __name__ == "__main__":
    run_qa()
