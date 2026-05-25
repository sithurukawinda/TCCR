# Sprint 2 — API Gateway + Auth Service + User Service

**Sprint:** 2 of 7  
**Week:** 2  
**Focus:** Traffic entry point, authentication, and user management  
**Status:** `[~] In Progress`

---

## Goal

By end of Sprint 2, students can register, and the platform has a working entry point (Gateway). Admins can be created by Super Admin. All token verification and role enforcement is live.

---

## Services Involved

| Service | Port | Responsibility |
|---------|:----:|----------------|
| `gateway` | 3000 | Rate limiting, CORS, request ID, reverse proxy |
| `auth-service` | 3001 | Registration, logout, password reset, lockout tracking |
| `user-service` | 3002 | User profiles, admin management, internal user endpoints |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S2-01 | As a visitor, I can register with my name, email, and password — account is `PENDING_APPROVAL` | 5 |
| S2-02 | As a visitor, I cannot register with a duplicate email | 2 |
| S2-03 | As a logged-in user, I can log out and my token is immediately revoked | 3 |
| S2-04 | As a visitor, I can request a password reset email | 1 |
| S2-05 | As an authenticated user, I can view my own profile | 2 |
| S2-06 | As an authenticated user, I can update my `firstName`, `lastName`, `profilePhotoUrl` | 2 |
| S2-07 | As an admin, I can list all users filtered by `status` and `role` | 3 |
| S2-08 | As an admin, I can suspend and reactivate student accounts | 3 |
| S2-09 | As a super_admin, I can create, suspend, reactivate, and delete admin accounts | 5 |
| S2-10 | After 10 failed logins in 15 min, the account is locked automatically | 3 |
| S2-11 | All API traffic passes through the Gateway with correct rate limiting and request IDs | 3 |

**Total Points:** 32

---

## Tasks

### `packages/gateway/` (:3000)

- [x] Express app: Helmet → CORS → Request ID → Pino HTTP → Rate Limiter → Proxy
- [x] `requestIdMiddleware` — inject/pass-through `X-Request-Id` UUID v4
- [x] General rate limiter — 200 req/min per IP (express-rate-limit)
- [x] Auth rate limiter — 10 req/min per IP, applied to `/auth/*` routes
- [x] CORS — origin allowlist from `ALLOWED_ORIGINS` env var, no wildcard
- [x] Reverse proxy — routes `/auth/*` → auth-service, `/me/*` → user-service, etc.
- [x] `server.ts` — graceful shutdown on `SIGTERM`
- [x] `Dockerfile` (multi-stage, Alpine)
- [x] `package.json`, `tsconfig.json`

### `packages/user-service/` (:3002)

> Build User Service **before** Auth Service — Auth depends on the internal email-check endpoint.

#### Domain
- [x] `User` entity — `uid`, `email`, `firstName`, `lastName`, `role`, `status`, `profilePhotoUrl`, `createdAt`, `updatedAt`, `deletedAt`
- [x] `UserRole` value object — `student | admin | super_admin`
- [x] `UserStatus` value object — `pending_approval | approved | rejected | suspended`
- [x] `IUserRepository` interface — `findById`, `findByEmail`, `create`, `update`, `findAll`, `softDelete`

#### Infrastructure
- [x] `FirestoreUserRepository` — all `IUserRepository` methods; cursor pagination on `findAll`
- [x] `FirebaseAuthClient` — createUser, setCustomClaims, disable/enable, verifyPassword
- [x] Soft-delete: sets `deletedAt` timestamp; `findAll` filters `where('deletedAt', '==', null)`

#### Application
- [x] `GetMeUseCase`, `UpdateProfileUseCase`, `ChangePasswordUseCase`
- [x] `GetUsersUseCase`, `GetUserByIdUseCase`
- [x] `SuspendUserUseCase`, `ReactivateUserUseCase`
- [x] `CreateAdminUseCase` — Firebase user → `admin` claim → Firestore doc → `admin.created` event
- [x] `DeleteAdminUseCase` — soft-delete Firestore doc + disable Firebase account

#### Internal Endpoints
- [x] `POST /internal/users/exists` — `{ email }` → `{ exists: boolean }`
- [x] `POST /internal/users/approve` — set `status = approved` for given `uid`

#### HTTP
- [x] `GET /me`, `PATCH /me`, `POST /me/change-password` (any authenticated)
- [x] `GET /users`, `GET /users/:uid` (admin)
- [x] `POST /users/:uid/suspend`, `POST /users/:uid/reactivate` (admin)
- [x] `GET /super-admin/admins`, `POST /super-admin/admins` (super_admin)
- [x] `GET /super-admin/admins/:uid`, `POST /super-admin/admins/:uid/suspend` (super_admin)
- [x] `POST /super-admin/admins/:uid/reactivate`, `DELETE /super-admin/admins/:uid` (super_admin)
- [x] `Dockerfile`, `package.json`, `tsconfig.json`

### `packages/auth-service/` (:3001)

#### Application
- [x] `RegisterUseCase` — email check → Firebase user → `student` claim → Firestore doc → `user.registered` outbox event
- [x] `LogoutUseCase` — `admin.auth().revokeRefreshTokens(uid)` → return `204`
- [x] `TrackLoginAttemptsUseCase` — `loginAttempts` collection; lockout at 10 attempts in 15-min window
- [x] `PasswordResetUseCase` — Firebase Identity Toolkit REST API; always returns `204`

#### HTTP
- [x] `POST /auth/register` (public)
- [x] `POST /auth/logout` (any authenticated)
- [x] `POST /auth/password-reset` (public) — always returns `204`
- [x] `POST /auth/track-failure` (public) — client reports failed login
- [x] `Dockerfile`, `package.json`, `tsconfig.json`

---

## Unit Tests

| Test file | Cases |
|-----------|-------|
| `auth-service/tests/unit/RegisterUseCase.test.ts` | ✅ success; duplicate email → 409; cleanup on Firestore fail |
| `auth-service/tests/unit/TrackLoginAttemptsUseCase.test.ts` | ✅ below threshold; 10th attempt → locked; window expired; fresh start |
| `user-service/tests/unit/CreateAdminUseCase.test.ts` | ✅ success; duplicate email → 409; Firebase cleanup on fail |
| `user-service/tests/unit/SuspendUserUseCase.test.ts` | ✅ suspends user; admin.suspended event; no event for student; 404 |
| `user-service/tests/unit/User.test.ts` | ✅ entity methods (13 cases) |

---

## Integration Tests

| Test file | Cases |
|-----------|-------|
| `auth-service/tests/integration/register.test.ts` | success → 201 + Firestore doc created; duplicate → 409; invalid password → 400 |
| `auth-service/tests/integration/logout.test.ts` | valid logout → 204; subsequent request → 401 TOKEN_REVOKED |
| `user-service/tests/integration/me.test.ts` | GET /me → 200 with profile; no token → 401 |
| `user-service/tests/integration/createAdmin.test.ts` | success → 201; non-super_admin → 403 |

---

## Acceptance Criteria

- [x] `POST /auth/register` creates Firebase Auth user + Firestore `users` doc with `PENDING_APPROVAL`
- [x] Duplicate email returns `409 EMAIL_EXISTS`
- [ ] `POST /auth/logout` — subsequent requests with same token return `401 TOKEN_REVOKED`
- [x] `POST /auth/password-reset` always returns `204` regardless of email existence
- [x] `GET /me` returns `401` without token; returns profile with valid token
- [x] `POST /super-admin/admins` creates Firebase user with `admin` claim and `APPROVED` status
- [x] `POST /users/:uid/suspend` disables Firebase account
- [x] Auth endpoints rate-limited at 10 req/min per IP at gateway
- [ ] All request responses include `X-Request-Id` header
- [ ] `GET /healthz` and `GET /readyz` return `200` on both services

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 1 — Setup & Shared Packages](sprint-1-setup-and-shared-packages.md) | Next: [Sprint 3 — Course Service](sprint-3-course-service.md)*
