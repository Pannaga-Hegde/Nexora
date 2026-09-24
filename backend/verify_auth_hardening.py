import time
import requests
import jwt

BASE_URL = "http://localhost:8000"
PROJECT_ID = "00000000-0000-0000-0000-000000000001"

print("=" * 70)
print("NEXORA AUTHENTICATION & SECURITY VALIDATION SUITE")
print("=" * 70)

# TEST 1: Register brand new user
timestamp = int(time.time() * 1000)
test_username = f"user_{timestamp}"
test_email = f"user_{timestamp}@university.edu"
test_password = "SecretPassword123!"

print("\n1. Testing New User Registration...")
reg_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": test_username,
    "email": test_email,
    "password": test_password,
    "full_name": "Autonomous Tester"
})
print(f"   Status: {reg_res.status_code}")
assert reg_res.status_code == 201, f"Expected 201, got {reg_res.status_code}: {reg_res.text}"
reg_data = reg_res.json()
assert "access_token" in reg_data, "access_token missing in register response"
assert "user" in reg_data, "user data missing in register response"
assert reg_data["user"]["username"] == test_username
print("   -> Registration Successful. Real user created in database.")

# TEST 2: Duplicate username rejection
print("\n2. Testing Duplicate Username Rejection...")
dup_user_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": test_username,
    "email": f"different_{timestamp}@university.edu",
    "password": test_password,
    "full_name": "Different Name"
})
print(f"   Status: {dup_user_res.status_code}")
assert dup_user_res.status_code == 400, f"Expected 400 for duplicate username, got {dup_user_res.status_code}"
print("   -> Correctly Rejected duplicate username.")

# TEST 3: Duplicate email rejection
print("\n3. Testing Duplicate Email Rejection...")
dup_email_res = requests.post(f"{BASE_URL}/auth/register", json={
    "username": f"diffuser_{timestamp}",
    "email": test_email,
    "password": test_password,
    "full_name": "Different User"
})
print(f"   Status: {dup_email_res.status_code}")
assert dup_email_res.status_code == 400, f"Expected 400 for duplicate email, got {dup_email_res.status_code}"
print("   -> Correctly Rejected duplicate email.")

# TEST 4: Login with username
print("\n4. Testing Login with Username...")
login_user_res = requests.post(f"{BASE_URL}/auth/token", data={
    "username": test_username,
    "password": test_password
})
print(f"   Status: {login_user_res.status_code}")
assert login_user_res.status_code == 200, f"Expected 200, got {login_user_res.status_code}"
login_data = login_user_res.json()
assert "access_token" in login_data
valid_token = login_data["access_token"]
print("   -> Login with username Successful.")

# TEST 5: Login with email
print("\n5. Testing Login with Email Address...")
login_email_res = requests.post(f"{BASE_URL}/auth/token", data={
    "username": test_email,
    "password": test_password
})
print(f"   Status: {login_email_res.status_code}")
assert login_email_res.status_code == 200, f"Expected 200, got {login_email_res.status_code}"
print("   -> Login with email Successful.")

# TEST 6: Login with incorrect password
print("\n6. Testing Login with Incorrect Password...")
wrong_pass_res = requests.post(f"{BASE_URL}/auth/token", data={
    "username": test_username,
    "password": "WrongPassword999!"
})
print(f"   Status: {wrong_pass_res.status_code}")
assert wrong_pass_res.status_code == 401, f"Expected 401 for wrong password, got {wrong_pass_res.status_code}"
print("   -> Correctly Rejected wrong password with 401 Unauthorized.")

# TEST 7: Authenticated request to /users/me
print("\n7. Testing Authenticated Request (/users/me)...")
auth_headers = {"Authorization": f"Bearer {valid_token}"}
me_res = requests.get(f"{BASE_URL}/users/me", headers=auth_headers)
print(f"   Status: {me_res.status_code}")
assert me_res.status_code == 200, f"Expected 200, got {me_res.status_code}"
me_data = me_res.json()
assert me_data["username"] == test_username
print(f"   -> Authenticated successfully as '{me_data['username']}' (ID: {me_data['id']})")

# TEST 8: Missing token
print("\n8. Testing Missing Token Protection...")
no_token_res = requests.get(f"{BASE_URL}/users/me")
print(f"   Status: {no_token_res.status_code}")
assert no_token_res.status_code in (401, 403), f"Expected 401/403, got {no_token_res.status_code}"
print("   -> Correctly Rejected unauthenticated request.")

# TEST 9: Invalid token
print("\n9. Testing Invalid/Garbage Token...")
invalid_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": "Bearer invalid.garbage.token"})
print(f"   Status: {invalid_res.status_code}")
assert invalid_res.status_code == 401, f"Expected 401, got {invalid_res.status_code}"
print("   -> Correctly Rejected invalid token.")

# TEST 10: Expired token
print("\n10. Testing Expired Token Rejection...")
expired_token = jwt.encode(
    {"sub": str(me_data["id"]), "username": test_username, "exp": int(time.time()) - 3600},
    "nexora-development-jwt-secret-key-32bytes-min!",
    algorithm="HS256"
)
expired_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {expired_token}"})
print(f"   Status: {expired_res.status_code}")
assert expired_res.status_code == 401, f"Expected 401, got {expired_res.status_code}"
print("   -> Correctly Rejected expired token.")

# TEST 11: Attempt mock-token backdoor
print("\n11. Testing Rejection of 'mock-token-123'...")
mock_token_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": "Bearer mock-token-123"})
print(f"   Status: {mock_token_res.status_code}")
assert mock_token_res.status_code == 401, f"Expected 401, got {mock_token_res.status_code}"
print("   -> Correctly Rejected mock token backdoor.")

print("\n" + "=" * 70)
print("ALL 11 BACKEND AUTHENTICATION VALIDATION TESTS PASSED (100% OK)")
print("=" * 70)
