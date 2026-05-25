# TCCR — Backend Blueprint
## The Christian Center Rathmalana · `tccr-backend`
### Node.js · TypeScript · Express · Microservice Architecture · Firebase · Clean Architecture

**Version:** 2.0.0
**Date:** 15 May 2026
**Organisation:** Future CX Lanka (Pvt) Ltd
**Status:** Release Baseline
**Supersedes:** CMP Backend Blueprint v1.0.0 (07 May 2026)

---

## Table of Contents

1. [Overview & V2 Goals](#1-overview--v2-goals)
2. [Microservice Architecture — Big Picture](#2-microservice-architecture--big-picture)
3. [Technology Stack](#3-technology-stack)
4. [Clean Architecture — Layers Per Service](#4-clean-architecture--layers-per-service)
5. [Microservices — Catalogue & Responsibilities](#5-microservices--catalogue--responsibilities)
   - 5.1 [API Gateway (Extended)](#51-api-gateway-extended)
   - 5.2 [Auth Service (Extended)](#52-auth-service-extended)
   - 5.3 [User Service (Extended)](#53-user-service-extended)
   - 5.4 [Course Service (Extended)](#54-course-service-extended)
   - 5.5 [Enrollment Service (Extended)](#55-enrollment-service-extended)
   - 5.6 [Progress Service (Extended)](#56-progress-service-extended)
   - 5.7 [Notification Service (Extended)](#57-notification-service-extended)
   - 5.8 [Audit Service (Extended)](#58-audit-service-extended)
   - 5.9 [Storage Service (Extended)](#59-storage-service-extended)
   - 5.10 [Cell Service (NEW)](#510-cell-service-new)
   - 5.11 [Analytics Service (NEW)](#511-analytics-service-new)
   - 5.12 [Scheduled Jobs Runner (NEW)](#512-scheduled-jobs-runner-new)
   - 5.13 [Outbox Worker (Carry-forward)](#513-outbox-worker-carry-forward)
6. [Inter-Service Communication](#6-inter-service-communication)
7. [Event Bus — Domain Events V2](#7-event-bus--domain-events-v2)
8. [Project Directory Structure](#8-project-directory-structure)
9. [API Gateway — Routing & Middleware](#9-api-gateway--routing--middleware)
10. [Authentication & Authorisation Flow V2](#10-authentication--authorisation-flow-v2)
11. [Data Architecture — Firestore Per Service](#11-data-architecture--firestore-per-service)
12. [Localisation — @shared/i18n (NEW)](#12-localisation--sharedi18n-new)
13. [Transactional Outbox Pattern](#13-transactional-outbox-pattern)
14. [Error Handling & Response Contracts](#14-error-handling--response-contracts)
15. [Security Implementation](#15-security-implementation)
16. [Observability — Logging, Metrics, Tracing](#16-observability--logging-metrics-tracing)
17. [Scalability & Deployment](#17-scalability--deployment)
18. [Environment Configuration](#18-environment-configuration)
19. [Testing Strategy](#19-testing-strategy)
20. [CI/CD Pipeline](#20-cicd-pipeline)
21. [V1 → V2 Migration Plan](#21-v1--v2-migration-plan)
22. [SRS Requirement Traceability](#22-srs-requirement-traceability)

---

## 1. Overview & V2 Goals

`tccr-backend` is the server-side system for the TCCR (The Christian Center Rathmalana) platform. It supports two ministries:

- **Bible School** — structured Christian education (the former CMP product, now a module).
- **Cell Groups** — small-group community life with weekly meeting reports.

V2 is an **additive evolution** of V1. Every V1 service is preserved. Some are extended. Three new services are added. No V1 endpoint is broken in V2 — V1 paths continue to work until an explicit deprecation cycle removes them in Phase 3.

### Why Microservices (unchanged from V1)

| Concern | Benefit |
|---------|---------|
| Independent deployability | Course Service can update without redeploying Auth Service |
| Fault isolation | Notification failure does not block enrollment or progress flows |
| Independent scaling | Cell Service can scale during peak mobile reporting hours independently |
| Team ownership | Each service can be owned and deployed by a focused team |

### Architectural Constraints (from SRS §2.5)

| Constraint | Specification |
|-----------|--------------|
| Runtime | Node.js LTS ≥ 20.x, TypeScript |
| Framework | Express.js per service |
| Database | Google Cloud Firestore (Native mode), Firebase Admin SDK |
| Identity | Firebase Authentication — Email/Password, Google, Apple |
| Storage | Firebase Cloud Storage (PDF/DOCX/PNG/JPG) |
| Push | Firebase Cloud Messaging (FCM + APNs) |
| Auth model | Stateless — Firebase ID token on every request; no server-side sessions |
| API contract | REST + JSON, versioned at `/api/v1` |
| Authorisation | Middleware tier owns ALL decisions; Firestore Security Rules are defence-in-depth only |
| Localisation | Sinhala, Tamil, English — English fallback |

### Architectural Principles

- **Single Responsibility** — each microservice owns exactly one bounded domain context
- **Database per Service** — each service owns its Firestore collections; no cross-service direct reads
- **API-first** — inter-service communication through well-defined HTTP contracts or domain events
- **Stateless** — no per-request state stored in process memory; identity conveyed by Firebase ID token
- **Fail fast** — services validate all inputs at the boundary; internal errors never leak to clients
- **Event-driven side effects** — notifications, emails, and audit writes are decoupled via domain events
- **Observability by default** — every service emits structured logs, metrics, and traces from day one
- **Additive evolution** *(NEW V2)* — new capabilities ship as new endpoints or additive fields; breaking changes follow a deprecation cycle
- **Locale-aware by default** *(NEW V2)* — every user-facing string rendered through i18n resolver; English is fallback, never assumption
- **Mobile-first write paths** *(NEW V2)* — Cell Report submission accepts idempotent retries; offline drafts reconciled server-side

---

## 2. Microservice Architecture — Big Picture

```
                    +---------------------------------------------------+
                    |                  CLIENTS                          |
                    |  tccr-web (Next.js/React)  tccr-mobile (RN)      |
                    +--------------------+------------------------------+
                                         |  HTTPS / REST · TLS 1.2+
                    +--------------------v------------------------------+
                    |               API GATEWAY  :3000                  |
                    |  Rate Limit | CORS | Request-ID | Token Forward   |
                    +---+----+----+----+----+----+----+----+----+-------+
                        |    |    |    |    |    |    |    |    |
              +---------v+  +v+  +v+  +v+  +v+  +v+  +v+  +v+  +v+--------+
              |Auth :3001|  |U| |Crs| |Enr| |Prg| |Sto| |Not| |Aud| |Cell  |
              |  EXT     |  |s| |:  | |:  | |:  | |:  | |:  | |:  | |:3010 |
              |          |  |e| |30 | |30 | |30 | |30 | |30 | |30 | | NEW  |
              |          |  |r| |03 | |04 | |05 | |06 | |07 | |08 | |      |
              +----------+  |:| |EXT| |EXT| |EXT| |EXT| |EXT| |EXT| +------+
                            |3|                                          |
                            |0|   Anlyt :3011 (NEW) <-------------------+
                            |0|   Jobs  :3012 (NEW) ---reads--> Cell/Anlyt
                            |2|
                            |E|   Outbox Worker :3009 (carry-forward)
                            |X|
                            |T|
                            +-+
                                         |
                    +--------------------v------------------------------+
                    |              FIREBASE PLATFORM                    |
                    |  Firestore | Auth (Email/Google/Apple)            |
                    |  Cloud Storage | FCM + APNs                       |
                    +--------------------+------------------------------+
                                         |
                    +--------------------v------------------------------+
                    |           EXTERNAL SERVICES                       |
                    |  YouTube IFrame | SES/SendGrid | APNs             |
                    +---------------------------------------------------+
```

### Service Map

| Service | Port | V2 Status | Owns |
|---------|:----:|:---------:|------|
| API Gateway | 3000 | Extended | Routing, rate limiting, CORS, request-ID |
| Auth Service | 3001 | Extended | Federated sign-in, registration, logout, password-reset |
| User Service | 3002 | Extended | User profiles, roles, language, FCM tokens, Admin lifecycle |
| Course Service | 3003 | Extended | Courses, Batches, Semesters, Subjects, lifecycle |
| Enrollment Service | 3004 | Extended | Role-requests, enrollment workflow, atomic approvals |
| Progress Service | 3005 | Extended | Subject completion, course/batch progress aggregates |
| Storage Service | 3006 | Extended | Attachment + image upload/download, signed URLs |
| Notification Service | 3007 | Extended | Localised in-app + email + push delivery |
| Audit Service | 3008 | Extended | Append-only audit_log, per-user audit views |
| Outbox Worker | 3009 | Carry-forward | Reads transactional outbox, dispatches events |
| **Cell Service** | **3010** | **NEW** | Cell groups, member assignments, cell reports |
| **Analytics Service** | **3011** | **NEW** | Pre-aggregated dashboard snapshots |
| **Scheduled Jobs** | **3012** | **NEW** | Semester sweep, snapshot generation, batch-window close |

---

## 3. Technology Stack

### Shared Across All Services (unchanged from V1)

| Package | Version | Purpose |
|---------|:-------:|---------|
| `node` | LTS ≥ 20.x | Runtime |
| `typescript` | 5.x | Type safety |
| `express` | 4.x | HTTP server and router |
| `firebase-admin` | 12.x | Firestore, Auth, Storage, FCM (Admin SDK) |
| `zod` | 3.x | Schema validation (request DTOs) |
| `pino` | 8.x | Structured JSON logging |
| `pino-http` | 9.x | HTTP request logging middleware |
| `uuid` | 9.x | Request ID generation |
| `helmet` | 7.x | HTTP security headers |
| `cors` | 2.x | CORS middleware |
| `express-rate-limit` | 7.x | Rate limiting |
| `http-errors` | 2.x | Standard HTTP error objects |
| `dotenv` | 16.x | Environment variable loading |
| `@opentelemetry/sdk-node` | latest | OpenTelemetry SDK |
| `@google-cloud/opentelemetry-cloud-trace-exporter` | latest | Distributed tracing |

### V2-Specific Additions

| Package | Used By | Purpose |
|---------|---------|---------|
| `i18next` + `i18next-fs-backend` | `@shared/i18n` | Translation key resolution for si/ta/en |
| `google-auth-library` | Auth Service | Google OAuth token verification |
| `apple-signin-auth` | Auth Service | Apple Sign-In token verification |
| `sharp` | Storage Service | Image dimension/size validation |
| `date-fns` + `date-fns-tz` | Analytics Service, Jobs | Period-key arithmetic (YYYY-WW, YYYY-MM) |
| `node-cron` | Scheduled Jobs | Cron scheduling |

### Dev Tooling (all services — unchanged from V1)

| Tool | Purpose |
|------|---------|
| `jest` + `ts-jest` | Unit and integration testing |
| `supertest` | HTTP integration tests |
| `@firebase/rules-unit-testing` | Firestore Security Rules tests |
| `msw` | Mock Service Worker for downstream service mocking |
| `eslint` + `@typescript-eslint` | Linting |
| `prettier` | Code formatting |
| `husky` + `lint-staged` | Pre-commit hooks |
| `docker` + `docker-compose` | Local multi-service development |
| `turbo` | Monorepo build pipeline |

---

## 4. Clean Architecture — Layers Per Service

Every microservice follows the same **4-layer Clean Architecture**. Dependency direction is always inward. Unchanged from V1.

```
+----------------------------------------------------------------+
|  PRESENTATION / HTTP LAYER                                     |
|  Express Router | Controllers | Request DTOs | Validators      |
|  Maps HTTP <-> Application Layer. Never contains logic.        |
+----------------------------------------------------------------+
|  APPLICATION LAYER                                             |
|  Use Cases / Service Classes | Orchestration                  |
|  Domain event emission | Business rule enforcement            |
|  Input: Application DTOs. Output: Domain entities or errors    |
+----------------------------------------------------------------+
|  DOMAIN LAYER                                                  |
|  Entities | Value Objects | Domain Events | Interfaces         |
|  Pure TypeScript -- zero dependencies on infrastructure        |
+----------------------------------------------------------------+
|  INFRASTRUCTURE LAYER                                          |
|  Firestore Repositories | Firebase Admin SDK                   |
|  Email Client | FCM Client | Event Bus Client                  |
|  Implements domain interfaces. All I/O lives here.             |
+----------------------------------------------------------------+
```

### Layer Rules

| Layer | Can import | Cannot import |
|-------|-----------|--------------|
| Domain | Nothing | Everything else |
| Application | Domain | Infrastructure, HTTP |
| Infrastructure | Domain, Application (interfaces) | HTTP layer |
| HTTP / Presentation | Application, Domain | Infrastructure directly |

---

## 5. Microservices — Catalogue & Responsibilities

---

### 5.1 API Gateway (Extended)

**Port:** 3000 | Thin reverse proxy — no business logic.

#### V2 Route Table

V1 routes carry forward. V2 adds:

| New Prefix | Downstream | Port |
|-----------|-----------|:----:|
| `/api/v1/auth/federated/*` | Auth Service | 3001 |
| `/api/v1/role-requests/*` | Enrollment Service | 3004 |
| `/api/v1/batches/*` | Course Service | 3003 |
| `/api/v1/cells/*` | Cell Service | 3010 |
| `/api/v1/analytics/*` | Analytics Service | 3011 |
| `/api/v1/users/:uid/audit-log` | Audit Service (path-rewrite) | 3008 |

```typescript
// packages/gateway/src/app.ts  (V2 additions after V1 routes)
app.use('/api/v1/auth',               authRateLimiter, proxy(config.services.auth));
app.use('/api/v1/role-requests',      proxy(config.services.enrollment));
app.use('/api/v1/batches',            proxy(config.services.course));
app.use('/api/v1/cells',              proxy(config.services.cell));
app.use('/api/v1/analytics',          proxy(config.services.analytics));
app.use('/api/v1/me/notifications',   proxy(config.services.notification));
app.use('/api/v1/me/progress',        proxy(config.services.progress));
app.use('/api/v1/me',                 proxy(config.services.user));
app.use('/api/v1/users',              proxy(config.services.user)); // includes /:uid/audit-log
app.use('/api/v1/super-admin',        proxy(config.services.user));
app.use('/api/v1/courses',            proxy(config.services.course));
app.use('/api/v1/semesters',          proxy(config.services.course));
app.use('/api/v1/subjects',           proxy(config.services.course));
app.use('/api/v1/enrollments',        proxy(config.services.enrollment));
app.use('/api/v1/admin/registrations',proxy(config.services.enrollment));
app.use('/api/v1/admin/enrollments',  proxy(config.services.enrollment));
app.use('/api/v1/progress',           proxy(config.services.progress));
app.use('/api/v1/audit-log',          proxy(config.services.audit));
app.get('/healthz', (_, res) => res.json({ status: 'ok' }));
app.get('/readyz', healthCheck);
```

---

### 5.2 Auth Service (Extended)

**Port:** 3001 | **Owns:** `loginAttempts`, `otps`

**V2 changes:** Federated sign-in (Google + Apple); registration creates active Member; custom claims change from `{role:string}` to `{roles:string[], preferredLanguage:string}`.

#### Endpoints

| Method | Path | Auth | V1/V2 |
|--------|------|:----:|:-----:|
| POST | `/api/v1/auth/register` | Public | **Amended** — creates active Member |
| POST | `/api/v1/auth/federated/google` | Public | **NEW** |
| POST | `/api/v1/auth/federated/apple` | Public | **NEW** |
| POST | `/api/v1/auth/logout` | Bearer | V1 |
| POST | `/api/v1/auth/password-reset` | Public | V1 |
| POST | `/api/v1/auth/password-reset/verify` | Public | V1 |
| POST | `/api/v1/auth/track-failure` | Public | V1 |

#### V2 Registration Flow

```
POST /api/v1/auth/register
  Body: { email, password, firstName, lastName, preferredLanguage? }

  1. Validate input (Zod registerSchema — min 10 chars + upper + lower + number + special)
  2. Check email uniqueness via User Service /internal/users/exists
  3. Create Firebase Auth user
  4. Set V2 custom claims: { roles: ['member'], preferredLanguage }
  5. Publish domain event: user.registered
     -> User Service creates /users/{uid} doc (status: active, roles: ['member'])
     -> Notification Service queues admin notification
  6. Return 201 { uid, message: 'Registration successful. Please verify your email.' }
```

#### Federated Sign-In Use Case

```typescript
// packages/auth-service/src/application/useCases/FederatedSignInUseCase.ts
export class FederatedSignInUseCase {
  async execute(provider: 'google' | 'apple', idToken: string, lang: string) {
    // 1. Verify third-party token and discard immediately (NFR-SEC-006)
    const payload = provider === 'google'
      ? await this.googleVerifier.verify(idToken)
      : await this.appleVerifier.verify(idToken);
    const { email, given_name, family_name } = payload;

    let firebaseUid: string;
    try {
      const fbUser = await getAuth().getUserByEmail(email);
      firebaseUid = fbUser.uid;
      await this.userClient.linkProvider(firebaseUid, `${provider}.com`);
    } catch {
      // New user — create active Member
      const created = await getAuth().createUser({
        email, displayName: `${given_name ?? ''} ${family_name ?? ''}`.trim(),
      });
      firebaseUid = created.uid;
      await getAuth().setCustomUserClaims(firebaseUid, {
        roles: ['member'], preferredLanguage: lang ?? 'en',
      });
      await this.eventPublisher.publish('user.registered', {
        uid: firebaseUid, email,
        firstName: given_name ?? '', lastName: family_name ?? '',
        preferredLanguage: lang ?? 'en',
        providers: [`${provider}.com`], roles: ['member'],
      });
    }
    // Mint Firebase custom token — original OAuth token DISCARDED here
    const firebaseToken = await getAuth().createCustomToken(firebaseUid);
    return { firebaseToken, uid: firebaseUid };
  }
}
```

#### Shared Auth Middleware — V2 Rewrite

```typescript
// packages/shared/auth-middleware/src/index.ts
export type Role = 'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin';

export interface AuthenticatedRequest extends Request {
  principal: {
    uid:               string;
    email:             string;
    roles:             Role[];      // V2: array, not scalar
    preferredLanguage: string;      // V2 addition
  };
}

export function authenticate(checkRevoked = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return next(createHttpError(401, 'MISSING_TOKEN', 'Authorization header required.'));

    try {
      const decoded = await getAuth().verifyIdToken(header.slice(7), checkRevoked);

      // Support V2 roles[] AND V1 legacy scalar role during migration window
      const roles: Role[] = Array.isArray(decoded['roles'])
        ? decoded['roles']
        : decoded['role'] ? [decoded['role'] as Role] : [];

      if (roles.length === 0)
        return next(createHttpError(403, 'INVALID_ROLE', 'Token carries no role claims.'));

      (req as AuthenticatedRequest).principal = {
        uid:               decoded.uid,
        email:             decoded.email ?? '',
        roles,
        preferredLanguage: (decoded['preferredLanguage'] as string) ?? 'en',
      };
      next();
    } catch (err: any) {
      const code = err.code === 'auth/id-token-revoked' ? 'TOKEN_REVOKED'
                 : err.code === 'auth/id-token-expired' ? 'TOKEN_EXPIRED'
                 : 'INVALID_TOKEN';
      return next(createHttpError(401, code, 'Token could not be verified.'));
    }
  };
}

// V2: union-matching — user passes if ANY of their roles is in the allowed list
export function authorize(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = (req as AuthenticatedRequest).principal;
    if (!p) return next(createHttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));

    // super_admin inherits all admin permissions
    const effective = p.roles.includes('super_admin')
      ? Array.from(new Set([...p.roles, 'admin']))
      : p.roles;

    if (!allowed.some(r => effective.includes(r)))
      return next(createHttpError(403, 'FORBIDDEN',
        `Roles [${p.roles.join(',')}] cannot perform this action.`));
    next();
  };
}
```

---

### 5.3 User Service (Extended)

**Port:** 3002 | **Owns:** `users`

**V2 changes:** `role:string` → `roles:string[]`; adds `preferredLanguage`, `providers[]`, `notificationPreferences`, `fcmTokens`; new role-management, FCM, and notification preference endpoints; per-user audit-log proxy.

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| GET | `/api/v1/me` | Any | V1 |
| PATCH | `/api/v1/me` | Any | **Amended** (adds `preferredLanguage`) |
| POST | `/api/v1/me/change-password` | Any | V1 |
| POST | `/api/v1/me/providers/link` | Any | **NEW** — FR-AUTH-010 |
| DELETE | `/api/v1/me/providers/:provider` | Any | **NEW** — FR-AUTH-010 |
| POST | `/api/v1/me/fcm-token` | Any | **NEW** — SRS §8.1.1 |
| DELETE | `/api/v1/me/fcm-token` | Any | **NEW** |
| PATCH | `/api/v1/me/notifications/preferences` | Any | **NEW** — FR-NOT-006 |
| GET | `/api/v1/users` | admin+ | **Amended** (`?roles`, `?batchId` filters) |
| GET | `/api/v1/users/:uid` | admin+ | V1 |
| PATCH | `/api/v1/users/:uid/roles` | admin+ | **NEW** |
| GET | `/api/v1/users/:uid/audit-log` | admin+ | **NEW** (proxy to Audit Service) |
| POST | `/api/v1/users/:uid/suspend` | admin+ | V1 |
| POST | `/api/v1/users/:uid/reactivate` | admin+ | V1 |
| GET | `/api/v1/super-admin/admins` | super_admin | V1 |
| POST | `/api/v1/super-admin/admins` | super_admin | V1 |
| GET | `/api/v1/super-admin/admins/:uid` | super_admin | V1 |
| POST | `/api/v1/super-admin/admins/:uid/suspend` | super_admin | V1 |
| POST | `/api/v1/super-admin/admins/:uid/reactivate` | super_admin | V1 |
| DELETE | `/api/v1/super-admin/admins/:uid` | super_admin | V1 |
| POST | `/api/v1/super-admin/users/:uid/make-admin` | super_admin | V1 |

#### Update Roles Use Case

```typescript
// packages/user-service/src/application/useCases/UpdateUserRolesUseCase.ts
export class UpdateUserRolesUseCase {
  async execute(input: {
    targetUid: string; add?: string[]; remove?: string[];
    actorUid: string; actorRoles: string[];
  }): Promise<{ roles: string[] }> {
    if (input.targetUid === input.actorUid)
      throw createHttpError(403, 'FORBIDDEN', 'Cannot modify your own roles.');

    const user = await this.userRepo.findByUid(input.targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Only super_admin may grant or revoke admin role
    if ((input.add?.includes('admin') || input.remove?.includes('admin'))
        && !input.actorRoles.includes('super_admin'))
      throw createHttpError(403, 'FORBIDDEN', 'Only Super Admin may modify admin role.');

    // FR-SADM-004: cannot demote the last Super Admin
    if (input.remove?.includes('super_admin')) {
      const count = await this.userRepo.countByRole('super_admin');
      if (count <= 1 && user.roles.includes('super_admin'))
        throw createHttpError(409, 'LAST_SUPER_ADMIN',
          'Cannot demote the only remaining Super Admin.');
    }

    const next = new Set(user.roles);
    input.add?.forEach(r => next.add(r));
    input.remove?.forEach(r => next.delete(r));
    next.add('member'); // member is always retained

    const nextRoles = Array.from(next);
    await this.userRepo.updateRoles(user.uid, nextRoles);
    await getAuth().setCustomUserClaims(user.uid, {
      roles: nextRoles,
      preferredLanguage: user.preferredLanguage,
    });
    await getAuth().revokeRefreshTokens(user.uid); // force token refresh on target

    await this.eventPublisher.publish('user.roles_changed', {
      actorUid: input.actorUid, targetUid: user.uid,
      before: user.roles, after: nextRoles,
    });
    return { roles: nextRoles };
  }
}
```

---

### 5.4 Course Service (Extended)

**Port:** 3003 | **Owns:** `courses`, `courses/{id}/batches`, `courses/{id}/semesters`, `courses/{id}/semesters/{id}/subjects`

**V2 changes:** New Batches sub-collection (intake cohorts); semester `openDate`/`endDate`; subject `imageUrls[]`; deletion guard for active enrollments.

> **Key design rule (SRS §8.2.2):** Batches carry **no curriculum**. All batches of a Course share the same Semesters → Subjects → Lessons. A Batch only determines *when* the Student joins. Content reads always go through `courses/{courseId}/semesters/...`, not through the batch.

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| GET | `/api/v1/courses` | Any | V1 |
| POST | `/api/v1/courses` | admin+ | V1 |
| GET | `/api/v1/courses/:id` | Any | V1 |
| PATCH | `/api/v1/courses/:id` | admin+ | V1 |
| POST | `/api/v1/courses/:id/publish` | admin+ | V1 |
| POST | `/api/v1/courses/:id/unpublish` | admin+ | V1 |
| POST | `/api/v1/courses/:id/archive` | admin+ | **Amended** (deletion guard) |
| DELETE | `/api/v1/courses/:id` | admin+ | V1 |
| GET | `/api/v1/courses/:id/batches` | Auth | **NEW** |
| POST | `/api/v1/courses/:id/batches` | admin+ | **NEW** |
| GET | `/api/v1/batches/:id` | Auth | **NEW** |
| PATCH | `/api/v1/batches/:id` | admin+ | **NEW** |
| POST | `/api/v1/batches/:id/close` | admin+ | **NEW** |
| GET | `/api/v1/batches/:id/semesters` | Auth | **NEW** (alias — same data as courses semesters) |
| GET | `/api/v1/courses/:id/semesters` | Auth | V1 |
| POST | `/api/v1/courses/:id/semesters` | admin+ | **Amended** (openDate/endDate) |
| PATCH | `/api/v1/semesters/:id` | admin+ | V1 |
| DELETE | `/api/v1/semesters/:id` | admin+ | V1 |
| GET | `/api/v1/semesters/:id/subjects` | student+, admin+ | V1 |
| POST | `/api/v1/semesters/:id/subjects` | admin+ | **Amended** (imageUrls[]) |
| PATCH | `/api/v1/subjects/:id` | admin+ | V1 |
| DELETE | `/api/v1/subjects/:id` | admin+ | V1 |
| GET | `/api/v1/subjects/:id/lessons` | student+, admin+ | V1 |
| POST | `/api/v1/subjects/:id/lessons` | admin+ | V1 |
| PATCH | `/api/v1/lessons/:id` | admin+ | V1 |
| DELETE | `/api/v1/lessons/:id` | admin+ | V1 |
| GET | `/internal/courses/:id/subject-count` | Internal | V1 |
| GET | `/internal/batches/:id` | Internal | **NEW** |

#### Create Batch Use Case (NEW)

```typescript
// packages/course-service/src/application/useCases/CreateBatchUseCase.ts
export class CreateBatchUseCase {
  async execute(courseId: string, input: {
    name: string; intakeStart: string; intakeEnd: string; capacity?: number;
  }, actorUid: string): Promise<Batch> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    if (course.state === 'archived')
      throw createHttpError(409, 'INVALID_STATE', 'Cannot create batch on archived course.');

    if (new Date(input.intakeEnd) <= new Date(input.intakeStart))
      throw createHttpError(400, 'VALIDATION_ERROR', 'intakeEnd must be after intakeStart.',
        { intakeEnd: ['Must be after intakeStart'] });

    const batch = Batch.create({
      courseId, name: input.name,
      intakeStart: new Date(input.intakeStart),
      intakeEnd:   new Date(input.intakeEnd),
      capacity:    input.capacity ?? null,
      state:       'draft',
    });
    await this.batchRepo.create(batch);
    await this.courseRepo.incrementBatchCount(courseId);
    await this.eventPublisher.publish('batch.created', { actorUid, courseId, batchId: batch.id });
    return batch;
  }
}
```

#### YouTube ID Validation (Value Object — unchanged from V1)

```typescript
// packages/course-service/src/domain/valueObjects/YouTubeVideoId.ts
export class YouTubeVideoId {
  private static readonly VALID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

  static from(raw: string): string {
    const urlMatch = raw.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const id = urlMatch ? urlMatch[1] : raw.trim();
    if (!this.VALID_PATTERN.test(id))
      throw new Error(`Invalid YouTube video ID: "${raw}"`);
    return id;
  }
}
```

---

### 5.5 Enrollment Service (Extended)

**Port:** 3004 | **Owns:** `enrollments`, `role_requests`

**V2 changes:** Adds `role_requests` collection and workflow (replaces the V1 registration queue for first-time Student enrolment); atomic approval transaction; enrollment now carries `batchId` and `roleRequestId`; path change `/enrollments/mine` (was `/me/enrollments`).

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| POST | `/api/v1/role-requests` | member | **NEW** |
| GET | `/api/v1/role-requests/mine` | member+ | **NEW** |
| GET | `/api/v1/role-requests` | admin+ | **NEW** |
| GET | `/api/v1/role-requests/:id` | admin+ | **NEW** |
| POST | `/api/v1/role-requests/:id/approve` | admin+ | **NEW** |
| POST | `/api/v1/role-requests/:id/reject` | admin+ | **NEW** |
| GET | `/api/v1/enrollments/mine` | student+ | **Amended** (was `/me/enrollments` in V1) |
| POST | `/api/v1/enrollments` | student+ | **Amended** (already-student additional batch path) |
| POST | `/api/v1/enrollments/:id/withdraw` | student | V1 |
| GET | `/api/v1/enrollments` | admin+ | **Amended** (`?batchId` filter) |
| POST | `/api/v1/enrollments/:id/approve` | admin+ | V1 |
| POST | `/api/v1/enrollments/:id/reject` | admin+ | V1 |
| GET | `/api/v1/admin/registrations` | admin+ | V1 (deprecated — returns 410 in Phase 3) |
| POST | `/api/v1/admin/registrations/:id/approve` | admin+ | V1 (deprecated) |
| POST | `/api/v1/admin/registrations/:id/reject` | admin+ | V1 (deprecated) |
| POST | `/api/v1/admin/registrations/bulk-approve` | admin+ | V1 (deprecated) |
| GET | `/api/v1/admin/enrollments` | admin+ | V1 |
| POST | `/api/v1/admin/enrollments/:id/approve` | admin+ | V1 |
| POST | `/api/v1/admin/enrollments/:id/reject` | admin+ | V1 |

#### Atomic Approve Role Request Use Case (NEW)

```typescript
// packages/enrollment-service/src/application/useCases/ApproveRoleRequestUseCase.ts
export class ApproveRoleRequestUseCase {
  async execute(requestId: string, actorUid: string): Promise<void> {
    const req = await this.roleReqRepo.findById(requestId);
    if (!req) throw createHttpError(404, 'ROLE_REQUEST_NOT_FOUND', 'Role request not found.');
    if (req.status !== 'pending')
      throw createHttpError(409, 'INVALID_STATE', 'Role request is no longer pending.');
    if (req.requesterUid === actorUid)
      throw createHttpError(403, 'FORBIDDEN', 'Cannot approve your own request.');

    // FR-ENR-004: reject if batch intake window has closed at moment of review
    const batch = await this.courseClient.getBatch(req.batchId);
    if (!batch || batch.state === 'closed' || new Date(batch.intakeEnd) < new Date())
      throw createHttpError(422, 'BATCH_CLOSED', 'Target batch has closed its intake window.');

    const db = getFirestore();

    // SINGLE ATOMIC TRANSACTION: role-request + enrollment + two outbox entries
    await db.runTransaction(async (txn) => {
      txn.update(this.roleReqRepo.docRef(requestId), {
        status: 'approved', decisionByUid: actorUid, decidedAt: new Date(),
      });
      txn.set(this.enrollRepo.docRef(`${req.requesterUid}_${req.batchId}`), {
        userUid: req.requesterUid, courseId: req.courseId, batchId: req.batchId,
        status: 'active', roleRequestId: requestId,
        enrolledAt: new Date(), createdAt: new Date(),
      });
      this.eventPublisher.writeToOutbox(txn, 'role.granted',
        { userUid: req.requesterUid, role: 'student', actorUid });
      this.eventPublisher.writeToOutbox(txn, 'enrollment.approved',
        { userUid: req.requesterUid, courseId: req.courseId, batchId: req.batchId, actorUid });
    });

    // Out-of-transaction: add 'student' to roles[] via User Service
    await this.userClient.addRole(req.requesterUid, 'student');
  }
}
```

#### Bulk Approve (V1 carry-forward — unchanged)

```typescript
// packages/enrollment-service/src/application/useCases/BulkApproveRegistrationsUseCase.ts
export class BulkApproveRegistrationsUseCase {
  constructor(private readonly approveUseCase: ApproveRegistrationUseCase) {}

  async execute(ids: string[], actorUid: string) {
    const results = await Promise.allSettled(
      ids.map(id => this.approveUseCase.execute(id, actorUid))
    );
    return {
      approved: results.map((r, i) => r.status === 'fulfilled' ? ids[i] : null).filter(Boolean),
      failed:   results.map((r, i) => r.status === 'rejected'
        ? { id: ids[i], reason: (r as PromiseRejectedResult).reason?.message } : null).filter(Boolean),
    };
  }
}
```

---

### 5.6 Progress Service (Extended)

**Port:** 3005 | **Owns:** `progress`

**V2 changes:** `batchId` added to progress records; semester `endDate` gate enforced on completion.

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| POST | `/api/v1/progress/subjects/:id/complete` | student+ | **Amended** (semester gate) |
| POST | `/api/v1/progress/subjects/:id/access` | student+ | V1 |
| GET | `/api/v1/me/progress/courses/:courseId` | student+ | **Amended** (returns batchId) |
| GET | `/api/v1/me/progress/subjects/:subjectId` | student+ | V1 |
| GET | `/api/v1/admin/progress/courses/:courseId` | admin+ | **Amended** (`?batchId` filter) |
| POST | `/internal/progress/reset` | Internal | V1 |

#### Mark Complete Use Case — with Semester Gate (Amended)

```typescript
// packages/progress-service/src/application/useCases/MarkSubjectCompleteUseCase.ts
export class MarkSubjectCompleteUseCase {
  async execute(studentUid: string, subjectId: string,
    courseId: string, semesterId: string, batchId: string,
    source: 'manual' | 'auto' = 'manual'): Promise<SubjectProgress> {

    const existing = await this.progressRepo.findByStudentAndSubject(studentUid, subjectId);

    // IDEMPOTENT: already completed — return unchanged (FR-LRN-003)
    if (existing?.status === 'completed') return existing;

    // V2: semester endDate gate (FR-STU-005)
    const semester = await this.courseClient.getSemester(semesterId);
    if (semester.status === 'disabled') {
      const enrollment = await this.enrollClient.findByUserAndCourse(studentUid, courseId);
      if (!enrollment || new Date(enrollment.enrolledAt) > new Date(semester.endDate!))
        throw createHttpError(403, 'SEMESTER_DISABLED',
          'This semester is no longer accessible for your enrollment.');
    }

    const progress = existing ?? SubjectProgress.createNew(
      studentUid, subjectId, courseId, semesterId, batchId // V2 adds batchId
    );
    progress.markComplete(source);
    await this.progressRepo.upsert(progress);

    await this.eventPublisher.publish('progress.subjectCompleted', {
      studentUid, subjectId, courseId, semesterId, batchId,
    });
    return progress;
  }
}
```

#### Course Progress Aggregate (unchanged logic — V1 carry-forward)

```typescript
// packages/progress-service/src/application/useCases/ComputeCourseProgressUseCase.ts
export class ComputeCourseProgressUseCase {
  async execute(studentUid: string, courseId: string, batchId: string) {
    const [totalSubjects, records] = await Promise.all([
      this.courseClient.getSubjectCount(courseId),
      this.progressRepo.findByCourseAndStudent(courseId, studentUid),
    ]);
    const completedCount = records.filter(r => r.status === 'completed').length;
    const completionPercent = totalSubjects === 0
      ? 0
      : Math.round((completedCount / totalSubjects) * 1000) / 10;
    const lastAccessedSubjectId = records
      .filter(r => r.lastAccessedAt)
      .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime())
      [0]?.subjectId ?? null;
    return {
      courseId, batchId, userUid: studentUid,
      completedCount, pendingCount: totalSubjects - completedCount,
      totalSubjects, completionPercent, lastAccessedSubjectId,
    };
  }
}
```

---

### 5.7 Notification Service (Extended)

**Port:** 3007 | **Owns:** `notifications`

**V2 changes:** All templates localised (si/ta/en); `localeRendered` field on every notification; new event subscriptions for Cell module; channel opt-out respected.

#### Endpoints (unchanged paths — behaviour extended)

| Method | Path | Roles |
|--------|------|:-----:|
| GET | `/api/v1/me/notifications` | Any |
| POST | `/api/v1/me/notifications/:id/read` | Any |
| POST | `/api/v1/me/notifications/read-all` | Any |

#### V2 Event Subscriptions

| Domain Event | Action | V1/V2 |
|-------------|--------|:-----:|
| `user.registered` | In-app to all admins | V1 (localised) |
| `registration.approved` | In-app + email to student | V1 (localised) |
| `registration.rejected` | In-app + email to student | V1 (localised) |
| `enrollment.approved` | In-app + email + push to user | V1 (localised) |
| `enrollment.rejected` | In-app + email to user | V1 (localised) |
| `enrollment.pending` | In-app to admins | V1 (localised) |
| `role.requested` | In-app to admins ("New role request") | **NEW** |
| `role.granted` | In-app + email + push to user | **NEW** |
| `role.rejected` | In-app + email to user | **NEW** |
| `cell_report.filed` | In-app fan-out to all cell members | **NEW** |
| `cell.member_added` | In-app + push to added member | **NEW** |
| `semester.disabled` | In-app + email to enrolled students | **NEW** |
| `batch.window_closed` | In-app to admins | **NEW** |

#### Localised Dispatcher

```typescript
// packages/notification-service/src/application/services/NotificationDispatcher.ts
export class NotificationDispatcher {
  private readonly MAX_RETRIES = 3;

  async dispatch(recipientUid: string, templateKey: string,
    payload: Record<string, string>, channels: string[]) {
    const user  = await this.userClient.getUser(recipientUid);
    const locale = user.preferredLanguage ?? 'en';
    const prefs  = user.notificationPreferences ?? { email: true, push: true };

    const { title, body, emailSubject, emailBody } =
      resolveTemplate(templateKey, locale, payload); // @shared/i18n

    if (channels.includes('in_app'))
      await this.notifRepo.create({ recipientUid, templateKey, payload,
        title, body, localeRendered: locale, channels, readAt: null, createdAt: new Date() });

    if (channels.includes('email') && user.email && prefs.email) {
      // Retry with exponential backoff (NFR-NOT-009 carry-forward)
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          await this.emailClient.sendMail({ to: user.email, subject: emailSubject, html: emailBody });
          break;
        } catch (err) {
          if (attempt === this.MAX_RETRIES) {
            logger.error({ err, recipientUid }, 'Email permanently failed after retries');
          } else {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
          }
        }
      }
    }

    if (channels.includes('push') && prefs.push) {
      const tokens = await this.userClient.getFcmTokens(recipientUid);
      for (const token of tokens) {
        try {
          await getMessaging().send({ token,
            notification: { title, body },
            android: { priority: 'normal' },
            apns:    { payload: { aps: { contentAvailable: true } } },
          });
        } catch (err) {
          // Push is best-effort; in-app notification is authoritative
          logger.warn({ err, token }, 'Push delivery failed (best-effort)');
        }
      }
    }
  }
}
```

---

### 5.8 Audit Service (Extended)

**Port:** 3008 | **Owns:** `audit_log`

**V2 changes:** New per-user audit-log endpoint; Admin (not only Super Admin) may query; new V2 event types recorded.

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| GET | `/api/v1/audit-log` | admin, super_admin | **Amended** (Admin can now query; was super_admin only in V1) |
| GET | `/api/v1/users/:uid/audit-log` | admin, super_admin | **NEW** |

```typescript
// packages/audit-service/src/application/handlers/AuditEventHandler.ts
export class AuditEventHandler {
  async handle(event: AuditActionEvent): Promise<void> {
    await this.auditRepo.append({
      actorUid:   event.actorUid ?? null,
      actor:      event.actor    ?? null,
      action:     event.action,
      category:   event.category ?? null,
      targetType: event.targetType,
      targetId:   event.targetId,
      before:     event.before ?? null,  // V2: state snapshots stored internally
      after:      event.after  ?? null,  // V2: intentionally excluded from API responses
      requestId:  event.requestId,
      ip:         event.ip ?? null,
      createdAt:  Timestamp.now(),       // Immutable server timestamp
    });
  }
}
```

---

### 5.9 Storage Service (Extended)

**Port:** 3006 | **Firebase:** Cloud Storage

**V2 changes:** MIME allowlist adds PNG/JPG; new subject image upload endpoint; new cell-report attachment path.

#### Endpoints

| Method | Path | Roles | V1/V2 |
|--------|------|:-----:|:-----:|
| POST | `/api/v1/subjects/:id/attachments` | admin+ | V1 |
| POST | `/api/v1/subjects/:id/images` | admin+ | **NEW** |
| GET | `/api/v1/attachments/:id/download-url` | enrolled student, admin+ | V1 |
| DELETE | `/api/v1/attachments/:id` | admin+ | V1 |

#### V2 Upload Validators

```typescript
// packages/storage-service/src/http/middleware/attachmentValidator.ts
const DOC_MIME   = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const IMAGE_MIME = ['image/png', 'image/jpeg'];

export const documentUpload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    DOC_MIME.includes(file.mimetype) ? cb(null, true)
    : cb(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Allowed: PDF, DOC, DOCX')),
});

export const imageUpload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    IMAGE_MIME.includes(file.mimetype) ? cb(null, true)
    : cb(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Allowed: PNG, JPG')),
});
```

#### Storage Paths (V2)

| Path | Content | New? |
|------|---------|:----:|
| `/users/{uid}/profile/{filename}` | Profile photos | V1 |
| `/courses/{courseId}/cover/{filename}` | Course cover images | V1 |
| `/subjects/{subjectId}/attachments/{filename}` | PDF/DOCX | V1 |
| `/subjects/{subjectId}/images/{filename}` | PNG/JPG subject images | **NEW** |
| `/cells/{cellId}/reports/{reportId}/{filename}` | Optional report photos | **NEW** |

---

### 5.10 Cell Service (NEW)

**Port:** 3010 | **Owns:** `cell_groups`, `cell_groups/{id}/cell_reports`

Mobile-first write traffic. Offline draft + 24h retry via idempotent `X-Idempotency-Key` header (FR-CR-015 / NFR-AVA-004).

#### Endpoints

| Method | Path | Roles |
|--------|------|:-----:|
| GET | `/api/v1/cells` | leader+, g12+, admin+ |
| GET | `/api/v1/cells/mine` | Any authenticated |
| POST | `/api/v1/cells` | leader+, admin+ |
| GET | `/api/v1/cells/:id` | Member of cell, leader+, admin+ |
| PATCH | `/api/v1/cells/:id` | Owning leader/g12, admin+ |
| POST | `/api/v1/cells/:id/archive` | Owning leader/g12, admin+ |
| POST | `/api/v1/cells/:id/members` | Owning leader/g12, admin+ |
| DELETE | `/api/v1/cells/:id/members/:uid` | Owning leader/g12, admin+ |
| GET | `/api/v1/cells/:id/reports` | Member of cell, leader+, admin+ |
| POST | `/api/v1/cells/:id/reports` | Owning leader, owning g12, **super_admin** (NOT admin — SRS §9.3) |
| GET | `/api/v1/cells/:id/reports/:rid` | Member of cell, leader+, admin+ |
| POST | `/api/v1/cells/:id/reports/:rid/void` | Owning leader/g12, admin+ |
| GET | `/internal/cell-reports/by-period` | Scheduled Jobs |
| GET | `/internal/cells/by-leader/:uid` | Scheduled Jobs |
| GET | `/internal/cells/by-g12/:uid` | Scheduled Jobs |

#### Domain Entities

**CellGroup**

```typescript
// packages/cell-service/src/domain/entities/CellGroup.ts
export class CellGroup {
  id:           string;
  name:         string;
  type:         'g12' | 'care' | 'children' | 'outreach';
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      string[];   // user UIDs
  memberCount:  number;     // denormalised; atomic increment (FR-CG-007)
  reportCount:  number;     // denormalised; atomic increment (FR-CG-007)
  state:        'active' | 'archived';
  createdAt:    Date;
  updatedAt:    Date;
}
```

**CellReport** — immutable once filed; corrections via void + resubmit (FR-CR-014)

```typescript
// packages/cell-service/src/domain/entities/CellReport.ts
export class CellReport {
  id:                      string;
  cellId:                  string;
  filledByUid:             string;    // FR-CR-002: system-populated from authenticated user; read-only
  clientReqId:             string;    // FR-CR-015: client UUID for idempotent offline retry (24h window)

  // --- Meeting occurrence ---
  date:                    Date;      // FR-CR-003: defaults to today on mobile
  didMeet:                 boolean;   // FR-CR-004: if false, only noMeetReason is required
  noMeetReason?:           string;    // required when didMeet = false

  // --- Leadership presence ---
  leaderPresent:           boolean;   // FR-CR-005
  conductedByIfAbsent?:    string;    // required when leaderPresent = false

  // --- Meeting details (required when didMeet = true) ---
  location:                string;    // FR-CR-006
  timeStarted:             Date;      // FR-CR-006
  timeEnded:               Date;      // FR-CR-006
  language:                'si' | 'ta' | 'en';   // FR-CR-006

  // --- Content ---
  subjectDiscussed:        'sunday_sermon' | 'other';  // FR-CR-007
  otherSubjectReason?:     string;    // required when subjectDiscussed = 'other'

  // --- Cell identity ---
  cellType:                'g12' | 'care' | 'children' | 'outreach'; // FR-CR-008: defaults to parent cell's type
  g12LeaderUid:            string;    // FR-CR-009: from system roster
  immediateG12LeaderText?: string;    // FR-CR-009: free-text offline reference

  // --- Attendance (FR-CR-010: pre-populated from roster; isNew for walk-ins) ---
  attendance: Array<{
    userUid?:  string;
    name:      string;
    status:    'present' | 'absent' | 'new';
    isNew:     boolean;
  }>;

  // --- Follow-up ---
  contactedAbsentees:      boolean;   // FR-CR-011
  absenteeNotes?:          string;    // FR-CR-011

  // --- Additional headcount ---
  additionalVisitors:      number;    // FR-CR-012: non-roster visitors; 0 if none
  childrenCount:           number;    // FR-CR-012: children present; 0 if none

  // --- Satisfaction ---
  satisfactionRate:        1 | 2 | 3 | 4 | 5;  // FR-CR-013
  additionalInfo?:         string;    // FR-CR-013: free text

  // --- Lifecycle ---
  voided:                  boolean;   // FR-CR-014: immutable once true; void + resubmit for corrections
  createdAt:               Date;
}
```

#### Cell Access Guard

```typescript
// packages/cell-service/src/http/middleware/cellAccessGuard.ts
export function requireCellAccess(level: 'read' | 'write' | 'report') {
  return async (req: Request, _: Response, next: NextFunction) => {
    const { uid, roles } = (req as AuthenticatedRequest).principal;
    const cell = await req.app.locals.cellRepo.findById(req.params.id);
    if (!cell) return next(createHttpError(404, 'CELL_NOT_FOUND', 'Cell not found.'));

    const isAdmin  = roles.some(r => ['admin','super_admin'].includes(r));
    const isLeader = cell.leaderUid === uid;
    const isG12    = cell.g12LeaderUid === uid;
    const isMember = cell.members.includes(uid);

    if (level === 'read'   && !(isMember || isLeader || isG12 || isAdmin))
      return next(createHttpError(403, 'FORBIDDEN', 'No access to this cell.'));
    if (level === 'write'  && !(isLeader || isG12 || isAdmin))
      return next(createHttpError(403, 'FORBIDDEN', 'Leaders or admins only.'));
    // SRS §9.3: admin CANNOT file — only leader, g12, super_admin
    if (level === 'report' && !(isLeader || isG12 || roles.includes('super_admin')))
      return next(createHttpError(403, 'FORBIDDEN',
        'Only cell leader, G12, or super_admin may file a report. Regular admin cannot.'));

    (req as any).cell = cell;
    next();
  };
}
```

#### File Cell Report Use Case — Idempotent (NEW)

```typescript
// packages/cell-service/src/application/useCases/FileCellReportUseCase.ts
export class FileCellReportUseCase {
  async execute(cellId: string, actorUid: string,
    clientReqId: string, input: FileReportInput): Promise<CellReport> {

    // FR-CR-015: same clientReqId returns existing report (offline retry safety)
    const existing = await this.reportRepo.findByClientReqId(cellId, clientReqId);
    if (existing) return existing;

    const db = getFirestore();
    const reportRef = db.collection('cell_groups').doc(cellId)
                        .collection('cell_reports').doc();
    const report = { id: reportRef.id, cellId, filledByUid: actorUid, // FR-CR-002: system-populated
      clientReqId, ...input, voided: false, createdAt: new Date() };

    await db.runTransaction(async (txn) => {
      txn.set(reportRef, report);
      // FR-CG-007: atomic counter increment
      txn.update(this.cellRepo.docRef(cellId), {
        reportCount: FieldValue.increment(1),
        updatedAt:   FieldValue.serverTimestamp(),
      });
      this.eventPublisher.writeToOutbox(txn, 'cell_report.filed',
        { cellId, reportId: reportRef.id, filledByUid: actorUid, date: input.date });
    });
    return report as CellReport;
  }
}
```

---

### 5.11 Analytics Service (NEW)

**Port:** 3011 | **Owns:** `analytics_snapshots`

Read-only for external clients. Writes only from Scheduled Jobs via internal endpoint. Satisfies NFR-PER-003 (<2 s dashboard latency) by reading pre-aggregated snapshots, never raw cell reports.

#### AnalyticsSnapshot Entity

```typescript
// packages/analytics-service/src/domain/entities/AnalyticsSnapshot.ts
export interface AnalyticsSnapshot {
  id:        string;   // `${scope}_${periodKey}`
  scope:     `leader:${string}` | `g12:${string}` | 'org';
  periodKey: string;   // 'YYYY-WW' (weekly) | 'YYYY-MM' (monthly)
  metrics: {
    // Cell volume — FR-ANL-001
    cellCount:      number;   // total cells in scope
    activeCells:    number;   // cells that filed ≥1 report this period
    reportCount:    number;   // total reports filed

    // Attendance — FR-ANL-002
    attendance: {
      present:     number;
      absent:      number;
      visitors:    number;
      children:    number;
      newAttendees: number;
    };

    // Meeting-type breakdown — FR-ANL-002
    meetingTypeBreakdown: {
      g12:      number;
      care:     number;
      children: number;
      outreach: number;
    };

    // Growth & participation — FR-ANL-003
    memberGrowth:      number;   // net new members added in this period
    participationRate: number;   // active-cells / total-cells (0–1)

    // Per-leader participation — FR-ANL-003
    perLeader?: Array<{
      leaderUid:          string;
      leaderName:         string;
      cellCount:          number;
      averageAttendance:  number;
    }>;

    // Satisfaction average — derived from FR-CR-013
    averageSatisfaction: number; // 1–5
  };
  computedAt: Date;
  computedBy: string;  // 'job:weekly-snapshot' | 'job:monthly-snapshot'
}
```

#### Scope Resolution

```typescript
function resolveScope(principal: Principal): string {
  if (principal.roles.some(r => ['admin','super_admin'].includes(r))) return 'org';
  if (principal.roles.includes('g12'))    return `g12:${principal.uid}`;
  if (principal.roles.includes('leader')) return `leader:${principal.uid}`;
  throw createHttpError(403, 'FORBIDDEN', 'No analytics scope for this role.');
}
```

#### Client Endpoints

| Method | Path | Roles |
|--------|------|:-----:|
| GET | `/api/v1/analytics/cells/weekly` | leader+, g12+, admin+ |
| GET | `/api/v1/analytics/attendance` | leader+, g12+, admin+ |
| GET | `/api/v1/analytics/meeting-types` | leader+, g12+, admin+ |
| GET | `/api/v1/analytics/growth` | g12, admin+ |
| GET | `/api/v1/analytics/participation` | g12, admin+ |
| GET | `/api/v1/analytics/:chart/export` | g12, admin+ |

#### Internal Endpoints (Scheduled Jobs only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/snapshots` | Upsert one snapshot document |
| GET | `/internal/snapshots/missing` | List period keys with no snapshot |

---

### 5.12 Scheduled Jobs Runner (NEW)

**Port:** 3012 | No Firestore ownership | Cloud Run with `--no-cpu-throttling`.

| Job | Schedule (UTC) | Action |
|-----|:--------------|--------|
| `semester-sweep` | Daily 00:15 | Disable semesters past `endDate` (FR-CRS-004) |
| `weekly-snapshot` | Monday 00:30 | Compute weekly analytics snapshot for previous ISO week |
| `monthly-snapshot` | 1st of month 00:45 | Compute monthly analytics snapshot |
| `batch-window-close` | Daily 01:00 | Set `state='closed'` on batches with `intakeEnd < now` |
| `notification-fanout` | Every 5 min | Process broadcast notification queue |

```typescript
// packages/jobs-runner/src/jobs/semesterSweepJob.ts
export async function semesterSweepJob() {
  const snapshot = await getFirestore()
    .collectionGroup('semesters')
    .where('status', '==', 'active')
    .where('endDate', '<=', new Date())
    .limit(500)
    .get();

  const batch = getFirestore().batch();
  snapshot.docs.forEach(doc =>
    batch.update(doc.ref, { status: 'disabled', updatedAt: new Date() }));
  await batch.commit();
  logger.info({ disabled: snapshot.size }, 'Semester sweep complete');
}

// packages/jobs-runner/src/jobs/weeklySnapshotJob.ts
export async function weeklySnapshotJob() {
  const lastWeek  = startOfISOWeek(subWeeks(new Date(), 1));
  const periodKey = `${getISOWeekYear(lastWeek)}-W${String(getISOWeek(lastWeek)).padStart(2,'0')}`;
  const periodEnd = addWeeks(lastWeek, 1);
  const reports   = await cellClient.getReportsByPeriod(lastWeek, periodEnd);

  for (const [scope, sr] of Object.entries(groupByLeader(reports)))
    await analyticsClient.upsertSnapshot({ scope, periodKey, metrics: computeMetrics(sr) });
  for (const [scope, sr] of Object.entries(groupByG12(reports)))
    await analyticsClient.upsertSnapshot({ scope, periodKey, metrics: computeMetrics(sr) });
  await analyticsClient.upsertSnapshot({ scope: 'org', periodKey, metrics: computeMetrics(reports) });
  logger.info({ periodKey, reportCount: reports.length }, 'Weekly snapshot complete');
}
```

---

### 5.13 Outbox Worker (Carry-forward)

**Port:** 3009 | Unchanged from V1. Polls `outbox` every 5 seconds. Dispatch table gains new V2 event types. No structural changes.

---

## 6. Inter-Service Communication

### Synchronous Call Map (V2)

| Caller | Callee | Purpose | V1/V2 |
|--------|--------|---------|:-----:|
| Auth Service | User Service | Email uniqueness on registration | V1 |
| Enrollment Service | User Service | Add `student` role on approval | **Amended** |
| Enrollment Service | Course Service | Validate batch intake window on approval | **NEW** |
| Progress Service | Course Service | Get subject count for aggregate % | V1 |
| Progress Service | Course Service | Check semester `endDate` on completion | **NEW** |
| Storage Service | Course Service | Verify subject exists before upload | V1 |
| Cell Service | User Service | Resolve member display names | **NEW** |
| Scheduled Jobs | Cell Service | Pull reports by period for snapshot | **NEW** |
| Scheduled Jobs | Analytics Service | Upsert snapshots | **NEW** |

All internal calls use `@shared/internal-http-client`:

```typescript
// packages/shared/internal-http-client/src/index.ts
export function createInternalClient(serviceUrl: string, serviceKey: string): AxiosInstance {
  const client = axios.create({
    baseURL: serviceUrl, timeout: 5000,
    headers: { 'X-Internal-Service-Key': serviceKey, 'Content-Type': 'application/json' },
  });
  // Carry X-Request-Id for distributed tracing
  client.interceptors.request.use(cfg => {
    const requestId = getRequestId();
    if (requestId) cfg.headers['X-Request-Id'] = requestId;
    return cfg;
  });
  // Single retry on 5xx with 500 ms backoff
  client.interceptors.response.use(r => r, async error => {
    if (!error.config._retried && error.response?.status >= 500) {
      error.config._retried = true;
      await new Promise(r => setTimeout(r, 500));
      return client(error.config);
    }
    throw error;
  });
  return client;
}
```

---

## 7. Event Bus — Domain Events V2

V2 retains the **Transactional Outbox Pattern** from V1. No external broker.

### Full Domain Events Catalogue

| Event | Publisher | Consumers | V1/V2 |
|-------|-----------|-----------|:-----:|
| `user.registered` | Auth | User, Notification, Audit | **Amended** (more fields) |
| `user.federated_linked` | Auth | User, Audit | **NEW** |
| `user.roles_changed` | User | Notification, Audit | **NEW** |
| `registration.approved` | Enrollment | Notification, Audit | V1 |
| `registration.rejected` | Enrollment | Notification, Audit | V1 |
| `role.requested` | Enrollment | Notification, Audit | **NEW** |
| `role.granted` | Enrollment | Notification, Audit | **NEW** |
| `role.rejected` | Enrollment | Notification, Audit | **NEW** |
| `enrollment.pending` | Enrollment | Notification, Audit | V1 |
| `enrollment.approved` | Enrollment | Notification, Audit | **Amended** (adds batchId) |
| `enrollment.rejected` | Enrollment | Notification, Audit | **Amended** |
| `enrollment.withdrawn` | Enrollment | Audit | V1 |
| `course.published` | Course | Notification, Audit | V1 |
| `batch.created` | Course | Audit | **NEW** |
| `batch.window_closed` | Jobs | Notification, Audit | **NEW** |
| `semester.disabled` | Jobs | Notification, Audit | **NEW** |
| `progress.subjectCompleted` | Progress | Audit | **Amended** (adds batchId) |
| `cell.created` | Cell | Audit | **NEW** |
| `cell.member_added` | Cell | Notification, Audit | **NEW** |
| `cell.member_removed` | Cell | Notification, Audit | **NEW** |
| `cell_report.filed` | Cell | Notification (fan-out), Audit | **NEW** |
| `cell_report.voided` | Cell | Audit | **NEW** |
| `admin.created` | User | Audit | V1 |
| `admin.suspended` | User | Notification, Audit | V1 |
| `audit.action` | Any service | Audit | V1 |

### Event Schema (unchanged from V1)

```typescript
// packages/shared/events/src/types.ts
export interface DomainEvent<T = Record<string, unknown>> {
  id:         string;   // UUID v4 — deduplication key
  type:       string;   // e.g. 'cell_report.filed'
  occurredAt: string;   // ISO 8601 timestamp
  requestId:  string;   // Correlation ID from X-Request-Id
  payload:    T;
}
```

---

## 8. Project Directory Structure

npm-workspaces monorepo. V1 packages carry forward. New V2 packages annotated.

```
tccr-backend/
├── packages/
│   ├── gateway/                       # :3000  Extended
│   ├── auth-service/                  # :3001  Extended
│   │   └── src/application/useCases/
│   │       ├── RegisterUseCase.ts            (Amended)
│   │       ├── FederatedSignInUseCase.ts     (NEW)
│   │       ├── LinkProviderUseCase.ts        (NEW)
│   │       └── TrackLoginAttemptsUseCase.ts  (V1 carry-forward)
│   ├── user-service/                  # :3002  Extended
│   │   └── src/application/useCases/
│   │       ├── CreateAdminUseCase.ts         (V1 carry-forward)
│   │       ├── UpdateUserRolesUseCase.ts     (NEW)
│   │       ├── RegisterFcmTokenUseCase.ts    (NEW)
│   │       └── UpdateNotifPrefsUseCase.ts    (NEW)
│   ├── course-service/                # :3003  Extended
│   │   └── src/
│   │       ├── application/useCases/
│   │       │   ├── PublishCourseUseCase.ts   (V1 carry-forward)
│   │       │   ├── CreateBatchUseCase.ts     (NEW)
│   │       │   ├── UpdateBatchUseCase.ts     (NEW)
│   │       │   └── CloseBatchUseCase.ts      (NEW)
│   │       ├── domain/entities/
│   │       │   ├── Course.ts                 (V1)
│   │       │   ├── Semester.ts               (Amended)
│   │       │   ├── Subject.ts                (Amended)
│   │       │   ├── Lesson.ts                 (V1)
│   │       │   └── Batch.ts                  (NEW)
│   │       └── domain/valueObjects/
│   │           └── YouTubeVideoId.ts         (V1 carry-forward)
│   ├── enrollment-service/            # :3004  Extended (significantly)
│   │   └── src/
│   │       ├── application/useCases/
│   │       │   ├── CreateEnrollmentUseCase.ts       (V1)
│   │       │   ├── ApproveRegistrationUseCase.ts    (V1)
│   │       │   ├── RejectRegistrationUseCase.ts     (V1)
│   │       │   ├── BulkApproveRegistrationsUseCase.ts (V1)
│   │       │   ├── ApproveEnrollmentUseCase.ts      (V1)
│   │       │   ├── RejectEnrollmentUseCase.ts       (V1)
│   │       │   ├── WithdrawEnrollmentUseCase.ts     (V1)
│   │       │   ├── SubmitRoleRequestUseCase.ts      (NEW)
│   │       │   ├── ApproveRoleRequestUseCase.ts     (NEW)
│   │       │   └── RejectRoleRequestUseCase.ts      (NEW)
│   │       └── domain/entities/
│   │           ├── Enrollment.ts                    (Amended)
│   │           └── RoleRequest.ts                   (NEW)
│   ├── progress-service/              # :3005  Minor extension
│   ├── storage-service/               # :3006  MIME list + image endpoint
│   ├── notification-service/          # :3007  Localised + new handlers
│   ├── audit-service/                 # :3008  New per-user endpoint
│   ├── outbox-worker/                 # :3009  Carry-forward
│   │
│   ├── cell-service/                  # :3010  NEW
│   │   └── src/
│   │       ├── app.ts
│   │       ├── http/
│   │       │   ├── routes/
│   │       │   │   ├── cell.routes.ts
│   │       │   │   └── cellReport.routes.ts
│   │       │   ├── controllers/
│   │       │   │   ├── CellController.ts
│   │       │   │   └── CellReportController.ts
│   │       │   └── middleware/
│   │       │       └── cellAccessGuard.ts
│   │       ├── application/useCases/
│   │       │   ├── CreateCellGroupUseCase.ts
│   │       │   ├── AddMembersUseCase.ts
│   │       │   ├── RemoveMemberUseCase.ts
│   │       │   ├── FileCellReportUseCase.ts
│   │       │   ├── VoidCellReportUseCase.ts
│   │       │   └── ArchiveCellUseCase.ts
│   │       ├── domain/entities/
│   │       │   ├── CellGroup.ts
│   │       │   └── CellReport.ts
│   │       └── infrastructure/repositories/
│   │           ├── FirestoreCellRepository.ts
│   │           └── FirestoreCellReportRepository.ts
│   │
│   ├── analytics-service/             # :3011  NEW
│   │   └── src/
│   │       ├── app.ts
│   │       ├── http/routes/
│   │       │   ├── analytics.routes.ts
│   │       │   └── internal.routes.ts
│   │       └── application/useCases/
│   │           ├── GetWeeklyCellsUseCase.ts
│   │           ├── GetAttendanceTrendUseCase.ts
│   │           ├── GetMeetingTypesUseCase.ts
│   │           ├── GetGrowthUseCase.ts
│   │           ├── ExportCsvUseCase.ts
│   │           └── UpsertSnapshotUseCase.ts
│   │
│   ├── jobs-runner/                   # :3012  NEW
│   │   └── src/
│   │       ├── worker.ts
│   │       └── jobs/
│   │           ├── semesterSweepJob.ts
│   │           ├── weeklySnapshotJob.ts
│   │           ├── monthlySnapshotJob.ts
│   │           ├── batchWindowCloseJob.ts
│   │           └── notificationFanoutJob.ts
│   │
│   └── shared/
│       ├── auth-middleware/           # AMENDED — roles[] union matching + V1 fallback
│       ├── errors/                    # Carry-forward
│       ├── events/                    # AMENDED — new event-type constants
│       ├── i18n/                      # NEW
│       │   ├── src/
│       │   │   ├── index.ts
│       │   │   ├── localeResolver.ts
│       │   │   └── templateRenderer.ts
│       │   └── locales/
│       │       ├── en/{ common.json, notifications.json }
│       │       ├── si/{ common.json, notifications.json }
│       │       └── ta/{ common.json, notifications.json }
│       ├── internal-http-client/      # Carry-forward
│       ├── logger/                    # Carry-forward
│       ├── response/                  # Carry-forward
│       ├── health/                    # Carry-forward
│       ├── firebase/                  # Carry-forward
│       └── tracing/                   # Carry-forward
│
├── migrations/                        # NEW — one-shot Cloud Run Jobs
│   ├── 001-roles-array.ts
│   ├── 002-custom-claims.ts
│   ├── 003-language-backfill.ts
│   ├── 004-providers-backfill.ts
│   ├── 005-legacy-batches.ts
│   ├── 006-semester-dates.ts
│   └── 007-notification-locale.ts
│
├── firestore.rules                    # AMENDED
├── firestore.indexes.json             # AMENDED
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── package.json                       # Workspace root
├── tsconfig.base.json
└── turbo.json
```

---

## 9. API Gateway — Routing & Middleware

### Middleware Stack (unchanged from V1)

```
Inbound Request
    |
    v
[1] TLS Termination (load balancer, before Gateway)
    |
    v
[2] Helmet — security headers (X-Frame-Options, X-Content-Type-Options, etc.)
    |
    v
[3] CORS — origin allowlist; no wildcard in production
    |
    v
[4] Request ID Middleware — inject X-Request-Id (UUID v4) if absent
    |
    v
[5] Structured Request Logger (pino-http)
    |
    v
[6] Rate Limiter — per-IP; stricter on /auth/*
    |
    v
[7] Proxy — forward to correct downstream service with all headers intact
    |
    v
Downstream Service
```

### Rate Limiter Configuration (unchanged from V1)

```typescript
// packages/gateway/src/middleware/rateLimiter.ts
export const rateLimiter = rateLimit({
  windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.' } },
});

export const authRateLimiter = rateLimit({
  windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many login attempts.' } },
});
```

### Request ID Middleware (unchanged from V1)

```typescript
// packages/gateway/src/middleware/requestId.ts
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
```

---

## 10. Authentication & Authorisation Flow V2

### Full Request Flow (V2 example)

```
Client
  POST /api/v1/role-requests
  Authorization: Bearer <firebase-id-token>
  Accept-Language: si
  X-Request-Id: <uuid>
       |
       v
API Gateway
  +- Rate limit check -> pass
  +- CORS check -> pass
  +- Add X-Request-Id if absent
  +- Proxy to Enrollment Service :3004
         |
         v
Enrollment Service — shared auth middleware pipeline:

  [1] authenticate() middleware
       -> extract Bearer token from Authorization header
       -> admin.auth().verifyIdToken(token, checkRevoked=true)
       -> V2: decoded.roles = ['member']   (array, not scalar)
       -> decoded.preferredLanguage = 'si'
       -> attach principal = { uid, email, roles:['member'], preferredLanguage:'si' }

  [2] authorize('member') middleware
       -> 'member' ∈ ['member'] -> PASS

  [3] localeMiddleware()
       -> req.locale = 'si'

  [4] validateBody(submitRoleRequestSchema)
       -> { courseId, batchId, requestedRole: 'student' }

  [5] SubmitRoleRequestUseCase.execute()
       -> writes role_request + outbox entry atomically

  [6] Response: 201 { id, status:'pending', ... }
```

### RBAC Route Definition Pattern (V2 — with locale middleware)

```typescript
// packages/enrollment-service/src/http/routes/roleRequest.routes.ts
import { authenticate, authorize } from '@shared/auth-middleware';
import { localeMiddleware } from '@shared/i18n';

const router = Router();
router.use(authenticate());
router.use(localeMiddleware());

router.post('/role-requests',
  authorize('member'), RoleRequestController.submit);
router.get('/role-requests/mine',
  authorize('member'), RoleRequestController.mine);
router.get('/role-requests',
  authorize('admin'), RoleRequestController.list);
router.get('/role-requests/:id',
  authorize('admin'), RoleRequestController.getById);
router.post('/role-requests/:id/approve',
  authorize('admin'), RoleRequestController.approve);
router.post('/role-requests/:id/reject',
  authorize('admin'), RoleRequestController.reject);

export { router as roleRequestRouter };
```

### Resource Ownership Guard (V2 — updated for roles[])

```typescript
// packages/shared/auth-middleware/src/ownershipGuard.ts
export function mustBeOwnerOrAdmin(getResourceUid: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = (req as AuthenticatedRequest).principal;
    const resourceUid = getResourceUid(req);
    if (!resourceUid) return next();

    const isOwner = p.uid === resourceUid;
    // V2: check roles[] instead of scalar role
    const isAdmin = p.roles.some(r => r === 'admin' || r === 'super_admin');

    if (!isOwner && !isAdmin)
      return next(createHttpError(403, 'FORBIDDEN',
        'You do not have access to this resource.'));
    next();
  };
}
```

---

## 11. Data Architecture — Firestore Per Service

Each service **owns** its Firestore collections. No service reads another service's collections directly.

### Collection Ownership Map (V2)

| Collection | Owning Service | New V2? | Notes |
|-----------|---------------|:-------:|-------|
| `users` | User Service | — | `role:string` → `roles:string[]` |
| `role_requests` | Enrollment Service | ✅ | |
| `audit_log` | Audit Service | — | Per-user view added; `before`/`after` fields added |
| `outbox` | All write; Outbox Worker reads | — | Unchanged |
| `courses` | Course Service | — | Gains `batchCount` |
| `courses/{id}/batches` | Course Service | ✅ | |
| `courses/{id}/semesters` | Course Service | — | Gains `openDate`, `endDate` |
| `courses/{id}/semesters/{id}/subjects` | Course Service | — | Gains `imageUrls[]` |
| `enrollments` | Enrollment Service | — | ID changes to `${uid}_${batchId}`; gains `batchId`, `roleRequestId` |
| `progress` | Progress Service | — | Gains `batchId` |
| `notifications` | Notification Service | — | Gains `localeRendered` |
| `cell_groups` | Cell Service | ✅ | |
| `cell_groups/{id}/cell_reports` | Cell Service | ✅ | Immutable once filed |
| `analytics_snapshots` | Analytics Service | ✅ | |
| `loginAttempts` | Auth Service | — | |
| `otps` | Auth Service | — | |

### Firestore Repository Pattern (unchanged from V1)

```typescript
// packages/course-service/src/infrastructure/repositories/FirestoreCourseRepository.ts
export class FirestoreCourseRepository implements ICourseRepository {

  async findById(id: string): Promise<Course | null> {
    const doc = await db.collection('courses').doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.id, doc.data()!);
  }

  async findPublished(limit: number, cursor?: string) {
    let query = db.collection('courses')
      .where('state', '==', 'published')
      .where('deletedAt', '==', null)
      .orderBy('publishedAt', 'desc')
      .limit(limit + 1);
    if (cursor) {
      const cursorDoc = await db.collection('courses').doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.get();
    const items = snapshot.docs.slice(0, limit).map(d => this.toDomain(d.id, d.data()));
    return { items, nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null };
  }

  async create(course: Course): Promise<void> {
    await db.collection('courses').doc(course.id).set({
      ...this.toFirestore(course),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async softDelete(id: string): Promise<void> {
    await db.collection('courses').doc(id).update({
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
```

### V2 Composite Indexes (additions to firestore.indexes.json)

```json
{
  "indexes": [
    { "collectionGroup": "users",
      "fields": [{"fieldPath":"roles","arrayConfig":"CONTAINS"},
                 {"fieldPath":"status","order":"ASCENDING"},
                 {"fieldPath":"createdAt","order":"DESCENDING"}] },
    { "collectionGroup": "role_requests",
      "fields": [{"fieldPath":"status","order":"ASCENDING"},
                 {"fieldPath":"courseId","order":"ASCENDING"},
                 {"fieldPath":"createdAt","order":"DESCENDING"}] },
    { "collectionGroup": "enrollments",
      "fields": [{"fieldPath":"batchId","order":"ASCENDING"},
                 {"fieldPath":"status","order":"ASCENDING"}] },
    { "collectionGroup": "cell_groups",
      "fields": [{"fieldPath":"leaderUid","order":"ASCENDING"},
                 {"fieldPath":"state","order":"ASCENDING"},
                 {"fieldPath":"name","order":"ASCENDING"}] },
    { "collectionGroup": "cell_groups",
      "fields": [{"fieldPath":"g12LeaderUid","order":"ASCENDING"},
                 {"fieldPath":"state","order":"ASCENDING"}] },
    { "collectionGroup": "cell_reports",
      "fields": [{"fieldPath":"date","order":"DESCENDING"},
                 {"fieldPath":"voided","order":"ASCENDING"}] },
    { "collectionGroup": "analytics_snapshots",
      "fields": [{"fieldPath":"scope","order":"ASCENDING"},
                 {"fieldPath":"periodKey","order":"DESCENDING"}] },
    { "collectionGroup": "audit_log",
      "fields": [{"fieldPath":"actorUid","order":"ASCENDING"},
                 {"fieldPath":"createdAt","order":"DESCENDING"}] }
  ]
}
```

### Firestore Security Rules (V2 — summary)

| Collection | Rule |
|-----------|------|
| `users` | Read by self or admin+; `roles[]` writable only by admin/super_admin |
| `role_requests` | Created by member; read by requester or admin+; state transitions by admin+ |
| `courses`, `batches`, `semesters`, `subjects` | Read by any authenticated; write by admin+ |
| `enrollments` | Read by owner or admin+; created by owner; status writes by admin+ |
| `cell_groups` | Read by member/leader/g12/admin+; write by leader (own), g12 (network), admin+ |
| `cell_reports` | Read by cell reader set; created by leader/g12 of cell or super_admin; `voided` by leader+/admin+ |
| `analytics_snapshots` | Read by authorised dashboard role; write by jobs service account only |
| `audit_log` | Read by admin+; append-only; Firestore Rules deny updates/deletes |
| `notifications` | Read and `readAt` update by recipient only; created by API service account |

---

## 12. Localisation — @shared/i18n (NEW)

```typescript
// packages/shared/i18n/src/localeResolver.ts
export function localeMiddleware() {
  return (req: Request, _: Response, next: NextFunction) => {
    const fromHeader = req.headers['accept-language']?.split(',')[0]?.split('-')[0];
    const fromToken  = (req as AuthenticatedRequest).principal?.preferredLanguage;
    const SUPPORTED  = ['si', 'ta', 'en'];
    (req as any).locale =
      SUPPORTED.find(l => l === fromToken) ??
      SUPPORTED.find(l => l === fromHeader) ??
      'en';
    next();
  };
}

// packages/shared/i18n/src/templateRenderer.ts
export function resolveTemplate(
  key: string, locale: string, vars: Record<string, string>
): { title: string; body: string; emailSubject: string; emailBody: string } {
  const t = i18next.getFixedT(locale, 'notifications');
  return {
    title:        t(`${key}.title`,        vars),
    body:         t(`${key}.body`,         vars),
    emailSubject: t(`${key}.emailSubject`, vars),
    emailBody:    t(`${key}.emailBody`,    vars),
  };
}
```

### Translation File Structure

```json
// packages/shared/i18n/locales/en/notifications.json
{
  "role.granted": {
    "title":        "Role Granted",
    "body":         "You are now a {{role}} in the TCCR system.",
    "emailSubject": "Your TCCR role has been updated",
    "emailBody":    "Dear {{name}}, your role has been updated to {{role}} by {{approverName}}."
  },
  "enrollment.approved": {
    "title":        "Enrollment Approved",
    "body":         "You are enrolled in {{courseName}}, {{batchName}}.",
    "emailSubject": "Enrollment confirmed — {{courseName}}",
    "emailBody":    "Dear {{name}}, your enrollment in {{courseName}} ({{batchName}}) has been approved by {{approverName}}."
  },
  "cell_report.filed": {
    "title":        "Cell Report Filed",
    "body":         "A report was filed for your cell {{cellName}}.",
    "emailSubject": "Cell report filed — {{cellName}}",
    "emailBody":    "A new report was submitted for {{cellName}} on {{date}}."
  }
}
```

> Sinhala (`si/`) and Tamil (`ta/`) locale files follow the same structure. CI fails if any key present in `en/` is absent from `si/` or `ta/` (FR-I18N-005).

---

## 13. Transactional Outbox Pattern

Unchanged from V1. Events are written atomically with primary data in the same Firestore transaction. The Outbox Worker polls every 5 seconds and retries up to 5 times with exponential backoff.

```typescript
// packages/shared/events/src/OutboxEventPublisher.ts
export class OutboxEventPublisher {
  // Used outside a transaction (most cases)
  async publish(type: string, payload: unknown, requestId: string): Promise<void> {
    await getFirestore().collection('outbox').doc().set({
      id: uuidv4(), eventType: type, payload, requestId,
      status: 'pending', attempts: 0, createdAt: new Date(),
    });
  }

  // Used INSIDE Firestore transactions (atomic with business data)
  writeToOutbox(txn: Transaction, type: string, payload: unknown): void {
    const ref = getFirestore().collection('outbox').doc();
    txn.set(ref, {
      id: uuidv4(), eventType: type, payload,
      status: 'pending', attempts: 0, createdAt: new Date(),
    });
  }
}
```

---

## 14. Error Handling & Response Contracts

### Standard Error Envelope (unchanged from V1)

```json
{
  "error": {
    "code":    "BATCH_CLOSED",
    "message": "Target batch has closed its intake window.",
    "details": { "batchId": ["Intake window closed on 2026-04-30"] }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

### V2 New Error Codes

| Code | Status | Description |
|------|:------:|-------------|
| `FEDERATED_TOKEN_INVALID` | 401 | Google or Apple token failed verification |
| `EMAIL_NOT_VERIFIED` | 401 | Federated sign-in with unverified email |
| `SEMESTER_DISABLED` | 403 | Semester's endDate passed; student not enrolled before cutoff |
| `BATCH_NOT_FOUND` | 404 | Batch not found |
| `ROLE_REQUEST_NOT_FOUND` | 404 | Role request not found |
| `CELL_NOT_FOUND` | 404 | Cell group not found |
| `CELL_REPORT_NOT_FOUND` | 404 | Cell report not found |
| `LAST_SUPER_ADMIN` | 409 | Cannot demote the only remaining Super Admin (FR-SADM-004) |
| `ROLE_REQUEST_PENDING` | 409 | Pending role request already exists for this course |
| `REPORT_ALREADY_VOIDED` | 409 | Report has already been voided |
| `BATCH_CLOSED` | 422 | Batch intake window has passed at time of admin approval (FR-ENR-004) |

All V1 error codes (`VALIDATION_ERROR`, `INVALID_OTP`, `EMAIL_EXISTS`, etc.) are preserved unchanged.

### Global Error Handler (unchanged from V1)

```typescript
// packages/shared/errors/src/errorHandler.ts
export function errorHandler(err: any, req: Request, res: Response, _: NextFunction) {
  const status = err.status ?? 500;
  const code   = err.code   ?? 'INTERNAL_ERROR';
  const message = status === 500 ? 'An unexpected error occurred.' : err.message;
  // Never leak stack traces to clients
  res.status(status).json({
    error: { code, message, ...(err.details ? { details: err.details } : {}) },
    requestId: (req as any).requestId ?? '',
  });
  if (status === 500) logger.error({ err, requestId: (req as any).requestId }, 'Unhandled error');
}
```

---

## 15. Security Implementation

### OWASP Top 10 Mitigations (V2)

| Risk | Mitigation |
|------|-----------|
| A01 Broken Access Control | `authenticate()` + `authorize()` on every route; cell access guard; ownership guard; CI regression tests |
| A02 Cryptographic Failures | TLS 1.2+ everywhere; Firebase-managed credential hashing; federated tokens discarded immediately after exchange (NFR-SEC-006) |
| A03 Injection | Typed Firestore SDK; Zod validated payloads; no string interpolation in queries |
| A05 Misconfiguration | Hardened Dockerfiles; least-privilege IAM; default-deny Firestore Security Rules |
| A07 Auth Failures | Firebase abuse detection; account lockout after 5 failures in 15 min (FR-AUTH-009); `checkRevoked=true` on all token verifications |
| A09 Logging Failures | Pino structured logs; OpenTelemetry traces; 5xx rate alerts; `audit_log` append-only |

### Account Lockout (FR-AUTH-009 — V1 carry-forward, threshold updated)

```typescript
// packages/auth-service/src/application/useCases/TrackLoginAttemptsUseCase.ts
const LOCKOUT_THRESHOLD = 5;       // V2 SRS: 5 attempts (was 10 in V1 SRS)
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes

export class TrackLoginAttemptsUseCase {
  async execute(email: string): Promise<{ locked: boolean; attempts: number }> {
    const record = await this.loginAttemptsRepo.increment(email, LOCKOUT_WINDOW_MS);
    if (record.attempts >= LOCKOUT_THRESHOLD && !record.locked) {
      await this.loginAttemptsRepo.lock(email);
      await this.notificationClient.notifyLockout(email);
    }
    return { locked: record.attempts >= LOCKOUT_THRESHOLD, attempts: record.attempts };
  }
}
```

---

## 16. Observability — Logging, Metrics, Tracing

### Structured Logging (Pino — unchanged from V1)

```typescript
// packages/shared/logger/src/index.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization', '*.password', '*.token',
      '*.idToken', '*.refreshToken', '*.clientSecret',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: label => ({ level: label }),
  },
});
```

### Alerts — Four Golden Signals (V2 thresholds)

| Signal | Alert Condition |
|--------|----------------|
| Latency | p95 GET latency > 800 ms for 5-min window (NFR-PER-001) |
| Traffic | 3× spike in requests/min (anomaly detection) |
| Errors | 5xx error rate > 1% for any service for 2 min |
| Saturation | CPU > 80% or memory > 85% for 5 min |

---

## 17. Scalability & Deployment

### Environments

Three environments: `development`, `staging`, `production`. Each has its own Firebase project (isolated Firestore, Auth, Storage, FCM). CI/CD via GitHub Actions; infrastructure via Terraform.

### Dockerfile Pattern (unchanged from V1)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY packages/[service-name] ./packages/[service-name]
RUN npm ci --workspace=packages/[service-name] --include-workspace-root
RUN npm run build --workspace=packages/[service-name]

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/[service-name]/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Cloud Run Configuration (per service)

```yaml
resources: { limits: { cpu: "1", memory: "512Mi" } }
scaling:   { minInstances: 0, maxInstances: 10 }
# Cell Service:  minInstances: 1  (mobile traffic is time-sensitive)
# Jobs Runner:   --no-cpu-throttling flag
```

### Local Quick Start (carry-forward from V1)

```bash
# 1. Clone and install
git clone https://github.com/futurecx/tccr-backend.git && cd tccr-backend
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in Firebase credentials + V2 Google/Apple OAuth keys

# 3. Start Firebase emulators
npx firebase emulators:start --only firestore,auth,storage

# 4. Start all services
docker-compose up --build

# 5. Run tests
npm run test               # All unit tests
npm run test:integration   # Requires emulators
npm run test:e2e           # Requires all services running

# 6. Type-check
npm run type-check

# 7. Lint
npm run lint
```

---

## 18. Environment Configuration

```bash
# All services
NODE_ENV=production
SERVICE_NAME=cell-service
SERVICE_VERSION=2.0.0
PORT=3010
FIREBASE_PROJECT_ID=tccr-prod
LOG_LEVEL=info

# Internal service keys (Google Secret Manager)
INTERNAL_SERVICE_KEY=<secret>

# V2 additions — Auth Service only
GOOGLE_CLIENT_ID=<google-oauth-client-id>
APPLE_TEAM_ID=<apple-team-id>
APPLE_KEY_ID=<apple-key-id>
APPLE_PRIVATE_KEY=<apple-p8-key-content>

# V2 additions — Jobs Runner only
CELL_SERVICE_URL=https://cell-service-xxxx.run.app
ANALYTICS_SERVICE_URL=https://analytics-service-xxxx.run.app
OUTBOX_POLL_INTERVAL_SECONDS=5
ANALYTICS_SNAPSHOT_LOOKBACK_WEEKS=12
```

---

## 19. Testing Strategy

```
Unit Tests       → Use cases (mocked repos); domain entities; value objects
Integration Tests → Firestore operations against Firebase emulator
Contract Tests    → Pact consumer/provider for inter-service HTTP calls
Rules Tests       → @firebase/rules-unit-testing for all Firestore Security Rules
E2E Tests         → Full flow per user story (register → request → approve → access cell)
```

### V2 Test Coverage Requirements

| Area | Minimum Coverage |
|------|:---------------:|
| Cell Service use cases | 80% line |
| Analytics Service | 70% line |
| `@shared/auth-middleware` union matching | 100% of role combination permutations |
| `@shared/i18n` template resolution | All 3 locales × all template keys |
| Atomic approval transaction | Happy path + Firestore rollback scenarios |

### Firestore Rules Test Example (V2 — cell reports)

```typescript
// packages/cell-service/src/infrastructure/rules.test.ts
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe('cell_reports Firestore Security Rules', () => {
  it('allows leader to create cell report', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const leaderDb = env.authenticatedContext('leader-uid',
      { roles: ['member','leader'] }).firestore();
    await assertSucceeds(
      leaderDb.collection('cell_groups').doc('cell-1')
        .collection('cell_reports').add({ filledByUid: 'leader-uid', date: '2026-05-15' })
    );
  });

  it('denies regular admin from creating cell report (SRS §9.3)', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const adminDb = env.authenticatedContext('admin-uid',
      { roles: ['member','admin'] }).firestore();
    await assertFails(
      adminDb.collection('cell_groups').doc('cell-1')
        .collection('cell_reports').add({ filledByUid: 'admin-uid', date: '2026-05-15' })
    );
  });

  it('denies updates to existing cell_reports (immutable once filed)', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const leaderDb = env.authenticatedContext('leader-uid',
      { roles: ['member','leader'] }).firestore();
    await assertFails(
      leaderDb.collection('cell_groups').doc('cell-1')
        .collection('cell_reports').doc('report-1')
        .update({ satisfactionRate: 5 })
    );
  });

  it('denies updates to existing audit_log documents (append-only)', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const adminDb = env.authenticatedContext('admin-uid',
      { roles: ['admin'] }).firestore();
    await assertFails(
      adminDb.collection('audit_log').doc('existing-log')
        .update({ action: 'tampered' })
    );
  });
});
```

---

## 20. CI/CD Pipeline

```yaml
# .github/workflows/service-ci.yml
on:
  push:
    paths: ['packages/[service-name]/**', 'packages/shared/**']

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 20.x
      - Install dependencies (npm ci)
      - Type check (tsc --noEmit)
      - Lint (eslint)
      - Unit tests (jest --coverage)
      - Integration tests (jest --config jest.integration.config.ts)
      - Firestore rules tests
      - npm audit (fail on HIGH/CRITICAL)
      - Build Docker image
      - Scan image with Trivy (block on HIGH/CRITICAL CVEs)
      - Push image to Artifact Registry (main branch only)

  i18n-key-parity:          # NEW V2 — FR-I18N-005
    runs-on: ubuntu-latest
    steps:
      - Run scripts/check-i18n-parity.ts
      - Fail build if si/ or ta/ missing any key present in en/

  deploy-staging:
    needs: [build-and-test, i18n-key-parity]
    if: github.ref == 'refs/heads/main'
    steps:
      - Deploy to staging Cloud Run (health-check gated)
      - Run E2E smoke tests against staging

  deploy-production:
    needs: deploy-staging
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - Deploy to production Cloud Run
      - Run production smoke tests
```

---

## 21. V1 → V2 Migration Plan

### Phase 1 — Schema Migration (before code deploy, idempotent one-shot scripts)

| ID | Script | What it does |
|----|--------|-------------|
| M1 | `001-roles-array.ts` | `users.role:string` → `users.roles:string[]`; keep scalar `role` temporarily |
| M2 | `002-custom-claims.ts` | Firebase Auth: `{role:'X'}` → `{roles:['X','member'], preferredLanguage:'en'}` for every user |
| M3 | `003-language-backfill.ts` | Set `preferredLanguage='en'` on all user docs where missing |
| M4 | `004-providers-backfill.ts` | Set `providers:['password']` for all existing email/password users |
| M5 | `005-legacy-batches.ts` | Create `Legacy` Batch per Course; backfill `enrollments.batchId` with the legacy batch ID |
| M6 | `006-semester-dates.ts` | Set `openDate=createdAt`, `endDate=null` on all existing semesters |
| M7 | `007-notification-locale.ts` | Set `localeRendered='en'` on all existing notification documents |

Each script: Cloud Run Job, idempotent (safe to re-run), processes documents in batches of 500.

### Phase 2 — Service Deploy (rolling, health-check gated)

1. Shared packages (`@shared/auth-middleware`, `@shared/i18n`)
2. User Service (handles both `role` and `roles[]` during transition window)
3. Auth Service (adds federated endpoints; registration creates Member)
4. Course Service (adds Batches; semester dates)
5. Enrollment Service (adds role_requests; V1 registration paths kept active)
6. Progress / Storage / Audit / Notification Services (parallel; backward-compatible)
7. Cell Service (fresh deployment)
8. Analytics Service + Scheduled Jobs (deployed last; backfill 90-day snapshots)
9. Gateway route table update (adds new prefixes)

### Phase 3 — Deprecate V1 Paths (4–6 weeks post Phase 2)

After all clients migrate to V2 endpoints:

- `POST /auth/register` old body (V1 `pending_approval` flow) → `410 Gone` with migration note
- `GET /admin/registrations` → `410 Gone`; use `GET /role-requests`
- `POST /admin/registrations/:id/approve` → `410 Gone`; use `POST /role-requests/:id/approve`
- `POST /admin/registrations/:id/reject` → `410 Gone`
- `POST /admin/registrations/bulk-approve` → `410 Gone`
- `GET /me/enrollments` → `410 Gone`; use `GET /enrollments/mine`
- Drop legacy scalar `role` field from user documents

---

## 22. SRS Requirement Traceability

| SRS ID | Requirement | Service | Implementation |
|--------|-------------|---------|---------------|
| FR-AUTH-001 | Register with optional preferredLanguage → active Member | Auth Service | `RegisterUseCase` (amended) |
| FR-AUTH-002 | Email uniqueness check | Auth Service | User Service `/internal/users/exists` |
| FR-AUTH-003 | Google federated sign-in | Auth Service | `FederatedSignInUseCase('google')` |
| FR-AUTH-004 | Apple federated sign-in | Auth Service | `FederatedSignInUseCase('apple')` |
| FR-AUTH-005 | Email verification on register | Auth Service | `generateEmailVerificationLink()` |
| FR-AUTH-006 | Token revocation on logout | Auth Service | `revokeRefreshTokens(uid)` |
| FR-AUTH-007 | Password policy min 8 chars + letter + number | Auth Service | Zod `registerSchema` |
| FR-AUTH-008 | Inactivity timeout 30 min web | Client-side | Firebase SDK session management |
| FR-AUTH-009 | Lock account 15 min after 5 failed attempts | Auth Service | `TrackLoginAttemptsUseCase` (threshold updated to 5) |
| FR-AUTH-010 | Link/unlink Google and Apple identities | User Service | `POST/DELETE /me/providers/*` |
| FR-MEM-001 | Member views home screen | User Service | `GET /me` returns `roles:['member']` |
| FR-MEM-003 | Member submits role+batch request | Enrollment Service | `SubmitRoleRequestUseCase` |
| FR-MEM-004 | Member views request status | Enrollment Service | `GET /role-requests/mine` |
| FR-MEM-006 | Member views own cell groups | Cell Service | `GET /cells/mine` |
| FR-MEM-007 | Member cannot file cell reports | Cell Service | `requireCellAccess('report')` guard blocks member and admin |
| FR-SADM-001 | Create Admin account | User Service | `POST /super-admin/admins` → `CreateAdminUseCase` |
| FR-SADM-002 | List Admins | User Service | `GET /super-admin/admins` |
| FR-SADM-003 | Promote Member → Leader/G12 | User Service | `PATCH /users/:uid/roles` → `UpdateUserRolesUseCase` |
| FR-SADM-004 | Cannot demote last Super Admin | User Service | Guard in `UpdateUserRolesUseCase` |
| FR-SADM-005 | Super Admin views any user's audit log | Audit Service | `GET /users/:uid/audit-log` |
| FR-SADM-007 | Organisation-wide audit log | Audit Service | `GET /audit-log` with filters |
| FR-ADM-003 | Admin promotes Member → Leader/G12 | User Service | `PATCH /users/:uid/roles` |
| FR-ADM-005 | Admin views per-user audit log | Audit Service | `GET /users/:uid/audit-log` |
| FR-ADM-006 | Admin uploads PNG/JPG images | Storage Service | `imageUpload` multer; `/subjects/:id/images` endpoint |
| FR-ADM-007 | Approve student registration (V1 compat) | Enrollment Service | V1 `ApproveRegistrationUseCase` (deprecated) |
| FR-ADM-008 | Admin cannot approve own requests | Enrollment Service | `ApproveRoleRequestUseCase` self-approval guard |
| FR-ADM-011 | Bulk approve registrations | Enrollment Service | `BulkApproveRegistrationsUseCase` with `Promise.allSettled` |
| FR-CRS-002 | Create Batch under Course | Course Service | `CreateBatchUseCase` |
| FR-CRS-003 | Create Semester with openDate/endDate | Course Service | `CreateSemesterUseCase` (amended) |
| FR-CRS-004 | Semester auto-disables after endDate | Scheduled Jobs | `semesterSweepJob` |
| FR-CRS-005 | Subject imageUrls[] for PNG/JPG | Course Service | `CreateSubjectUseCase` (amended) |
| FR-CRS-008 | Deletion guard for active enrollments | Course Service | Archive/delete use case guards |
| FR-CRS-009 | YouTube URL → 11-char ID validation | Course Service | `YouTubeVideoId.from()` value object (V1 carry-forward) |
| FR-CRS-010 | Attachment MIME + size validation | Storage Service | Multer middleware (carry-forward; PNG/JPG added) |
| FR-ENR-001 | Member submits enrollment with batchId | Enrollment Service | `SubmitRoleRequestUseCase` |
| FR-ENR-003 | Atomic role + enrollment on approval | Enrollment Service | `ApproveRoleRequestUseCase` — single Firestore transaction |
| FR-ENR-004 | Reject if batch intake window closed | Enrollment Service | Guard in `ApproveRoleRequestUseCase` |
| FR-ENR-005 | Notify requestor on approval/rejection with approver name | Notification Service | `role.granted` / `role.rejected` event handlers |
| FR-ENR-008 | Cool-off period after enrollment rejection | Enrollment Service | `ENROLLMENT_REJECTION_COOLOFF_HOURS` check (V1 carry-forward) |
| FR-STU-004 | Already-Student additional batch enrollment | Enrollment Service | `POST /enrollments` (already-student path) |
| FR-STU-005 | Block expired semester access | Progress Service | Semester `endDate` gate in `MarkSubjectCompleteUseCase` |
| FR-STU-006 | Course returns 404 to student if draft/archived | Course Service | `GET /courses/:id` visibility filter |
| FR-STU-007 | Student submits enrollment request | Enrollment Service | `POST /enrollments` |
| FR-STU-011 | Mark subject complete — idempotent | Progress Service | `MarkSubjectCompleteUseCase` — idempotent (V1 carry-forward) |
| FR-STU-013 | Auto-complete on YouTube threshold | Progress Service | `source='auto'` path (V1 carry-forward) |
| FR-LDR-001 | Leader creates Cell Group | Cell Service | `CreateCellGroupUseCase` |
| FR-LDR-002 | Leader manages cell members | Cell Service | `AddMembersUseCase`, `RemoveMemberUseCase` |
| FR-LDR-003 | Leader files Cell Report | Cell Service | `FileCellReportUseCase` |
| FR-G12-002 | G12 files Cell Report for own network | Cell Service | `requireCellAccess('report')` allows g12 |
| FR-G12-003 | G12 promotes Leader to G12 | User Service | `PATCH /users/:uid/roles` |
| FR-G12-004 | G12 views network analytics | Analytics Service | `GET /analytics/*` (g12 scope) |
| FR-CG-001–007 | Cell Group full CRUD + counters | Cell Service | `CellController`, access guard, `FieldValue.increment()` |
| FR-CG-007 | Atomic memberCount/reportCount | Cell Service | `FieldValue.increment()` inside Firestore transaction |
| FR-CR-001–015 | Cell Report full capture | Cell Service | `CellReportController`, `FileCellReportUseCase` |
| FR-CR-002 | filledBy system-populated read-only | Cell Service | Set from `actorUid` in use case; never from client |
| FR-CR-003 | Date defaults to today on mobile | Cell Service | Client-side default; server accepts override |
| FR-CR-009 | G12 from system roster + free-text offline | Cell Service | `g12LeaderUid` + `immediateG12LeaderText` fields |
| FR-CR-014 | Reports immutable; void + resubmit | Cell Service | `VoidCellReportUseCase`; voided flag immutable once true |
| FR-CR-015 | Offline tolerance — idempotent submission | Cell Service | `clientReqId` dedup via `findByClientReqId` |
| FR-ANL-001–004 | Pre-aggregated analytics | Analytics + Jobs | `weeklySnapshotJob`, `AnalyticsController` |
| FR-ANL-005 | CSV export | Analytics Service | `ExportCsvUseCase` |
| FR-NOT-001 | Localised notifications (si/ta/en) | Notification Service | `@shared/i18n`, `NotificationDispatcher` |
| FR-NOT-002 | In-app + email on registration events | Notification Service | `registration.approved/rejected` handlers (V1) |
| FR-NOT-003 | In-app + email + push on enrollment events | Notification Service | `enrollment.approved/rejected` handlers |
| FR-NOT-005 | Notify Leader/G12 on appointment | Notification Service | `user.roles_changed` event handler |
| FR-NOT-006 | Per-channel notification opt-out | User Service | `PATCH /me/notifications/preferences` |
| FR-NOT-009 | Email delivery retry with backoff | Notification Service | `NotificationDispatcher` max 3 retries, exponential backoff (V1 carry-forward) |
| FR-I18N-001–005 | i18n support | All services | `@shared/i18n`, `localeMiddleware()` |
| FR-I18N-005 | CI key-parity check | CI/CD | `check-i18n-parity.ts` job |
| NFR-PER-001 | p95 GET < 800 ms at 50 RPS | All services | Firestore indexed queries |
| NFR-PER-003 | Analytics dashboards < 2 s | Analytics Service | Pre-aggregated snapshots only; never raw scans |
| NFR-SCA-001 | Support 10,000 registered users | All services | Stateless + Cloud Run autoscaling |
| NFR-SCA-002 | 500 concurrent cells, 100k reports/year | Cell Service | Stateless; Firestore native scale |
| NFR-SEC-001 | TLS at load balancer | Gateway | HSTS header in Gateway response |
| NFR-SEC-002 | Token revocation check | All Services | `authenticate(checkRevoked=true)` (V1 carry-forward) |
| NFR-SEC-003 | Route-level RBAC | All Services | `authorize()` per route + `mustBeOwnerOrAdmin()` guard |
| NFR-SEC-006 | Federated tokens discarded after exchange | Auth Service | Token not persisted; `createCustomToken()` immediately returned |
| NFR-SEC-007 | Injection prevention | All Services | Typed Firestore SDK; Zod; no string interpolation |
| NFR-SEC-008 | Rate limiting | Gateway | `authRateLimiter` (10/min) + `rateLimiter` (200/min) |
| NFR-SEC-009 | CORS origin allowlist | Gateway | No wildcard in production |
| NFR-SEC-011 | Audit log append-only | Audit Service | Firestore rules deny updates/deletes on `audit_log` |
| NFR-AVA-004 | Cell reports offline 24h retry | Cell Service | `clientReqId` idempotency; mobile app queues retries |
| NFR-AVL-002 | Liveness + readiness probes | All Services | `/healthz` + `/readyz` per service |
| NFR-AVL-003 | Push/email failures never block API | All Services | Outbox pattern; notifications are async |
| NFR-USA-003 | Cell report completable in < 3 min | Cell Service | Mobile-first form with pre-populated attendance roster |

---

## Appendix A — Shared Package APIs (V2)

| Package | Exports |
|---------|---------|
| `@shared/auth-middleware` | `authenticate()`, `authorize()`, `mustBeOwnerOrAdmin()`, `AuthenticatedRequest`, `Role` |
| `@shared/errors` | `AppError`, `createHttpError()`, `fromZodError()`, `errorHandler` |
| `@shared/events` | `DomainEvent`, `OutboxEventPublisher` |
| `@shared/i18n` | `localeMiddleware()`, `resolveTemplate()` — **NEW V2** |
| `@shared/logger` | `logger` (Pino with PII redaction), `httpLogger` (pino-http) |
| `@shared/response` | `sendSuccess()`, `sendPaginated()` |
| `@shared/internal-http-client` | `createInternalClient()` |
| `@shared/health` | `healthRouter` (`/healthz` + `/readyz`) |
| `@shared/firebase` | `initFirebaseAdmin()` (idempotent) |
| `@shared/tracing` | `initTracing(serviceName)` |

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
*Document version: 2.0.0 | Paired with TCCR SRS v2.0 dated 15 May 2026 and TCCR API Reference v2.0.0*
