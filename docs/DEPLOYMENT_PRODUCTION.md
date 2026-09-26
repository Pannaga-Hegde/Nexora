# Nexora — Production Deployment Guide

This document describes the complete, step-by-step process for deploying Nexora to the production infrastructure stack:

- **Frontend**: Vercel
- **Backend**: Render (Docker, FastAPI)
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **DNS / WAF / TLS**: Cloudflare

> **Note**: This guide uses placeholders. Replace all `<PLACEHOLDER>` values with actual values for your deployment.
>
> Placeholder reference:
> - `<PRODUCTION_DOMAIN>` — Your apex domain (e.g. `nexora.example.com`)
> - `<API_DOMAIN>` — Your backend API subdomain (e.g. `api.nexora.example.com`)
> - `<SUPABASE_PROJECT_REF>` — Your Supabase project reference ID
> - `<SUPABASE_URL>` — `https://<SUPABASE_PROJECT_REF>.supabase.co`
> - `<SUPABASE_DB_PASSWORD>` — Supabase database password
> - `<RENDER_SERVICE_URL>` — Render-generated URL for your backend (e.g. `nexora-backend.onrender.com`)

---

## Architecture Diagram

```
Internet (HTTPS / WSS)
       │
       ▼
Cloudflare
  DNS resolution
  Edge TLS termination (Full Strict)
  WAF (OWASP Core Rule Set)
  DDoS protection
  Rate limiting
       │
       ├────────────────────────────────────────────┐
       ▼                                            ▼
Vercel (Frontend)                          Render (Backend)
react/vite SPA                            FastAPI + WebSockets
nexora.example.com                        api.nexora.example.com
       │                                            │
       │ HTTPS API requests & WSS                   │
       └────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                           Supabase
                                           PostgreSQL (database)
                                           Storage (private bucket: nexora-files)
```

---

## STEP 1 — Supabase Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Choose a region near your target users.
3. Set a strong database password and save it securely.
4. Note your **Project Reference ID** (`<SUPABASE_PROJECT_REF>`).

### 1.2 Obtain Connection String

In **Supabase Dashboard → Settings → Database → Connection String**:

- Use **Transaction pooler** (port 6543) for application connections:
  ```
  postgresql://postgres.<SUPABASE_PROJECT_REF>:<SUPABASE_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
  ```
- Use **Session pooler** or **Direct connection** for Alembic migrations.

> **SSL**: All Supabase PostgreSQL connections enforce TLS in transit. No additional `sslmode` parameter is needed for the hosted environment.

### 1.3 Run Database Migrations

From the repository root in a local environment configured with production `DATABASE_URL`:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
```

Or from within the deployed Render service via the Render Shell:

```bash
alembic upgrade head
```

> Migrations are also automatically run by `entrypoint.sh` on every container start.

### 1.4 Configure Storage Bucket

1. In **Supabase Dashboard → Storage → Buckets**, create a new bucket named **`nexora-files`**.
2. Ensure the bucket is set to **Private** (not public).
3. Do not enable any public access policies.
4. The backend uses the `SUPABASE_SECRET_KEY` to access this bucket — it bypasses Row Level Security.

### 1.5 Obtain API Keys

In **Supabase Dashboard → Settings → API**:

- `SUPABASE_URL`: `https://<SUPABASE_PROJECT_REF>.supabase.co`
- `SUPABASE_SECRET_KEY`: Listed as **service_role** — **keep this secret, backend only**.

> **Warning**: The `anon` (public) key grants limited public access and is not used by Nexora. The `service_role` key bypasses all RLS and must **never** appear in frontend code, build-time variables, or version control.

### 1.6 Database Role Separation (Production Requirement)

For hardened production deployments, create two separate PostgreSQL users:

```sql
-- Run as database superuser / Supabase admin

-- Runtime application user (DML only)
CREATE ROLE nexora_runtime WITH LOGIN PASSWORD '<strong-runtime-password>';
GRANT CONNECT ON DATABASE postgres TO nexora_runtime;
GRANT USAGE ON SCHEMA public TO nexora_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexora_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO nexora_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_runtime;

-- Migration user (DDL for Alembic)
CREATE ROLE nexora_migrator WITH LOGIN PASSWORD '<strong-migrator-password>';
GRANT CONNECT ON DATABASE postgres TO nexora_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO nexora_migrator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO nexora_migrator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO nexora_migrator;
```

Use `nexora_runtime` credentials in `DATABASE_URL` for the running application.
Use `nexora_migrator` credentials in `MIGRATION_DATABASE_URL` for Alembic migrations.

> **REQUIRES PRODUCTION INFRASTRUCTURE**: Supabase project access with sufficient permissions to create roles.

---

## STEP 2 — Render Backend Deployment

### 2.1 Create Render Web Service

1. Go to [render.com](https://render.com) and log in.
2. Click **New → Web Service**.
3. Connect your GitHub repository.
4. Set the following:
   - **Environment**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Build Context**: `./backend`
   - **Region**: Choose nearest to your users

### 2.2 Configure Render Environment Variables

Set **all** of the following in **Render Dashboard → Service → Environment**. Do not put real values in any file — inject them exclusively through Render's secure environment variable UI.

| Variable | Required | Value |
|---|---|---|
| `ENVIRONMENT` | ✅ | `production` |
| `DATABASE_URL` | ✅ | `postgresql://nexora_runtime:<password>@...pooler.supabase.com:6543/postgres` |
| `MIGRATION_DATABASE_URL` | ✅ | `postgresql://nexora_migrator:<password>@...pooler.supabase.com:6543/postgres` |
| `SECRET_KEY` | ✅ | Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `MFA_ENCRYPTION_KEY` | ✅ | Generate separately: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `COOKIE_SECURE` | ✅ | `true` |
| `CORS_ORIGINS` | ✅ | `https://<PRODUCTION_DOMAIN>` |
| `FRONTEND_URL` | ✅ | `https://<PRODUCTION_DOMAIN>` |
| `SUPABASE_URL` | Conditional | `https://<SUPABASE_PROJECT_REF>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Conditional | From Supabase Settings → API |
| `SUPABASE_STORAGE_BUCKET` | Conditional | `nexora-files` |
| `SQL_ECHO` | ✅ | `false` |
| `SEED_DEV_DATA` | ✅ | `false` |
| `SMTP_SERVER` | Optional | SMTP host if using email features |
| `SMTP_PORT` | Optional | `587` |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASSWORD` | Optional | SMTP password |
| `SENDER_EMAIL` | Optional | Sender address for emails |

> **Note**: `MFA_ENCRYPTION_KEY` must be set **before first deployment** in production. If it is absent at startup, the backend will refuse to start with a clear error message.

### 2.3 Render Health Check

Render will automatically probe:
```
GET /health
```
Expected response: `{"status": "healthy", "database": "connected"}` (HTTP 200).

The health check is configured in `render.yaml` with `healthCheckPath: /health`.

### 2.4 Startup Behavior

On every container start, `entrypoint.sh` will:
1. Verify `DATABASE_URL` is configured.
2. Wait for the database to accept connections (up to 60 seconds).
3. Execute `alembic upgrade head` (safe to run repeatedly).
4. Launch `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.

Render provides `PORT` dynamically. The application reads this automatically.

### 2.5 WebSocket Support on Render

Render Web Services fully support long-lived WebSocket connections. No additional configuration is required. Ensure:
- The Render service plan supports the expected concurrent connection volume.
- Cloudflare WebSocket proxying is enabled (see Step 4).

### 2.6 Note Your Render Service URL

After deployment, Render provides a URL like:
```
https://nexora-backend.onrender.com
```
This is the `<RENDER_SERVICE_URL>`. You will add a custom domain (`<API_DOMAIN>`) in Step 4 (Cloudflare).

---

## STEP 3 — Vercel Frontend Deployment

### 3.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

### 3.2 Configure Vercel Environment Variables

Set in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Required | Value |
|---|---|---|
| `VITE_API_URL` | ✅ | `https://<API_DOMAIN>` (your Render backend URL with custom domain) |
| `VITE_SITE_URL` | Optional | `https://<PRODUCTION_DOMAIN>` (for Open Graph meta tags) |

> **Warning**: Do NOT add any backend secrets (`DATABASE_URL`, `SECRET_KEY`, `MFA_ENCRYPTION_KEY`, `SUPABASE_SECRET_KEY`) to Vercel environment variables. These would be embedded in the static JavaScript bundle and exposed to all users.

### 3.3 SPA Routing (Already Configured)

`frontend/vercel.json` configures Vercel to serve `index.html` for all non-asset routes, enabling React Router client-side navigation. This is already committed to the repository.

### 3.4 Note Your Vercel Deployment URL

After deployment, Vercel provides a URL like:
```
https://nexora-frontend.vercel.app
```
Add a custom domain (`<PRODUCTION_DOMAIN>`) in Step 4 (Cloudflare).

---

## STEP 4 — Cloudflare DNS & Network Configuration

### 4.1 Add Domain to Cloudflare

1. Add your domain (`<PRODUCTION_DOMAIN>`) to your Cloudflare account.
2. Update your domain registrar's nameservers to Cloudflare's provided nameservers.

### 4.2 DNS Records

Create the following DNS records (use **Proxied** mode — orange cloud):

| Type | Name | Value | Proxy Status |
|---|---|---|---|
| `CNAME` | `@` (or `nexora`) | `cname.vercel-dns.com` | ✅ Proxied |
| `CNAME` | `api` | `nexora-backend.onrender.com` | ✅ Proxied |
| `CNAME` | `www` | `cname.vercel-dns.com` | ✅ Proxied |

> **Note**: Exact CNAME targets depend on Vercel/Render service URLs. Obtain from their dashboards.

### 4.3 TLS Configuration

In **Cloudflare Dashboard → SSL/TLS**:

- Set SSL/TLS mode to **Full (strict)** — this enforces end-to-end TLS from browser through Cloudflare to origin servers.
- **Never use "Flexible" mode** — it leaves the Cloudflare→origin segment unencrypted.
- Enable **Automatic HTTPS Rewrites** to upgrade any mixed-content HTTP resources.
- Enable **HSTS** in Cloudflare SSL settings with `max-age=31536000; includeSubDomains`.

### 4.4 WebSocket Proxying

In **Cloudflare Dashboard → Network**:
- Enable **WebSockets** toggle (enabled by default on most plans).
- This ensures `wss://api.<PRODUCTION_DOMAIN>/ws/projects/...` connections are correctly proxied from Cloudflare through to Render.

### 4.5 WAF Configuration

In **Cloudflare Dashboard → Security → WAF**:

1. Enable **Managed Rulesets**:
   - Cloudflare Managed Ruleset (OWASP Core Rule Set)
   - Cloudflare OWASP Core Ruleset
2. Create **Rate Limiting Rules**:
   - `/auth/login` — max 10 requests/minute per IP
   - `/auth/register` — max 10 requests/minute per IP
   - `/auth/mfa/verify` — max 10 requests/minute per IP
   - Global API rate limit: 300 requests/minute per IP
3. Enable **Bot Fight Mode** or configure **Bot Management** for abuse prevention.
4. DDoS protection is enabled automatically on all Cloudflare plans.

### 4.6 Custom Domains

In Vercel Dashboard:
1. **Settings → Domains → Add Domain**: `<PRODUCTION_DOMAIN>`
2. Vercel will verify via Cloudflare DNS and issue a Let's Encrypt certificate.

In Render Dashboard:
1. **Settings → Custom Domains → Add**: `api.<PRODUCTION_DOMAIN>`
2. Render will verify via DNS and configure the origin TLS certificate.

> **REQUIRES PRODUCTION INFRASTRUCTURE**: Domain registration, Cloudflare account, and Vercel/Render custom domain verification.

---

## STEP 5 — Post-Deployment Verification

### 5.1 HTTPS & HTTP Redirect

```bash
# Should redirect to HTTPS
curl -I http://<PRODUCTION_DOMAIN>/

# Should return 200 with HTML
curl -I https://<PRODUCTION_DOMAIN>/
```

### 5.2 Health Check

```bash
curl https://<API_DOMAIN>/health
# Expected: {"status": "healthy", "database": "connected"}
```

### 5.3 CORS Verification

```bash
curl -H "Origin: https://<PRODUCTION_DOMAIN>" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://<API_DOMAIN>/health -v
# Expected: Access-Control-Allow-Origin: https://<PRODUCTION_DOMAIN>
```

### 5.4 WebSocket Verification

Using the browser DevTools → Network tab:
1. Log in to the application.
2. Open a project.
3. Verify a WebSocket connection to `wss://<API_DOMAIN>/ws/projects/<id>` with status 101.
4. Verify **no** `?token=` parameter appears in the WebSocket URL.
5. Verify the connection uses the `nexora_auth` HttpOnly cookie for authentication.

### 5.5 Cookie Verification

In browser DevTools → Application → Cookies:
- `nexora_auth`: `HttpOnly` ✅, `Secure` ✅, `SameSite: Lax` ✅
- `nexora_csrf`: `HttpOnly` ❌ (accessible to JS for CSRF header), `Secure` ✅, `SameSite: Lax` ✅

### 5.6 Security Headers Verification

```bash
curl -I https://<PRODUCTION_DOMAIN>/
# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: default-src 'self'; ...
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
```

### 5.7 MFA Flow Verification

1. Enroll an account in MFA via `/settings`.
2. Log out and log back in — verify MFA challenge is required.
3. Verify TOTP code acceptance.
4. Verify admin accounts cannot disable MFA.

### 5.8 Production Smoke Tests

Run from the browser to verify end-to-end functionality:
- Register a new account.
- Log in with password + MFA (if enrolled).
- Create a project, invite a member, create a task.
- Verify real-time WebSocket updates between two browser sessions.
- Upload a file (PDF or image) to a task.
- Verify the uploaded file generates a time-limited download link.

---

## STEP 6 — Backup Configuration

### Database Backup

> **REQUIRES PRODUCTION INFRASTRUCTURE**

1. In **Supabase Dashboard → Settings → Backups**: Enable automated daily backups (included in Pro plan and above).
2. Configure PITR (Point-in-Time Recovery) for continuous WAL archiving where available.
3. For the Free plan: manually download database dumps regularly and store in encrypted off-site storage.

Manual backup command using the local backup utility:
```bash
DATABASE_URL="<production-url>" python backend/scripts/backup_db.py --dest-dir ./backups
```

### Storage Backup

> **REQUIRES PRODUCTION INFRASTRUCTURE**

Supabase Storage buckets are not included in database backups. Configure separately:
1. Use the Supabase CLI or Storage API to periodically enumerate and download all objects.
2. Store downloads in a separate encrypted cloud storage bucket with versioning enabled.
3. Set up a daily cron job or Supabase Edge Function to automate this process.

Target RPO: ≤ 1 hour | Target RTO: ≤ 2 hours

---

## STEP 7 — Rollback Procedure

### Frontend Rollback (Vercel)

1. In Vercel Dashboard → Deployments: click the previous successful deployment.
2. Click **Promote to Production** — instant rollback with zero downtime.

### Backend Rollback (Render)

1. In Render Dashboard → Service → Deploys: click a previous successful deploy.
2. Click **Redeploy** — Render will rebuild and restart using that commit.

> **Important**: If the rollback crosses an Alembic migration boundary, you may need to run `alembic downgrade -1` before redeploying the older version. Test migration downgrade scripts before production use.

### Database Rollback

1. Restore from the most recent automated Supabase backup.
2. Or use PITR to restore to a specific timestamp.
3. After database restore, ensure the application version matches the schema version.

---

## Security Checklist

See [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for the complete production checklist.

---

## WAF Origin Protection

To prevent attackers from bypassing Cloudflare and directly hitting Render/Vercel origins:

1. **Render**: Add a custom HTTP request header in Cloudflare (e.g. `CF-Access-Token: <secret>`) and verify it on the backend with middleware. This ensures only Cloudflare-proxied traffic reaches Render.
2. **Vercel**: Configure Vercel's Trusted IP list to only accept traffic from Cloudflare IP ranges.
3. Cloudflare IP ranges: [cloudflare.com/ips](https://www.cloudflare.com/ips/)

> **REQUIRES PRODUCTION INFRASTRUCTURE**: Custom header generation and server-side verification configuration.

---

## Malware Scanning (Future Requirement)

> **UPLOAD MALWARE SCANNING REQUIRES PRODUCTION INFRASTRUCTURE**

Current state: File uploads are strictly validated (10 MB limit, prohibited extensions blocked, filenames sanitized). Antivirus scanning is not yet active.

Planned architecture:
```
Client Upload → FastAPI Validation → Quarantine Bucket → ClamAV Scanner
     → Clean: Promote to nexora-files
     → Infected: Delete + Alert
```

Recommended scanner: ClamAV daemon or AWS GuardDuty malware protection on S3 buckets.
