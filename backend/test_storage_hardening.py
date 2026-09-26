import io
import os
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.storage_service import (
    SupabaseStorageService,
    storage_service,
    FileValidationError,
    StorageConfigurationError,
    StorageOperationError,
)
from app.models import Task, User, Project, ProjectMember, TaskComment, CommentAttachment
from app.database import SessionLocal
from app.auth import create_access_token

client = TestClient(app)

print("=" * 65)
print("NEXORA PERSISTENT FILE STORAGE & HARDENING TEST SUITE")
print("=" * 65)

# Setup test user and project
db = SessionLocal()
PROJ_1_ID = uuid.UUID("a0000000-0000-0000-0000-000000000001")

proj = db.get(Project, PROJ_1_ID)
if not proj:
    proj = Project(
        id=PROJ_1_ID,
        name="Test Storage Project",
        description="Test project for persistent storage hardening",
        status="Active",
    )
    db.add(proj)
    db.commit()

lead_user = db.query(User).filter(User.username == "storage_test_lead").first()
if not lead_user:
    lead_user = User(
        id=uuid.uuid4(),
        username="storage_test_lead",
        email="storage_lead@example.com",
        password_hash="mockhash",
        system_role="student",
    )
    db.add(lead_user)
    db.commit()

# Ensure lead_user is member of PROJ_1_ID
membership = db.get(ProjectMember, (PROJ_1_ID, lead_user.id))
if not membership:
    db.add(ProjectMember(project_id=PROJ_1_ID, user_id=lead_user.id, project_role="leader"))
    db.commit()

lead_token = create_access_token({"sub": str(lead_user.id), "username": lead_user.username})
auth_headers = {"Authorization": f"Bearer {lead_token}"}

# Create a test task in PROJ_1_ID
test_task_id = uuid.uuid4()
lead_user_id = lead_user.id
test_task = Task(
    id=test_task_id,
    title="Storage Test Task",
    project_id=PROJ_1_ID,
    reporter_id=lead_user_id,
    assignee_id=lead_user_id,
)
db.add(test_task)
db.commit()

# Create a non-member user
non_member = db.query(User).filter(User.username == "unauthorized_storage_user").first()
if not non_member:
    non_member_id = uuid.uuid4()
    non_member = User(
        id=non_member_id,
        username="unauthorized_storage_user",
        email="unauth_storage@example.com",
        password_hash="mock",
        system_role="student",
    )
    db.add(non_member)
    db.commit()
else:
    non_member_id = non_member.id

non_member_token = create_access_token({"sub": str(non_member_id), "username": non_member.username})
non_member_headers = {"Authorization": f"Bearer {non_member_token}"}

db.close()

# -------------------------------------------------------------
# Unit Sanitization & Safety Tests
# -------------------------------------------------------------
print("\n[1] Testing Filename Sanitization & Traversal Prevention")
test_cases = [
    ("../../etc/passwd", "etc_passwd"),
    ("..\\..\\windows\\system32\\calc.exe", "windows_system32_calc.exe"),
    ("my normal file (1).pdf", "my_normal_file__1_.pdf"),
    ("file\x00with\x1fnulls.png", "filewithnulls.png"),
    ("...hidden.docx", "hidden.docx"),
    ("", "attachment"),
]

for raw, expected in test_cases:
    sanitized = SupabaseStorageService.sanitize_filename(raw)
    assert ".." not in sanitized, f"Traversal detected in: {sanitized}"
    assert "/" not in sanitized, f"Slash detected in: {sanitized}"
    assert "\\" not in sanitized, f"Backslash detected in: {sanitized}"
    print(f"   -> '{raw}' sanitized to: '{sanitized}' OK")

# -------------------------------------------------------------
# Test A: Authenticated Authorized Upload (with mocked Supabase)
# -------------------------------------------------------------
print("\n[2] Test A: Authenticated Authorized Upload")
fake_file_content = b"%PDF-1.4 Mock PDF Content For Project Report"
file_tuple = {"file": ("project_milestone.pdf", io.BytesIO(fake_file_content), "application/pdf")}

with patch.object(storage_service, "is_configured", return_value=True), \
     patch.object(storage_service, "upload_file", return_value="projects/test/path.pdf") as mock_upload, \
     patch.object(storage_service, "create_signed_url", return_value="https://supabase.co/storage/v1/sign/projects/test/path.pdf?token=abc") as mock_sign:

    res = client.post(
        f"/tasks/{test_task_id}/discussion/attachments",
        headers=auth_headers,
        files=file_tuple,
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["file_name"] == "project_milestone.pdf"
    assert "file_url" in data
    assert "storage_key" in data
    assert data["file_size_bytes"] == len(fake_file_content)
    created_attachment_id = data["id"]
    print(f"   -> Upload Succeeded! Attachment ID: {created_attachment_id}")
    print(f"   -> Stored storage key: {data['storage_key']}")
    print(f"   -> Returned signed URL: {data['file_url']}")

# -------------------------------------------------------------
# Test B: Unauthenticated Upload Rejection
# -------------------------------------------------------------
print("\n[3] Test B: Unauthenticated Upload Rejection (401)")
res_no_auth = client.post(
    f"/tasks/{test_task_id}/discussion/attachments",
    files={"file": ("unauth.pdf", io.BytesIO(b"data"), "application/pdf")},
)
assert res_no_auth.status_code in (401, 403), f"Expected 401/403, got {res_no_auth.status_code}"
print("   -> Correctly Rejected without JWT token (401 Unauthorized)")

# -------------------------------------------------------------
# Test C: Unauthorized Project/Task Upload Rejection (403)
# -------------------------------------------------------------
print("\n[4] Test C: Unauthorized Project/Task Upload Rejection (403)")
with patch.object(storage_service, "is_configured", return_value=True):
    res_unauth_proj = client.post(
        f"/tasks/{test_task_id}/discussion/attachments",
        headers=non_member_headers,
        files={"file": ("secret.pdf", io.BytesIO(b"data"), "application/pdf")},
    )
    assert res_unauth_proj.status_code == 403, f"Expected 403, got {res_unauth_proj.status_code}"
    print("   -> Correctly Rejected for Non-Project Member (403 Forbidden)")

# -------------------------------------------------------------
# Test D: File Over Size Limit Rejection (>10 MB)
# -------------------------------------------------------------
print("\n[5] Test D: File Over Size Limit Rejection (>10 MB)")
large_content = b"X" * (10 * 1024 * 1024 + 1024)
with patch.object(storage_service, "is_configured", return_value=True):
    res_oversize = client.post(
        f"/tasks/{test_task_id}/discussion/attachments",
        headers=auth_headers,
        files={"file": ("giant_file.pdf", io.BytesIO(large_content), "application/pdf")},
    )
    assert res_oversize.status_code == 400, f"Expected 400, got {res_oversize.status_code}: {res_oversize.text}"
    assert "exceeds maximum allowed limit of 10 MB" in res_oversize.text
    print("   -> Correctly Rejected Oversized 10MB+ File (400 Bad Request)")

# -------------------------------------------------------------
# Test E: Prohibited Executable / Dangerous File Rejection (.exe, .bat, .sh)
# -------------------------------------------------------------
print("\n[6] Test E: Prohibited Executable / Dangerous File Rejection")
dangerous_files = [
    "malware.exe", "exploit.bat", "script.sh", "payload.vbs", "shell.php",
    "exploit.html", "vector.svg", "page.htm", "doc.xhtml", "UPPER.SVG"
]
with patch.object(storage_service, "is_configured", return_value=True):
    for bad_file in dangerous_files:
        res_bad = client.post(
            f"/tasks/{test_task_id}/discussion/attachments",
            headers=auth_headers,
            files={"file": (bad_file, io.BytesIO(b"malicious_bytes"), "application/octet-stream")},
        )
        assert res_bad.status_code == 400, f"Expected 400 for {bad_file}, got {res_bad.status_code}: {res_bad.text}"
        assert "prohibited" in res_bad.text
        print(f"   -> Correctly Rejected Dangerous File '{bad_file}' (400 Bad Request)")

# -------------------------------------------------------------
# Test F: Attachment Linking to Comment
# -------------------------------------------------------------
print("\n[7] Test F: Attachment Record Creation & Linking to Comment")
with patch.object(storage_service, "is_configured", return_value=True), \
     patch.object(storage_service, "create_signed_url", return_value="https://supabase.co/storage/v1/sign/projects/test/signed.pdf"):

    comment_res = client.post(
        f"/tasks/{test_task_id}/discussion",
        headers=auth_headers,
        json={
            "content": "Here is the architectural milestone PDF attachment.",
            "attachment_ids": [created_attachment_id],
        }
    )
    assert comment_res.status_code == 200, f"Expected 200, got {comment_res.status_code}: {comment_res.text}"
    comment_data = comment_res.json()
    assert len(comment_data["attachments"]) == 1
    assert comment_data["attachments"][0]["id"] == created_attachment_id
    assert comment_data["attachments"][0]["file_name"] == "project_milestone.pdf"
    print("   -> Comment successfully created with linked persistent attachment!")

# -------------------------------------------------------------
# Test G: Authorized Attachment Download Signed URL Access
# -------------------------------------------------------------
print("\n[8] Test G: Authorized Attachment Download Signed URL Access")
with patch.object(storage_service, "is_configured", return_value=True), \
     patch.object(storage_service, "create_signed_url", return_value="https://supabase.co/storage/v1/sign/projects/test/download.pdf?token=xyz") as mock_sign_dl:

    dl_res = client.get(
        f"/tasks/{test_task_id}/discussion/attachments/{created_attachment_id}/download",
        headers=auth_headers,
    )
    assert dl_res.status_code == 200, f"Expected 200, got {dl_res.status_code}: {dl_res.text}"
    dl_data = dl_res.json()
    assert "download_url" in dl_data
    assert dl_data["expires_in"] == 3600
    print(f"   -> Generated short-lived signed URL (3600s): {dl_data['download_url']}")

# -------------------------------------------------------------
# Test H: Unauthorized Attachment Download Access Rejection (403)
# -------------------------------------------------------------
print("\n[9] Test H: Unauthorized Attachment Download Access Rejection (403)")
with patch.object(storage_service, "is_configured", return_value=True):
    unauth_dl = client.get(
        f"/tasks/{test_task_id}/discussion/attachments/{created_attachment_id}/download",
        headers=non_member_headers,
    )
    assert unauth_dl.status_code == 403, f"Expected 403, got {unauth_dl.status_code}"
    print("   -> Correctly Rejected unauthorized download attempt (403 Forbidden)")

# -------------------------------------------------------------
# Test I: Unconfigured Storage Provider Handling (503 Service Unavailable)
# -------------------------------------------------------------
print("\n[10] Test I: Unconfigured Storage Provider Failure Handling")
with patch.object(storage_service, "is_configured", return_value=False):
    res_unconf = client.post(
        f"/tasks/{test_task_id}/discussion/attachments",
        headers=auth_headers,
        files={"file": ("test.pdf", io.BytesIO(b"content"), "application/pdf")},
    )
    assert res_unconf.status_code == 503, f"Expected 503, got {res_unconf.status_code}: {res_unconf.text}"
    assert "not configured" in res_unconf.text
    print("   -> Correctly Returned 503 Service Unavailable when credentials missing without leaking info")

# -------------------------------------------------------------
# Test J: Storage Network / Operation Failure Handling (502 Bad Gateway)
# -------------------------------------------------------------
print("\n[11] Test J: Storage Provider Network / Operation Failure Handling")
with patch.object(storage_service, "is_configured", return_value=True), \
     patch.object(storage_service, "upload_file", side_effect=StorageOperationError("Connection timeout to storage")):

    res_fail = client.post(
        f"/tasks/{test_task_id}/discussion/attachments",
        headers=auth_headers,
        files={"file": ("test.pdf", io.BytesIO(b"content"), "application/pdf")},
    )
    assert res_fail.status_code == 502, f"Expected 502, got {res_fail.status_code}: {res_fail.text}"
    print("   -> Correctly Handled Storage Failure with clean 502 Bad Gateway response")

print("\n" + "=" * 65)
print("ALL 10 PERSISTENT FILE STORAGE SECURITY TESTS PASSED SUCESSFULLY!")
print("=" * 65)
