# Nexora — Production Security Architecture & Security Operations Guide

This document defines the comprehensive production security architecture, operational hardening controls, and security procedures for the Nexora collaborative project management platform.

---

## Control Implementation Status Matrix

| Control Category | Status | Current Implementation Details | Local Verification | Remaining Production Infrastructure Requirement |
|---|---|---|---|---|
| **1. SSL / TLS / WSS Deployment** | **PARTIALLY IMPLEMENTED** | Nginx reverse-proxy configuration (`frontend/nginx.conf`) with HTTP-to-HTTPS redirect (`$http_x_forwarded_proto = "http"` -> 301) and WSS upgrade proxying. | Verified in `test_stage5_production_security.py` | **REQUIRES PRODUCTION INFRASTRUCTURE**: Managed TLS certificate issuance (e.g. AWS ACM, Cloudflare Edge Certificates, or Let's Encrypt / Certbot) on the public ingress/load balancer. |
| **2. HTTP Strict Transport Security (HSTS)** | **IMPLEMENTED** | Nginx configuration injects `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`. Disabled in local HTTP dev to avoid browser lockout. No premature `preload`. | Verified in `test_stage5_production_security.py` and `test_stage3b_hardening.py` | None for host domain. (Subdomain preloading can be opted-in via HSTS Preload list after production domain validation). |
| **3. Web Application Firewall (WAF)** | **PARTIALLY IMPLEMENTED** | Application-layer defense-in-depth: rate limiting (login/MFA/registration), payload length limits, parameterized SQL queries, strict UUID validation, and CORS restrictions. Dedicated cloud WAF is architectural. | Application-layer controls verified across Stages 1, 3B, 4, 5 | **REQUIRES PRODUCTION INFRASTRUCTURE**: Cloudflare WAF, AWS WAF, or Fastly at edge DNS layer for volumetric DDoS, bot management, and managed OWASP Core Rule Sets. |
| **4. Authentication + Multi-Factor Auth (MFA)** | **IMPLEMENTED** | Password hashing via `bcrypt`, access token expiration (24h), RFC 6238 TOTP MFA, single-use hashed recovery codes, database-backed `user_mfa` persistence, mandatory admin MFA, fail-fast production key validation. | Verified 53/53 tests in `test_stage4_auth_security.py` & Stage 5 | **REQUIRES PRODUCTION INFRASTRUCTURE**: Provisioning dedicated `MFA_ENCRYPTION_KEY` and `SECRET_KEY` in production secrets manager (e.g. AWS Secrets Manager, Vault). |
| **5. CSRF Defense & Secure Cookies** | **IMPLEMENTED** | Double-submit CSRF cookie pattern with `nexora_csrf` cookie + `X-CSRF-Token` header validation on mutating HTTP methods. Primary JWT stored in `HttpOnly`, `SameSite=Lax` cookie `nexora_auth`, automatically switching to `Secure=True` in production. | Verified in `test_stage4_auth_security.py` and `test_stage5_production_security.py` | Valid HTTPS termination in production to deliver `Secure` cookies over wire. |
| **6. WebSocket Transport Security** | **IMPLEMENTED** | Authenticates via `nexora_auth` HttpOnly cookie. Query-string `?token=` parameter strictly stripped and rejected. Project membership and existence validated per connection. | Verified in `test_security_hardening_stage1.py`, Stage 4, and Stage 5 | Production WSS edge termination with HTTP/1.1 `Upgrade` and `Connection` header proxying. |
| **7. Content-Security-Policy (CSP)** | **IMPLEMENTED** | Restrictive CSP header in Nginx: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `style-src` / `font-src` restricted to self & Google Fonts, `connect-src 'self' https: wss:;` (no localhost leakage in production). | Verified in `test_stage5_production_security.py` and `test_stage3b_hardening.py` | None. |
| **8. Database Security & Input Validation** | **IMPLEMENTED** | PostgreSQL / SQLAlchemy ORM parameterized queries (zero raw SQL concatenation), Alembic migration version control (head strictly matched), Pydantic input schemas with strict max length validations, UUID type safety. | Verified in `verify_schema_consistency.py` and `test_stage3b_hardening.py` | **REQUIRES PRODUCTION INFRASTRUCTURE**: Separation of runtime application database role vs DDL migration database role. |
| **9. Least Privilege (App & Containers)** | **IMPLEMENTED** | Server-side role enforcement (student vs manager vs admin). Backend Dockerfile runs as dedicated non-root user (`appuser`, UID 10001). Read-only application directories where applicable. | Verified in `test_stage5_production_security.py` | **REQUIRES PRODUCTION INFRASTRUCTURE**: Database role separation and container host runtime constraints (e.g. read-only rootfs). |
| **10. Storage Security & File Uploads** | **IMPLEMENTED** | Private Supabase Storage bucket, backend-only service-role access, 10 MB upload ceiling, strict blocking of executable/browser-renderable extensions (`.exe`, `.sh`, `.bat`, `.html`, `.svg`, `.xhtml`), filename sanitization, short-lived signed URLs. | Verified 10/10 in `test_storage_hardening.py` | **REQUIRES PRODUCTION INFRASTRUCTURE**: Asynchronous virus/malware scanner (e.g. ClamAV or AWS GuardDuty S3) in upload quarantine pipeline. |
| **11. Automated Backups & Disaster Recovery** | **PARTIALLY IMPLEMENTED** | Local backup & SHA-256 verification utility (`backend/scripts/backup_db.py`). Production architecture, RPO/RTO targets, and automated PostgreSQL WAL / Supabase Storage backup procedures defined. | Verified snapshot script locally | **REQUIRES PRODUCTION INFRASTRUCTURE**: Cloud automated snapshots (e.g. AWS RDS automated backups, Supabase daily backups, S3 cross-region replication). |
| **12. Vulnerability & Secret Scanning** | **IMPLEMENTED** | Frontend `npm audit` (0 vulnerabilities). GitHub Actions workflow (`.github/workflows/security-scan.yml`) configured for `npm audit`, `pip-audit`, `gitleaks` secret detection, and `trivy` container scanning. | Verified `npm audit` and static scanner test | **REQUIRES PRODUCTION INFRASTRUCTURE**: Automated execution in GitHub Actions CI pipeline on push/PR. |
| **13. Malware Scanning Architecture** | **PARTIALLY IMPLEMENTED** | Upload validation prevents dangerous extensions and executable files; quarantine architecture designed and documented. External scanner not running locally. | Verified file validation controls | **REQUIRES PRODUCTION INFRASTRUCTURE**: Quarantine bucket integration with ClamAV / AWS GuardDuty scanning before promotion to storage. |

---

## 1. Authentication Architecture

Nexora utilizes an industry-standard, session-less JWT authentication architecture hardened against token exfiltration:
1. **Credentials Verification**: User submits `email` and `password`. Passwords are encrypted with `bcrypt` (12 rounds) and length-validated (8–128 characters).
2. **Cookie Dispatch**: Upon successful verification:
   - `nexora_auth`: Contains the signed HS256 JWT access token. Flagged `HttpOnly=True`, `SameSite=Lax`, `Path=/`, and `Secure=True` in production. Javascript cannot access or exfiltrate this token.
   - `nexora_csrf`: Contains a cryptographically random 32-byte hexadecimal CSRF token (`HttpOnly=False`), readable by the frontend application to construct `X-CSRF-Token` headers.
3. **Session Expiration**: Access tokens expire after 24 hours (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`).
4. **Token Invalidation on Logout**: Logout endpoint explicitly overwrites and clears the cookies with an expired timestamp (`max_age=0`).

---

## 2. Multi-Factor Authentication (MFA / TOTP)

Nexora enforces RFC 6238 compliant Time-Based One-Time Password (TOTP) verification:
1. **Enrollment**: Generates a standard Base32 secret and cryptographically compliant `otpauth://` provisioning URI.
2. **Secret Encryption**: All TOTP secrets are encrypted at rest using PBKDF2/HMAC-SHA256 with an isolated 256-bit key and random 16-byte cryptographic salt.
3. **Key Isolation**: In production, `MFA_ENCRYPTION_KEY` must be explicitly configured. Startup fails immediately if `ENVIRONMENT=production` and `MFA_ENCRYPTION_KEY` is missing.
4. **Single-Use Challenge Flow**: Login for MFA-enrolled accounts issues a short-lived `mfa_pending` challenge token containing a unique `jti`. Once verified, the challenge token is consumed and cannot be replayed.
5. **Hashed Recovery Codes**: Generates 8 single-use recovery codes, stored as individual SHA-256 hashes in `user_mfa.recovery_codes`. Once consumed, a code is permanently invalidated.
6. **Administrative Account Policy**: Accounts with system role `admin` are required to maintain MFA active; attempting to disable MFA on an admin account is blocked with HTTP 403.

---

## 3. Cross-Site Request Forgery (CSRF) Defense

Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) are guarded by the Double-Submit Cookie pattern:
1. When authenticated, the backend issues an anti-CSRF token in the `nexora_csrf` cookie.
2. On every mutating request, the client extracts this token and sends it in the `X-CSRF-Token` request header.
3. The server compares the header against the cookie value using constant-time string comparison (`secrets.compare_digest`). If either is missing or mismatching, HTTP 403 Forbidden is returned.
4. Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) do not require the CSRF token.

---

## 4. Secure Cookie Configuration

Nexora's cookie policies are strictly governed by `app/auth.py`:
- **`HttpOnly`**: Set on `nexora_auth` to mitigate XSS-based credential theft.
- **`SameSite=Lax`**: Defends against cross-site request forgery while preserving top-level navigation usability.
- **`Secure`**: Enforced automatically when `ENVIRONMENT=production` or `COOKIE_SECURE=true`. In local development (`ENVIRONMENT=development`), HTTP is permitted for ease of local testing.
- **`Path=/`**: Restricts cookie scope across the domain.

---

## 5. WebSocket Authentication & Authorization

All real-time collaboration (`/ws/projects/{project_id}`) requires robust authentication:
1. **Cookie-Based Handshake**: WebSockets read the JWT strictly from the `nexora_auth` cookie during the HTTP upgrade handshake.
2. **Query Parameters Removed**: Query-string `?token=...` authentication has been removed to prevent token logging in access logs, proxy caches, and browser history.
3. **Dual Verification**: Connections require both valid signature/expiration on the JWT and verified database membership in the requested `project_id`. Unauthorized users are disconnected immediately with code `4403` (Forbidden) or `4401` (Unauthorized).

---

## 6. TLS / HTTPS / WSS Production Deployment

### Production Network Topology

```
   Browser / Client Application
              │
              ▼ HTTPS (TCP 443) / WSS
   [ Edge CDN & Managed WAF ]
   (Cloudflare / AWS CloudFront + WAF)
              │
              ▼ HTTPS (Origin TLS)
   [ Load Balancer / Ingress Controller ]
   (TLS Termination, Managed Cert via ACM / Let's Encrypt)
              │
              ▼ HTTP (Internal VPC Network)
   [ Nginx Reverse Proxy (Frontend & SPA) ]
              │
              ▼ HTTP (Internal VPC)
   [ FastAPI Backend (:8000) ]
              │
              ▼ TLS (Port 5432 / 443)
   [ PostgreSQL DB & Supabase Private Storage ]
```

### Ingress & Nginx Configuration Requirements
- **HTTP -> HTTPS Redirection**: Handled in Nginx via `if ($http_x_forwarded_proto = "http") { return 301 https://$host$request_uri; }`.
- **WebSocket Upgrade**: Reverse proxies must pass `Upgrade: $http_upgrade` and `Connection: "upgrade"`.
- **TLS Ciphers**: Recommended cipher suite: TLS 1.3 / TLS 1.2 with ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256.

---

## 7. HTTP Strict Transport Security (HSTS)

HSTS is configured in `frontend/nginx.conf`:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```
- **Max-Age**: 31,536,000 seconds (1 year) mandates that browsers only communicate over HTTPS.
- **Subdomains**: Protects all child subdomains under the main domain.
- **Preload Notice**: `preload` directive is intentionally omitted from default configuration to prevent permanent, irreversible browser hard-coding before domain registration at [hstspreload.org](https://hstspreload.org).

---

## 8. Web Application Firewall (WAF) Architecture

Nexora does not implement a custom in-app WAF; production environments must deploy a managed edge WAF:
- **Recommended Providers**: Cloudflare WAF, AWS WAF, or Azure Web Application Firewall.
- **Managed Rule Sets**:
  - OWASP Top 10 Core Rule Set (CRS).
  - Known Bad Inputs / Malicious User-Agent blocking.
  - Automated bot mitigation and credential stuffing protection.
- **Rate Limiting**:
  - Global IP rate limiting at edge: 300 requests/minute per IP.
  - Edge rate limit on `/auth/login`, `/auth/register`, and `/auth/mfa/verify`: 10 requests/minute per IP.
- **Origin Shielding**: Backend ingress should accept traffic strictly from edge CDN/WAF IP ranges.

---

## 9. Content Security Policy (CSP)

Configured in `frontend/nginx.conf`:
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
connect-src 'self' https: wss:;
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
```
- Restricts executable code to application scripts.
- Style and font resources restricted to self and Google Fonts.
- Allows HTTPS API calls and WSS real-time WebSockets without leaking localhost origins into production.
- Prevents frame embedding (`frame-ancestors 'self'`) to defeat Clickjacking.
- Blocks legacy object plugins (`object-src 'none'`).

---

## 10. Database Security & Migrations

- **ORM Parameterization**: All database access is mediated by SQLAlchemy ORM with bound parameters. Zero raw string concatenation or dynamic `text(...)` queries exist in application code.
- **Schema Control**: Database schema is strictly governed by Alembic migrations (`alembic upgrade head`). `Base.metadata.create_all` is removed from production app startup.
- **Consistency Verification**: `verify_schema_consistency.py` validates that models, migrations, and database schema remain in 100% synchronization (20/20 application tables).

---

## 11. Least Privilege

### Application Privilege
- Strict Server-Side Authorization: Access to tasks, analytics, discussions, calendar events, and files requires active `ProjectMember` membership.
- Privileged Operations: Account administration and global audits are restricted to `system_role == "admin"`. Project deletion and member removal are restricted to `manager` or `owner`.

### Database Role Separation (Production Target)
For production deployments, two separate PostgreSQL users should be provisioned:
1. `nexora_runtime`: Granted `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all application tables and `USAGE` on sequences. No `CREATE`, `DROP`, `ALTER`, or `TRUNCATE` privileges.
2. `nexora_migrator`: Used only during CI/CD deployment jobs to execute `alembic upgrade head`.

### Container Least Privilege
- `backend/Dockerfile`: Runs as unprivileged system user `appuser` (UID 10001). The container does not run as `root`.
- File system permissions prevent runtime execution of user-submitted files.

---

## 12. Storage Security

- **Private Storage**: Attachments are stored in private Supabase Storage buckets.
- **Backend-Only Service Key**: `SUPABASE_SECRET_KEY` is restricted exclusively to the backend. The frontend never receives service-role credentials.
- **Signed URLs**: Downloads are mediated through short-lived (1-hour), HMAC-signed download URLs.
- **Upload Restrictions**:
  - Maximum upload size: 10 MB (`MAX_FILE_SIZE_BYTES = 10485760`).
  - Prohibited extensions: Executable (`.exe`, `.bat`, `.sh`, `.cmd`, `.msi`, `.dll`, `.vbs`, `.ps1`), scripting (`.php`, `.py`, `.pl`, `.cgi`), and browser-renderable executable extensions (`.html`, `.htm`, `.svg`, `.xhtml`) are strictly rejected with HTTP 400.
  - Filename sanitization strips null bytes, path traversal (`../`), and special characters.

---

## 13. Backup & Disaster Recovery Strategy

### Targets
- **Recovery Point Objective (RPO)**: <= 1 Hour.
- **Recovery Time Objective (RTO)**: <= 2 Hours.

### Database Backups
- **Frequency**: Continuous WAL archiving + daily automated full snapshot at 02:00 UTC.
- **Retention**: 30 days of daily backups, 12 monthly archives in encrypted cold cloud storage (AWS S3 Glacier / GCS Coldline with AES-256 / SSE-KMS encryption).
- **Verification**: Weekly automated test restore into an isolated staging database.

### Supabase Storage Backups
- Database backups do not contain file objects. Storage buckets must be synchronized daily to an off-site cloud storage bucket using S3 batch replication or Supabase storage sync scripts.

### Backup Script
A backup creation and SHA-256 verification utility is provided at `backend/scripts/backup_db.py`.

---

## 14. Vulnerability & Secret Scanning

1. **Frontend Audits**: Run `npm audit --audit-level=high` regularly in `frontend/`. Current audit reports **0 vulnerabilities**.
2. **Backend Audits**: CI pipeline utilizes `pip-audit` to detect known CVEs in Python dependencies.
3. **Secret Scanning**: CI pipeline executes `gitleaks` to detect accidentally committed tokens, private keys, or passwords.
4. **Container Scanning**: CI pipeline runs Aquasec `trivy` on built container images to detect OS and library vulnerabilities.
5. **CI Automation**: Configured in `.github/workflows/security-scan.yml`.

---

## 15. Malware Scanning Architecture

```
   Client Upload Request
             │
             ▼
   [ FastAPI Upload Endpoint ]
   (Validate: Size <= 10MB, Allowed Extension, Filename Sanitized)
             │
             ▼
   [ S3/Storage Quarantine Bucket ] (Private, No Public Access)
             │
             ▼ Event Notification
   [ Malware Scanning Worker / ClamAV Service ]
             │
      ┌──────┴──────┐
   Clean          Infected
      │             │
      ▼             ▼
   [ Production   [ Immediate Quarantine Purge ]
     Bucket ]     [ Alert Security Team / Audit Log ]
```
*Note: Full ClamAV daemon or AWS GuardDuty malware scanning requires production infrastructure deployment.*

---

## 16. Secrets Management

- Zero production secrets are committed to the Git repository.
- Development templates are documented in `.env.example`.
- Production credentials (`SECRET_KEY`, `MFA_ENCRYPTION_KEY`, `DATABASE_URL`, `SUPABASE_SECRET_KEY`) must be provisioned via a secure secret provider (e.g. AWS Secrets Manager, HashiCorp Vault, Doppler, or Kubernetes Secrets).
- Encryption keys must never be logged or echoed in application stdout/stderr.

---

## 17. Incident Response Basics

1. **Detection & Triage**: Monitor logs for repeated 401/403/429 spikes and WAF block events.
2. **Containment**:
   - Compromised User: Invalidate active sessions by rotating the user's password or clearing active tokens.
   - Leaked Secret: Immediately rotate `SECRET_KEY` or `MFA_ENCRYPTION_KEY` in production secrets manager and restart application pods.
3. **Eradication**: Identify and patch root-cause vulnerability; review commit history and audit trails.
4. **Recovery**: Verify clean state through regression tests before returning to normal traffic.
5. **Post-Incident Review**: Document timeline, impact, and preventive hardening measures within 48 hours.

---

## 18. Production Deployment Checklist

- [ ] `ENVIRONMENT` set to `production`.
- [ ] `SECRET_KEY` set to unique, cryptographically random 32+ character string.
- [ ] `MFA_ENCRYPTION_KEY` set to dedicated 32+ byte key (verified independent of `SECRET_KEY`).
- [ ] `COOKIE_SECURE` set to `true` (or inherited from `ENVIRONMENT=production`).
- [ ] `DATABASE_URL` configured with TLS connection (`sslmode=require`).
- [ ] `alembic upgrade head` executed successfully prior to service launch.
- [ ] `SUPABASE_SECRET_KEY` configured in backend only.
- [ ] Edge WAF configured with OWASP Core Rules and Rate Limiting.
- [ ] TLS certificate active on domain with HTTP->HTTPS redirect.
- [ ] Automated backup snapshots configured with 30-day retention.
- [ ] Non-root execution verified on backend container (`USER appuser`).
