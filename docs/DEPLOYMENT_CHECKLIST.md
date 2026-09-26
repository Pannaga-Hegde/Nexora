# Nexora — Production Deployment Checklist

**Architecture**: Vercel + Render + Supabase + Cloudflare

Items marked ⚙️ require external infrastructure action by the operator.

---

## A. SUPABASE SETUP ⚙️

- [ ] ⚙️ Supabase project created (choose correct region)
- [ ] ⚙️ PostgreSQL connection string obtained (Transaction pooler, port 6543)
- [ ] ⚙️ Database migrations applied (`alembic upgrade head`)
- [ ] ⚙️ `nexora-files` Storage bucket created and set to **Private**
- [ ] ⚙️ Supabase `service_role` API key obtained (keep secret — backend only)
- [ ] ⚙️ Database role separation configured (`nexora_runtime` / `nexora_migrator`)
- [ ] ⚙️ Supabase automated backups enabled (Pro plan or above recommended)

---

## B. RENDER BACKEND ⚙️

- [ ] ⚙️ Render Web Service created (Docker, connected to GitHub repository)
- [ ] ⚙️ Dockerfile path: `./backend/Dockerfile`, context: `./backend`
- [ ] ⚙️ `ENVIRONMENT=production` configured
- [ ] ⚙️ `DATABASE_URL` configured (Supabase PostgreSQL `nexora_runtime` connection)
- [ ] ⚙️ `MIGRATION_DATABASE_URL` configured (Supabase PostgreSQL `nexora_migrator` connection)
- [ ] ⚙️ `SECRET_KEY` generated and configured (32+ bytes, cryptographically random)
- [ ] ⚙️ `MFA_ENCRYPTION_KEY` generated and configured (distinct from `SECRET_KEY`)
- [ ] ⚙️ `COOKIE_SECURE=true` configured
- [ ] ⚙️ `CORS_ORIGINS=https://<PRODUCTION_DOMAIN>` configured
- [ ] ⚙️ `FRONTEND_URL=https://<PRODUCTION_DOMAIN>` configured
- [ ] ⚙️ `SUPABASE_URL` configured
- [ ] ⚙️ `SUPABASE_SECRET_KEY` configured (backend-only secret)
- [ ] ⚙️ `SUPABASE_STORAGE_BUCKET=nexora-files` configured
- [ ] ⚙️ `SQL_ECHO=false` configured
- [ ] ⚙️ `SEED_DEV_DATA=false` confirmed
- [ ] ⚙️ Health check path set to `/health`
- [ ] ⚙️ Service deployed and health check responds 200
- [ ] ⚙️ Container running as non-root (`appuser`, UID 10001)

---

## C. VERCEL FRONTEND ⚙️

- [ ] ⚙️ Vercel project created and connected to GitHub repository
- [ ] ⚙️ Root directory set to `frontend`
- [ ] ⚙️ Framework preset set to Vite
- [ ] ⚙️ Build command: `npm run build`
- [ ] ⚙️ Output directory: `dist`
- [ ] ⚙️ `VITE_API_URL=https://<API_DOMAIN>` configured in Vercel Environment Variables
- [ ] ⚙️ (Optional) `VITE_SITE_URL=https://<PRODUCTION_DOMAIN>` configured
- [ ] ⚙️ No backend secrets present in Vercel environment variables
- [ ] ⚙️ `vercel.json` SPA routing rewrite is present and correct
- [ ] ⚙️ Production build deploys successfully (0 errors)

---

## D. CLOUDFLARE DNS ⚙️

- [ ] ⚙️ Domain added to Cloudflare
- [ ] ⚙️ Nameservers updated at registrar to Cloudflare nameservers
- [ ] ⚙️ `CNAME @` → Vercel (`cname.vercel-dns.com`) — **Proxied**
- [ ] ⚙️ `CNAME api` → Render service URL — **Proxied**
- [ ] ⚙️ `CNAME www` → Vercel (`cname.vercel-dns.com`) — **Proxied**
- [ ] ⚙️ Custom domain verified in Vercel: `<PRODUCTION_DOMAIN>`
- [ ] ⚙️ Custom domain verified in Render: `api.<PRODUCTION_DOMAIN>`

---

## E. CLOUDFLARE TLS ⚙️

- [ ] ⚙️ SSL/TLS mode set to **Full (strict)**
- [ ] ⚙️ Automatic HTTPS Rewrites enabled
- [ ] ⚙️ HSTS configured (`max-age=31536000; includeSubDomains`)
- [ ] ⚙️ WebSockets toggle enabled (Network settings)
- [ ] ⚙️ Origin TLS certificates issued by Render and Vercel (automatic)

---

## F. CLOUDFLARE WAF ⚙️

- [ ] ⚙️ Cloudflare Managed Ruleset enabled (OWASP Core Rule Set)
- [ ] ⚙️ Rate limiting rules configured for `/auth/login`, `/auth/register`, `/auth/mfa/verify`
- [ ] ⚙️ Bot Fight Mode or Bot Management enabled
- [ ] ⚙️ DDoS protection active (automatic on all plans)
- [ ] ⚙️ Origin IP protection configured (Cloudflare IP allowlist on Render origin)

---

## G. END-TO-END VERIFICATION

- [ ] ⚙️ HTTPS active: `https://<PRODUCTION_DOMAIN>` loads correctly
- [ ] ⚙️ HTTP redirect: `http://<PRODUCTION_DOMAIN>` → HTTPS (301)
- [ ] ⚙️ API health: `GET https://<API_DOMAIN>/health` returns 200
- [ ] ⚙️ CORS: `Access-Control-Allow-Origin: https://<PRODUCTION_DOMAIN>` (no wildcard)
- [ ] ⚙️ WebSocket: `wss://<API_DOMAIN>/ws/projects/<id>` connects with status 101
- [ ] ⚙️ No `?token=` in WebSocket URL
- [ ] ⚙️ `nexora_auth` cookie: `HttpOnly` ✅ `Secure` ✅ `SameSite=Lax` ✅
- [ ] ⚙️ `nexora_csrf` cookie: `Secure` ✅ `SameSite=Lax` ✅ accessible to JS ✅
- [ ] ⚙️ CSRF token validation works on POST requests
- [ ] ⚙️ MFA enrollment and verification working
- [ ] ⚙️ Admin accounts require MFA

---

## H. SECURITY HEADERS VERIFICATION

- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `Content-Security-Policy: default-src 'self'; ...` (no wildcard origins)
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

---

## I. DEPENDENCY & SECRET SCANNING

- [ ] `npm audit` passed (0 high/critical vulnerabilities) — LOCALLY VERIFIABLE
- [ ] ⚙️ `pip-audit` passed (GitHub Actions CI) — REQUIRES CI RUNNER
- [ ] ⚙️ `gitleaks` secret scan passed (GitHub Actions CI) — REQUIRES CI RUNNER
- [ ] ⚙️ `trivy` container scan passed (GitHub Actions CI) — REQUIRES CI RUNNER
- [ ] No `DATABASE_URL` in frontend source or build artifacts
- [ ] No `SECRET_KEY` in frontend source or build artifacts
- [ ] No `SUPABASE_SECRET_KEY` in frontend source or build artifacts

---

## J. BACKUP & DISASTER RECOVERY ⚙️

- [ ] ⚙️ Supabase automated daily database backups enabled
- [ ] ⚙️ PITR (point-in-time recovery) enabled if on Pro plan
- [ ] ⚙️ Database backup restore tested in staging environment
- [ ] ⚙️ Supabase Storage bucket backup process configured (separate from DB backups)
- [ ] ⚙️ Backup monitoring alerts configured
- [ ] RPO target documented: ≤ 1 hour
- [ ] RTO target documented: ≤ 2 hours

---

## K. MALWARE SCANNING ⚙️

- [ ] Upload extension validation active (`.exe`, `.sh`, `.html`, `.svg`, etc. blocked) ✅
- [ ] 10 MB upload limit active ✅
- [ ] Filename sanitization active ✅
- [ ] ⚙️ **UPLOAD MALWARE SCANNING REQUIRES PRODUCTION INFRASTRUCTURE** (ClamAV / managed scanner on quarantine bucket — NOT YET DEPLOYED)

---

## L. PRODUCTION SMOKE TESTS ⚙️

- [ ] ⚙️ Register new account successfully
- [ ] ⚙️ Login with correct credentials returns auth cookie
- [ ] ⚙️ Login with wrong password returns 401
- [ ] ⚙️ MFA enrollment and verification flow works
- [ ] ⚙️ Create project → invite member → create task → complete task
- [ ] ⚙️ Real-time WebSocket update received in second browser tab
- [ ] ⚙️ Upload a PDF file to a task → signed download URL generated → file downloadable
- [ ] ⚙️ Attempt to upload `.exe` file → rejected with 400
- [ ] ⚙️ Non-member cannot access another project's data (403)
- [ ] ⚙️ Logout clears auth and CSRF cookies
