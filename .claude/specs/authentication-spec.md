# Spec: Authentication & Authorisation

**Slug:** authentication-spec  
**Service(s):** auth-service, user-service, shared/auth-middleware (all services)  
**Status:** Release Baseline  
**Date:** 2026-05-07  
**Version:** 1.0.0

---

## Problem

The platform needs stateless, token-based authentication that never stores sessions server-side, enforces role-based access on every route, and prevents common attacks (brute force, token replay after logout, revoked sessions).

---

## Actors & Roles

| Role | Firebase Custom Claim | Who |
|------|--------------------|-----|
| `student` | `role: "student"` | Registered and approved students |
| `admin` | `role: "admin"` | Staff created by Super Admin |
| `super_admin` | `role: "super_admin"` | Platform owner; inherits all admin permissions |
| public | (no token) | Unauthenticated visitors |

---

## 1. Registration Flow

### Endpoint
`POST /auth/register` — public, no token required

### Request
```json
{
  "firstName": "Viruli",
  "lastName":  "Weerasinghe",
  "email":     "viruli@example.com",
  "password":  "SecurePass@2026"
}
```

### Validation Rules
| Field | Rule |
|-------|------|
| `firstName` | 1–100 characters, required |
| `lastName` | 1–100 characters, required |
| `email` | Valid email format, unique across platform |
| `password` | Min 10 chars · at least 1 uppercase · 1 lowercase · 1 number · 1 special character |

### Flow
1. Validate request body with Zod — return `400 VALIDATION_ERROR` on failure.
2. Call User Service internal endpoint `POST /internal/users/exists` — check email uniqueness.
3. If email exists, return `409 EMAIL_EXISTS`.
4. Create Firebase Auth account via `admin.auth().createUser()`.
5. Set custom claim `{ role: 'student' }` via `admin.auth().setCustomUserClaims()`.
6. Create Firestore `users` document with `status: PENDING_APPROVAL`.
7. Write `user.registered` domain event to `outbox` collection (same batch as user document).
8. Return `201` with message `"Registration submitted. Your account is pending approval."`.

### Response
```json
{ "message": "Registration submitted. Your account is pending approval." }
```

### Error Cases
| Condition | Status | Code |
|-----------|--------|------|
| Zod validation failure | 400 | `VALIDATION_ERROR` |
| Email already registered | 409 | `EMAIL_EXISTS` |

---

## 2. Login Flow

Login is handled **entirely by the Firebase client SDK**. The backend has no login endpoint.

```javascript
// Client-side only
const result = await signInWithEmailAndPassword(auth, email, password);
const token  = await result.user.getIdToken();
// Include token on every API request:
// Authorization: Bearer <token>
```

### Token Lifecycle
| Property | Value |
|----------|-------|
| Expiry | 1 hour |
| Refresh | Firebase client SDK refreshes automatically |
| Revocation check | `verifyIdToken(token, checkRevoked=true)` on every request |
| Clock skew tolerance | 5 minutes (Firebase default) |

---

## 3. Logout Flow

### Endpoint
`POST /auth/logout` — requires authentication

### Flow
1. Extract `uid` from `req.principal` (set by `authenticate()` middleware).
2. Call `admin.auth().revokeRefreshTokens(uid)`.
3. All existing tokens for this user are immediately invalidated across all devices.
4. Return `204 No Content`.

---

## 4. Password Reset Flow

### Endpoint
`POST /auth/password-reset` — public, no token required

### Request
```json
{ "email": "viruli@example.com" }
```

### Flow
1. Validate email format with Zod.
2. Call Firebase `sendPasswordResetEmail()`.
3. Always return `204` — never reveal whether the email exists (prevents enumeration).

---

## 5. Token Verification Middleware (`authenticate()`)

Applied on every non-public route. Implemented in `packages/shared/auth-middleware/src/index.ts`.

### Flow
```
Request arrives with Authorization: Bearer <token>
    ↓
Extract token from header
    ↓
admin.auth().verifyIdToken(token, checkRevoked=true)
    ↓ success
Decode: uid, email, role (from custom claims)
    ↓
Attach principal = { uid, email, role } to req
    ↓
Call next()
```

### Error Responses
| Firebase error code | HTTP status | Error code |
|--------------------|-------------|------------|
| `auth/id-token-revoked` | 401 | `TOKEN_REVOKED` |
| `auth/id-token-expired` | 401 | `TOKEN_EXPIRED` |
| Any other error | 401 | `INVALID_TOKEN` |
| No `Authorization` header | 401 | `UNAUTHENTICATED` |

---

## 6. Role Authorisation Middleware (`authorize()`)

Applied after `authenticate()` on protected routes.

### Behaviour
- Accepts one or more role strings: `authorize('admin')`, `authorize('student', 'admin')`
- `super_admin` automatically inherits `admin` permissions — `authorize('admin')` passes for `super_admin`
- Role mismatch returns `403 FORBIDDEN`

### RBAC Summary
| Route type | Middleware chain |
|-----------|-----------------|
| Public | (none) |
| Any authenticated user | `authenticate()` |
| Student only | `authenticate()`, `authorize('student')` |
| Admin + Super Admin | `authenticate()`, `authorize('admin')` |
| Super Admin only | `authenticate()`, `authorize('super_admin')` |
| Own resource | `authenticate()`, `authorize(...)`, `mustBeOwnerOrAdmin()` |

---

## 7. Ownership Guard (`mustBeOwnerOrAdmin()`)

Used on routes that return or modify a resource owned by a specific user (e.g., `GET /me`, own enrollment, own progress).

### Behaviour
- Passes if `req.principal.uid === resourceOwnerUid`
- Passes if `req.principal.role` is `admin` or `super_admin`
- Returns `403 FORBIDDEN` otherwise

---

## 8. Account Lockout (FR-AUTH-008)

### Trigger
10 failed login attempts within a 15-minute window for the same email address.

### Implementation
- Login failures are reported by the client to `POST /auth/track-failure` (auth-service).
- `TrackLoginAttemptsUseCase` maintains a `loginAttempts` Firestore collection keyed by email.
- When count reaches 10 within the window: `admin.auth().updateUser(uid, { disabled: true })`.
- Locked accounts produce `auth/user-disabled` on the next Firebase client login attempt.
- An admin must reactivate the account via `POST /users/:uid/reactivate`.

### Lockout Window Reset
- Counter resets when 15 minutes have elapsed since `windowStart`.
- Successful login does NOT reset the counter (window-based, not attempt-based).

---

## 9. Public Endpoints (No Authentication Required)

| Method | Path | Reason |
|--------|------|--------|
| `POST` | `/auth/register` | New user signup |
| `POST` | `/auth/password-reset` | Password recovery |
| `GET` | `/courses` | Browse course catalog |
| `GET` | `/courses/:id` | View published course detail |
| `GET` | `/healthz` | Kubernetes liveness probe |
| `GET` | `/readyz` | Kubernetes readiness probe |

---

## 10. Internal Service Authentication

Routes under `/internal/*` are not protected by Firebase token auth. They use a shared secret instead.

| Header | Value |
|--------|-------|
| `X-Internal-Service-Key` | Value from `INTERNAL_SERVICE_KEY` env var |

Internal routes must:
- Reject requests missing or with incorrect `X-Internal-Service-Key` with `401`
- Never be exposed through the API Gateway (Gateway only proxies `/api/v1/*` routes)

---

## Security Constraints

1. `verifyIdToken` must always use `checkRevoked=true` — never skip revocation check.
2. Tokens and passwords must never appear in logs — redacted via Pino `redact` config.
3. Password complexity is enforced at the Firebase project level (Firebase Auth settings) AND validated by Zod on registration.
4. Email enumeration is prevented on password-reset — always return `204` regardless of whether email exists.
5. Account lockout threshold is 10 attempts in 15 minutes — configurable only via code, not env vars.
6. `super_admin` role is assigned manually in Firebase Console or via Admin SDK — no API endpoint creates a super_admin account.

---

## Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| NFR-SEC-002 | `checkRevoked=true` on every token verification |
| NFR-SEC-004 | `Authorization` header and `password` fields redacted from all logs |
| NFR-SEC-008 | Auth endpoints: 10 req/min per IP rate limit at the gateway |
| NFR-AUTH-001 | Token verification must complete in < 100 ms p95 (Firebase Admin SDK uses cached public keys) |

---

## Out of Scope

- OAuth / social login (Google, Apple, GitHub)
- Multi-factor authentication (MFA)
- Server-side session management
- JWT issued by the application (Firebase-issued tokens only)
- Refresh token endpoint on the backend (handled by Firebase client SDK)

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with Backend Blueprint v1.0.0 §10 · API Document v1.0.0 §2*
