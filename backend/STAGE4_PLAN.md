# NEXORA — STAGE 4 IMPLEMENTATION PLAN
PRODUCTION IDENTITY & TRANSPORT SECURITY

## 1. Executive Summary & Audit (Phase 0)
- **Authentication**: Migrate from localStorage Bearer tokens to HttpOnly, Secure, SameSite=Lax cookies (`nexora_auth`).
- **CSRF Defense**: Server-issued CSRF token stored in a readable cookie (`nexora_csrf`) and validated via `X-CSRF-Token` header on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **WebSockets**: Cookie-based authentication during handshake via `websocket.cookies.get("nexora_auth")`.
- **MFA/TOTP**: RFC 6238-compliant TOTP engine using Python standard library (`hmac`, `hashlib`, `struct`, `base64`, `secrets`), including encrypted secrets, QR provisioning URIs, single-use hashed recovery codes, login challenges, and admin enforcement.
- **Rate Limiting**: IP/user sliding-window rate limiter protecting login, registration, and MFA verification with HTTP 429 and `Retry-After`.
- **Transport**: Production HTTPS/WSS readiness, removal of production localhost references, and HSTS enforcement.

## 2. Component Architecture
1. `backend/app/services/mfa_service.py`: RFC 6238 TOTP generation, validation, encrypted secret persistence, and hashed recovery codes.
2. `backend/app/services/rate_limiter.py`: In-memory sliding window rate limiter for auth endpoints.
3. `backend/app/routers/auth.py`: Cookie-setting login/register, `/auth/logout`, `/auth/csrf-token`, and MFA challenge/verification endpoints.
4. `backend/app/dependencies.py`: Cookie-first `get_current_user` and `verify_csrf_token`.
5. `backend/app/main.py`: WebSocket cookie authentication and CSRF middleware.
6. `frontend/src/config/api.ts` & `frontend/src/store/useAuthStore.ts`: Removal of `project_os_token` in localStorage; automatic `credentials: 'include'` and `X-CSRF-Token` dispatch.
