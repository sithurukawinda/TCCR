# CMP — Backend Blueprint
## Course Management Portal · `slp-backend`
### Node.js · TypeScript · Express · Microservice Architecture · Firebase · Clean Architecture

**Version:** 1.0.0
**Date:** 07 May 2026
**Organisation:** Future CX Lanka (Pvt) Ltd
**Status:** Release Baseline

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Microservice Architecture — Big Picture](#2-microservice-architecture--big-picture)
3. [Technology Stack](#3-technology-stack)
4. [Clean Architecture — Layers Per Service](#4-clean-architecture--layers-per-service)
5. [Microservices — Catalogue & Responsibilities](#5-microservices--catalogue--responsibilities)
   - 5.1 [API Gateway](#51-api-gateway)
   - 5.2 [Auth Service](#52-auth-service)
   - 5.3 [User Service](#53-user-service)
   - 5.4 [Course Service](#54-course-service)
   - 5.5 [Enrollment Service](#55-enrollment-service)
   - 5.6 [Progress Service](#56-progress-service)
   - 5.7 [Notification Service](#57-notification-service)
   - 5.8 [Audit Service](#58-audit-service)
   - 5.9 [Storage Service](#59-storage-service)
6. [Inter-Service Communication](#6-inter-service-communication)
7. [Event Bus — Domain Events](#7-event-bus--domain-events)
8. [Project Directory Structure](#8-project-directory-structure)
9. [API Gateway — Routing & Middleware](#9-api-gateway--routing--middleware)
10. [Authentication & Authorization Flow](#10-authentication--authorization-flow)
11. [Data Architecture — Firestore Per Service](#11-data-architecture--firestore-per-service)
12. [Service Implementation Patterns](#12-service-implementation-patterns)
13. [Transactional Outbox Pattern](#13-transactional-outbox-pattern)
14. [Error Handling & Response Contracts](#14-error-handling--response-contracts)
15. [Security Implementation](#15-security-implementation)
16. [Observability — Logging, Metrics, Tracing](#16-observability--logging-metrics-tracing)
17. [Scalability & Deployment](#17-scalability--deployment)
18. [Environment Configuration](#18-environment-configuration)
19. [Testing Strategy](#19-testing-strategy)
20. [CI/CD Pipeline](#20-cicd-pipeline)
21. [SRS Requirement Traceability](#21-srs-requirement-traceability)

---

## 1. Overview & Goals

`slp-backend` is the server-side system for the Course Management Portal. It is implemented as a **microservice architecture** — a collection of small, independently deployable services, each owning a bounded domain context and communicating through well-defined interfaces.

### Why Microservices for CMP?

| Concern | Microservice Benefit |
|---------|---------------------|
| Independent deployability | Course Service can be updated without redeploying Auth Service |
| Fault isolation | Notification Service failure does not block enrollment or progress flows |
| Independent scaling | Progress Service can scale horizontally during peak learning hours without scaling Auth |
| Team ownership | Each service can be owned and deployed by a focused team |
| Technology flexibility | Services share the same core stack but can adopt different Node.js versions or libraries independently |
| SRS compliance | SRS requires stateless middleware with horizontal scaling (NFR-SCL-001, NFR-SCL-002) |

### Architectural Constraints (from SRS)

| Constraint | Specification |
|-----------|--------------|
| Runtime | Node.js LTS >= 20.x, TypeScript |
| Framework | Express.js per service |
| Database | Google Cloud Firestore (Native mode), Firebase Admin SDK |
| Identity | Firebase Authentication — token verification only |
| Storage | Firebase Cloud Storage (attachments) |
| Push | Firebase Cloud Messaging (FCM) |
| Auth model | Stateless — Firebase ID token on every request; no server-side sessions |
| API contract | REST + JSON, versioned at `/api/v1`, documented in OpenAPI 3.1 (`slp-contracts`) |
| Authorisation | Middleware tier owns ALL authorisation; Firestore Security Rules are defence-in-depth only |

### Architectural Principles

- **Single Responsibility** — each microservice owns exactly one bounded domain context
- **Database per Service** — each service owns its own Firestore collections; no cross-service direct DB reads
- **API-first** — inter-service communication through well-defined HTTP contracts or domain events
- **Stateless** — no per-request state stored in process memory; identity conveyed by Firebase ID token
- **Fail fast** — services validate all inputs at the boundary; internal errors never leak to clients
- **Event-driven side effects** — notifications, emails, and audit writes are decoupled via domain events
- **Observability by default** — every service emits structured logs, metrics, and traces from day one

---

## 2. Microservice Architecture — Big Picture

```
                    +--------------------------------------------------+
                    |                    CLIENTS                       |
                    |  slp-web (React/Next.js)  slp-mobile (RN)       |
                    +--------------------+-----------------------------+
                                         |  HTTPS / REST
                    +--------------------v-----------------------------+
                    |               API GATEWAY                       |
                    |         :3000  |  Nginx / Express               |
                    |  Rate Limiting | CORS | TLS Termination         |
                    |  Request ID Injection | Auth Token Forwarding   |
                    +---+------+------+------+------+------+----------+
                        |      |      |      |      |      |
          +-------------v-+ +--v--+ +--v---+ +-----v-+ +--v---------+
          | Auth Service  | |User | |Course| |Enroll | | Progress   |
          |    :3001      | | Svc | |  Svc | |  Svc  | |    Svc     |
          | Token verify  | |:3002| |:3003 | |:3004  | |   :3005    |
          +---------------+ +-----+ +------+ +-------+ +------------+
                                         |
              +------------------+--------+-------------------+
              |                  |                            |
        +-----v----+     +-------v-----+          +----------v-------+
        | Storage  |     |Notification |          |  Audit Service   |
        |   Svc    |     |   Service   |          |     :3008        |
        |  :3006   |     |    :3007    |          | (append-only)    |
        +----------+     | (async)     |          +------------------+
                         +-------------+
                                |
                    +-----------v-----------+
                    |    Outbox Worker      |
                    |       :3009           |
                    | (polls + dispatches)  |
                    +-----------+-----------+
                                |
          +---------------------v--------------------------+
          |              FIREBASE PLATFORM                 |
          |  Firestore | Auth | Cloud Storage | FCM        |
          +---------------------+--------------------------+
                                |
          +---------------------v--------------------------+
          |           EXTERNAL SERVICES                    |
          |  YouTube API | Email Provider | APNs           |
          +------------------------------------------------+
```

### Service Map

| Service | Port | Owns | Communicates via |
|---------|:----:|------|-----------------|
| **API Gateway** | 3000 | Routing, rate limiting, CORS, request ID | HTTP proxy |
| **Auth Service** | 3001 | Token verification, role claim resolution | Sync HTTP |
| **User Service** | 3002 | User profiles, registration, account status | Sync HTTP + Events |
| **Course Service** | 3003 | Courses, semesters, subjects, lifecycle | Sync HTTP + Events |
| **Enrollment Service** | 3004 | Registration queue, enrollment workflow | Sync HTTP + Events |
| **Progress Service** | 3005 | Subject completion, course progress aggregates | Sync HTTP + Events |
| **Storage Service** | 3006 | Attachment upload/download, signed URLs | Sync HTTP |
| **Notification Service** | 3007 | In-app notifications, email dispatch, push | Async (Event Bus) |
| **Audit Service** | 3008 | Append-only audit_log writes | Async (Event Bus) |
| **Outbox Worker** | 3009 | Reads transactional outbox, dispatches events | Internal |

---

## 3. Technology Stack

### Shared Across All Services

| Package | Version | Purpose |
|---------|:-------:|---------|
| `node` | LTS >= 20.x | Runtime |
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

### Service-Specific Additions

| Service | Extra Dependencies | Purpose |
|---------|-------------------|---------|
| Auth Service | `firebase-admin` Auth SDK only | Token verification via `admin.auth().verifyIdToken` |
| Storage Service | `@google-cloud/storage`, `multer` | Multipart upload handling |
| Notification Service | `@sendgrid/mail` or `nodemailer`, Firebase FCM | Email and push dispatch |
| Outbox Worker | `node-cron` | Scheduled outbox polling |

### Dev Tooling (all services)

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
| `turbo` | Monorepo build pipeline (optional) |

---

## 4. Clean Architecture — Layers Per Service

Every microservice follows the same **4-layer Clean Architecture** internally. Dependency direction is always inward.

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

### 5.1 API Gateway

**Port:** 3000 | **Role:** Single entry point for all client traffic

The API Gateway is a thin reverse proxy. It does **not** contain business logic. Its responsibilities:

- **Rate limiting** — per-IP and per-token; default 10 req/min on auth endpoints, 200 req/min on others (NFR-SEC-008)
- **CORS enforcement** — allow only configured web client origins; no wildcard (NFR-SEC-009)
- **Request ID injection** — generates `X-Request-Id` (UUID v4) on every inbound request
- **Token forwarding** — forwards `Authorization: Bearer <token>` header to downstream services; does NOT verify the token
- **Route proxying** — maps `/api/v1/*` to the correct downstream service

#### Gateway Route Table

| Prefix | Downstream Service | Port |
|--------|--------------------|:----:|
| `/api/v1/auth/*` | Auth Service | 3001 |
| `/api/v1/me/*` | User Service | 3002 |
| `/api/v1/users/*` | User Service | 3002 |
| `/api/v1/courses/*` | Course Service | 3003 |
| `/api/v1/semesters/*` | Course Service | 3003 |
| `/api/v1/subjects/*` | Course Service | 3003 |
| `/api/v1/admin/registrations/*` | Enrollment Service | 3004 |
| `/api/v1/admin/enrollments/*` | Enrollment Service | 3004 |
| `/api/v1/enrollments/*` | Enrollment Service | 3004 |
| `/api/v1/progress/*` | Progress Service | 3005 |
| `/api/v1/me/progress/*` | Progress Service | 3005 |
| `/api/v1/subjects/*/attachments` | Storage Service | 3006 |
| `/api/v1/me/notifications/*` | Notification Service | 3007 |
| `/api/v1/super-admin/admins/*` | User Service | 3002 |
| `/api/v1/audit-log/*` | Audit Service | 3008 |
| `/healthz` | Gateway internal | — |
| `/readyz` | Gateway internal | — |

#### Gateway App Implementation Sketch

```typescript
// packages/gateway/src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/logger';
import { config } from './config';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use('/api/v1/auth', authRateLimiter);
app.use('/api/v1', rateLimiter);

const proxy = (target: string) => createProxyMiddleware({
  target,
  changeOrigin: true,
  on: {
    error: (err, req, res: any) => {
      res.status(502).json({
        error: { code: 'GATEWAY_ERROR', message: 'Upstream service unavailable.' },
        requestId: (req as any).requestId,
      });
    },
  },
});

app.use('/api/v1/auth',                proxy(config.services.auth));
app.use('/api/v1/me/notifications',    proxy(config.services.notification));
app.use('/api/v1/me/progress',         proxy(config.services.progress));
app.use('/api/v1/me',                  proxy(config.services.user));
app.use('/api/v1/users',               proxy(config.services.user));
app.use('/api/v1/super-admin',         proxy(config.services.user));
app.use('/api/v1/courses',             proxy(config.services.course));
app.use('/api/v1/semesters',           proxy(config.services.course));
app.use('/api/v1/subjects',            proxy(config.services.course));
app.use('/api/v1/admin/registrations', proxy(config.services.enrollment));
app.use('/api/v1/admin/enrollments',   proxy(config.services.enrollment));
app.use('/api/v1/enrollments',         proxy(config.services.enrollment));
app.use('/api/v1/progress',            proxy(config.services.progress));
app.use('/api/v1/audit-log',           proxy(config.services.audit));

app.get('/healthz', (_, res) => res.json({ status: 'ok' }));
app.get('/readyz',  healthCheck);

export { app };
```

---

### 5.2 Auth Service

**Port:** 3001 | **Owns:** Token verification, role resolution, logout
**Firestore collections:** None (reads from Firebase Auth only)

> **Design decision:** Rather than every service calling Auth Service over HTTP (adding latency and a single point of failure), each service uses the **shared `@shared/auth-middleware` npm workspace package** that wraps `admin.auth().verifyIdToken()`. The Auth Service HTTP endpoints handle registration orchestration and logout only.

#### Endpoints

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `POST` | `/api/v1/auth/register` | Public | Create PENDING_APPROVAL student account |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke refresh tokens |
| `POST` | `/api/v1/auth/password-reset` | Public | Send password reset email |

#### Registration Flow

```
POST /api/v1/auth/register
  Body: { email, password, firstName, lastName }

  1. Validate input (Zod registerSchema)
  2. Check email uniqueness:
       -> GET User Service /internal/users/exists?email=...
       -> If exists -> 409 { code: 'EMAIL_EXISTS' }
  3. Create Firebase Auth user:
       admin.auth().createUser({ email, password })
  4. Set custom claim: { role: 'student' }
       admin.auth().setCustomUserClaims(uid, { role: 'student' })
  5. Publish domain event: user.registered
       -> User Service creates /users/{uid} doc (status: PENDING_APPROVAL)
       -> Enrollment Service creates registration queue entry
       -> Notification Service queues admin notification
  6. Return 201 { message: 'Registration submitted. Awaiting approval.' }
```

#### Shared Auth Middleware Package

```typescript
// packages/shared/auth-middleware/src/index.ts
import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { createHttpError } from '@shared/errors';

export interface AuthenticatedRequest extends Request {
  principal: {
    uid:   string;
    email: string;
    role:  'super_admin' | 'admin' | 'student';
  };
}

export function authenticate(checkRevoked = true) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(createHttpError(401, 'MISSING_TOKEN', 'Authorization header required.'));
    }

    const token = header.slice(7);
    try {
      const decoded = await getAuth().verifyIdToken(token, checkRevoked);
      const role = decoded['role'] as string;

      if (!['super_admin', 'admin', 'student'].includes(role)) {
        return next(createHttpError(403, 'INVALID_ROLE', 'Token role claim is invalid.'));
      }

      (req as AuthenticatedRequest).principal = {
        uid:   decoded.uid,
        email: decoded.email ?? '',
        role:  role as any,
      };
      next();
    } catch (err: any) {
      if (err.code === 'auth/id-token-revoked') {
        return next(createHttpError(401, 'TOKEN_REVOKED', 'Session has been revoked.'));
      }
      if (err.code === 'auth/id-token-expired') {
        return next(createHttpError(401, 'TOKEN_EXPIRED', 'Token has expired.'));
      }
      return next(createHttpError(401, 'INVALID_TOKEN', 'Token could not be verified.'));
    }
  };
}

export function authorize(...roles: Array<'super_admin' | 'admin' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const principal = (req as AuthenticatedRequest).principal;
    if (!principal) return next(createHttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));

    // super_admin inherits all admin permissions
    const effectiveRoles = principal.role === 'super_admin'
      ? ['super_admin', 'admin']
      : [principal.role];

    const allowed = roles.some(r => effectiveRoles.includes(r));
    if (!allowed) {
      return next(createHttpError(403, 'FORBIDDEN',
        `Role '${principal.role}' is not permitted to perform this action.`));
    }
    next();
  };
}
```

---

### 5.3 User Service

**Port:** 3002 | **Owns:** User profiles, account lifecycle, Admin management
**Firestore collections:** `users`

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `GET` | `/api/v1/me` | Any | Get own profile |
| `PATCH` | `/api/v1/me` | Any | Update own profile |
| `GET` | `/api/v1/users` | admin, super_admin | List all users (paginated, filterable) |
| `GET` | `/api/v1/users/:uid` | admin, super_admin | Get user by UID |
| `POST` | `/api/v1/users/:uid/suspend` | admin, super_admin | Suspend a student |
| `POST` | `/api/v1/users/:uid/reactivate` | admin, super_admin | Reactivate a student |
| `GET` | `/api/v1/super-admin/admins` | super_admin | List all admin accounts |
| `POST` | `/api/v1/super-admin/admins` | super_admin | Create an Admin account |
| `POST` | `/api/v1/super-admin/admins/:uid/suspend` | super_admin | Suspend an Admin |
| `POST` | `/api/v1/super-admin/admins/:uid/reactivate` | super_admin | Reactivate an Admin |
| `DELETE` | `/api/v1/super-admin/admins/:uid` | super_admin | Delete an Admin |
| `POST` | `/internal/users/exists` | Internal only | Email uniqueness check |
| `POST` | `/internal/users/approve` | Internal only | Set user status = APPROVED |

#### Create Admin Use Case

```typescript
// packages/user-service/src/application/useCases/CreateAdminUseCase.ts
import { getAuth } from 'firebase-admin/auth';
import { IUserRepository } from '@/domain/repositories/IUserRepository';
import { User, UserRole, UserStatus } from '@/domain/entities/User';
import { UserEventPublisher } from '@/application/events/UserEventPublisher';
import { createHttpError } from '@shared/errors';

interface CreateAdminInput {
  firstName:       string;
  lastName:        string;
  email:           string;
  initialPassword: string;
  actorUid:        string;
}

export class CreateAdminUseCase {
  constructor(
    private readonly userRepo:        IUserRepository,
    private readonly eventPublisher:  UserEventPublisher,
  ) {}

  async execute(input: CreateAdminInput): Promise<User> {
    // 1. Email uniqueness check
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw createHttpError(409, 'EMAIL_EXISTS', 'Email is already registered.');

    // 2. Create Firebase Auth account
    const firebaseUser = await getAuth().createUser({
      email:       input.email,
      password:    input.initialPassword,
      displayName: `${input.firstName} ${input.lastName}`,
    });

    // 3. Set role claim
    await getAuth().setCustomUserClaims(firebaseUser.uid, { role: 'admin' });

    // 4. Create Firestore user document
    const user = new User({
      uid:       firebaseUser.uid,
      email:     input.email,
      role:      UserRole.ADMIN,
      status:    UserStatus.APPROVED,
      firstName: input.firstName,
      lastName:  input.lastName,
    });

    await this.userRepo.create(user);

    // 5. Emit audit event
    await this.eventPublisher.publish('admin.created', {
      actorUid:  input.actorUid,
      targetUid: user.uid,
      email:     user.email,
    });

    return user;
  }
}
```

---

### 5.4 Course Service

**Port:** 3003 | **Owns:** Courses, Semesters, Subjects, Course lifecycle
**Firestore collections:** `courses`, `courses/{id}/semesters`, `courses/{id}/semesters/{id}/subjects`

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `GET` | `/api/v1/courses` | Any* | List courses (PUBLISHED for students; all for admin) |
| `GET` | `/api/v1/courses/:id` | Any* | Get course (404 if DRAFT and role=student) |
| `POST` | `/api/v1/courses` | admin, super_admin | Create course (DRAFT) |
| `PATCH` | `/api/v1/courses/:id` | admin, super_admin | Update course metadata |
| `POST` | `/api/v1/courses/:id/publish` | admin, super_admin | Publish a DRAFT course |
| `POST` | `/api/v1/courses/:id/unpublish` | admin, super_admin | Return to DRAFT |
| `POST` | `/api/v1/courses/:id/archive` | admin, super_admin | Archive a course |
| `DELETE` | `/api/v1/courses/:id` | admin, super_admin | Soft-delete a course |
| `POST` | `/api/v1/courses/:id/semesters` | admin, super_admin | Create a semester |
| `PATCH` | `/api/v1/semesters/:id` | admin, super_admin | Update semester |
| `DELETE` | `/api/v1/semesters/:id` | admin, super_admin | Soft-delete a semester |
| `POST` | `/api/v1/semesters/:id/subjects` | admin, super_admin | Create a subject |
| `PATCH` | `/api/v1/subjects/:id` | admin, super_admin | Update subject content |
| `DELETE` | `/api/v1/subjects/:id` | admin, super_admin | Soft-delete a subject |
| `GET` | `/internal/courses/:id/subject-count` | Internal | Used by Progress Service |

#### Course Lifecycle State Machine

```
        +---------------------------------------------------+
        |                                                   |
 -->  DRAFT  -- publish() -->  PUBLISHED  -- archive() --> ARCHIVED
        ^                          |
        +------ unpublish() -------+

  Rules:
  - publish() requires: semesterCount >= 1 AND every semester subjectCount >= 1
  - Deletion of PUBLISHED course with progress data = soft-delete (deletedAt set, recoverable 30 days)
```

#### Publish Course Use Case

```typescript
// packages/course-service/src/application/useCases/PublishCourseUseCase.ts
export class PublishCourseUseCase {
  constructor(
    private readonly courseRepo:     ICourseRepository,
    private readonly semesterRepo:   ISemesterRepository,
    private readonly eventPublisher: CourseEventPublisher,
  ) {}

  async execute(courseId: string, actorUid: string): Promise<Course> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    if (course.state !== 'draft') {
      throw createHttpError(409, 'INVALID_STATE', 'Only DRAFT courses can be published.');
    }

    const semesters = await this.semesterRepo.findByCourseId(courseId);
    if (semesters.length === 0) {
      throw createHttpError(422, 'NO_SEMESTERS',
        'A course must have at least one semester before publishing.');
    }
    if (!semesters.every(s => s.subjectCount > 0)) {
      throw createHttpError(422, 'EMPTY_SEMESTER',
        'Every semester must have at least one subject before publishing.');
    }

    course.publish();
    await this.courseRepo.update(course);

    await this.eventPublisher.publish('course.published', {
      actorUid, courseId, courseTitle: course.title,
    });

    return course;
  }
}
```

#### YouTube ID Validation (Value Object)

```typescript
// packages/course-service/src/domain/valueObjects/YouTubeVideoId.ts
export class YouTubeVideoId {
  private static readonly VALID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

  static from(raw: string): string {
    const urlMatch = raw.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const id = urlMatch ? urlMatch[1] : raw.trim();

    if (!this.VALID_PATTERN.test(id)) {
      throw new Error(`Invalid YouTube video ID: "${raw}"`);
    }
    return id;
  }
}
```

---

### 5.5 Enrollment Service

**Port:** 3004 | **Owns:** Registration approval queue, enrollment request lifecycle
**Firestore collections:** `enrollments`

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `POST` | `/api/v1/courses/:id/enroll` | student | Submit enrollment request |
| `GET` | `/api/v1/me/enrollments` | student | List own enrollments |
| `POST` | `/api/v1/enrollments/:id/withdraw` | student | Withdraw PENDING request |
| `GET` | `/api/v1/admin/registrations` | admin, super_admin | List pending registrations |
| `POST` | `/api/v1/admin/registrations/:id/approve` | admin, super_admin | Approve student registration |
| `POST` | `/api/v1/admin/registrations/:id/reject` | admin, super_admin | Reject student registration |
| `GET` | `/api/v1/admin/enrollments` | admin, super_admin | List pending enrollments |
| `POST` | `/api/v1/admin/enrollments/:id/approve` | admin, super_admin | Approve enrollment |
| `POST` | `/api/v1/admin/enrollments/:id/reject` | admin, super_admin | Reject enrollment with reason |

#### Enrollment State Machine

```
Student submits -->  PENDING  -- Admin approves -->  APPROVED
                        |
                        +-- Admin rejects  -->  REJECTED  --> (resubmit after cool-off)
                        |
                        +-- Student withdraws --> WITHDRAWN

  Constraints:
  - Max 1 PENDING enrollment per student per course at any time
  - APPROVED enrollment grants access to course content
  - Resubmit after rejection: configurable cool-off (default 24h)
```

#### Approve Registration Use Case

```typescript
// packages/enrollment-service/src/application/useCases/ApproveRegistrationUseCase.ts
export class ApproveRegistrationUseCase {
  constructor(
    private readonly enrollmentRepo:  IEnrollmentRepository,
    private readonly userClient:      UserServiceClient,
    private readonly eventPublisher:  EnrollmentEventPublisher,
  ) {}

  async execute(registrationId: string, actorUid: string): Promise<void> {
    const reg = await this.enrollmentRepo.findRegistration(registrationId);
    if (!reg) throw createHttpError(404, 'NOT_FOUND', 'Registration not found.');
    if (reg.state !== 'pending') {
      throw createHttpError(409, 'INVALID_STATE', 'Registration is no longer pending.');
    }

    reg.approve(actorUid);
    await this.enrollmentRepo.updateRegistration(reg);

    // Call User Service to set account status = APPROVED
    await this.userClient.approveUser(reg.studentUid);

    // Emit events -- Notification + Audit services react asynchronously
    await this.eventPublisher.publish('registration.approved', {
      studentUid: reg.studentUid, actorUid, registrationId,
    });
    await this.eventPublisher.publish('audit.action', {
      actorUid, action: 'registration.approved',
      targetType: 'registration', targetId: registrationId,
    });
  }
}
```

#### Bulk Approve (FR-ADM-011)

```typescript
// packages/enrollment-service/src/application/useCases/BulkApproveRegistrationsUseCase.ts
export class BulkApproveRegistrationsUseCase {
  constructor(private readonly approveUseCase: ApproveRegistrationUseCase) {}

  async execute(ids: string[], actorUid: string) {
    const results = await Promise.allSettled(
      ids.map(id => this.approveUseCase.execute(id, actorUid))
    );
    return {
      approved: results
        .map((r, i) => r.status === 'fulfilled' ? ids[i] : null)
        .filter(Boolean) as string[],
      failed: results
        .map((r, i) => r.status === 'rejected'
          ? { id: ids[i], reason: (r as PromiseRejectedResult).reason?.message }
          : null)
        .filter(Boolean) as Array<{ id: string; reason: string }>,
    };
  }
}
```

---

### 5.6 Progress Service

**Port:** 3005 | **Owns:** Subject completion state, course progress aggregates, resume pointer
**Firestore collections:** `progress`

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `POST` | `/api/v1/progress/subjects/:id/complete` | student | Mark subject complete (idempotent) |
| `POST` | `/api/v1/progress/subjects/:id/access` | student | Update lastAccessedAt (resume pointer) |
| `GET` | `/api/v1/me/progress/courses/:courseId` | student | Get course-level progress aggregate |
| `GET` | `/api/v1/admin/progress/courses/:courseId` | admin, super_admin | Aggregate progress for course |
| `POST` | `/internal/progress/reset` | Internal | Reset all progress for (student, course) |

#### Mark Complete Use Case — Idempotent (FR-LRN-008)

```typescript
// packages/progress-service/src/application/useCases/MarkSubjectCompleteUseCase.ts
export class MarkSubjectCompleteUseCase {
  constructor(
    private readonly progressRepo:   IProgressRepository,
    private readonly eventPublisher: ProgressEventPublisher,
  ) {}

  async execute(
    studentUid: string,
    subjectId:  string,
    source:     'manual' | 'auto' = 'manual',
  ): Promise<SubjectProgress> {
    const existing = await this.progressRepo.findByStudentAndSubject(studentUid, subjectId);

    // IDEMPOTENT: already completed -- return unchanged (do NOT update completedAt)
    if (existing?.state === 'completed') return existing;

    const progress = existing ?? SubjectProgress.createNew(studentUid, subjectId);
    progress.markComplete(source);
    await this.progressRepo.upsert(progress);

    await this.eventPublisher.publish('progress.subjectCompleted', {
      studentUid, subjectId, courseId: progress.courseId,
    });

    return progress;
  }
}
```

#### Course Progress Aggregate (FR-LRN-004)

```typescript
// packages/progress-service/src/application/useCases/ComputeCourseProgressUseCase.ts
export class ComputeCourseProgressUseCase {
  constructor(
    private readonly progressRepo:   IProgressRepository,
    private readonly courseClient:   CourseServiceClient,
  ) {}

  async execute(studentUid: string, courseId: string): Promise<CourseProgressAggregate> {
    const [totalSubjects, records] = await Promise.all([
      this.courseClient.getSubjectCount(courseId),
      this.progressRepo.findByCourseAndStudent(courseId, studentUid),
    ]);

    const completedCount = records.filter(r => r.state === 'completed').length;
    const pendingCount   = totalSubjects - completedCount;

    // 1 decimal place as per FR-LRN-004
    const completionPercent = totalSubjects === 0
      ? 0
      : Math.round((completedCount / totalSubjects) * 1000) / 10;

    const lastAccessedSubjectId = records
      .filter(r => r.lastAccessedAt)
      .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime())
      [0]?.subjectId ?? null;

    return { courseId, studentUid, completedCount, pendingCount,
             totalSubjects, completionPercent, lastAccessedSubjectId };
  }
}
```

---

### 5.7 Notification Service

**Port:** 3007 | **Owns:** In-app notifications, email delivery, mobile push dispatch
**Firestore collections:** `notifications`

The Notification Service is **primarily asynchronous** — it consumes domain events from the Event Bus and dispatches notifications.

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `GET` | `/api/v1/me/notifications` | Any | List notifications (paginated) |
| `POST` | `/api/v1/me/notifications/:id/read` | Any | Mark one notification as read |
| `POST` | `/api/v1/me/notifications/read-all` | Any | Mark all notifications as read |

#### Event Subscriptions (Async)

| Domain Event | Action Taken |
|-------------|-------------|
| `registration.approved` | In-app + email to student |
| `registration.rejected` | In-app + email to student |
| `user.registered` | In-app to all admins |
| `enrollment.approved` | In-app + email + push (if opted-in) to student |
| `enrollment.rejected` | In-app + email to student with optional reason |
| `enrollment.pending` | In-app to admins |

#### Notification Dispatcher with Retry (NFR-NOT-009)

```typescript
// packages/notification-service/src/application/services/NotificationDispatcher.ts
import { getMessaging } from 'firebase-admin/messaging';

export class NotificationDispatcher {
  private readonly MAX_RETRIES = 3;

  async dispatchEmail(to: string, subject: string, body: string, requestId: string): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.emailClient.sendMail({ to, subject, html: body });
        return;
      } catch (err) {
        if (attempt === this.MAX_RETRIES) {
          // Log permanent failure -- MUST NOT block the calling flow (NFR-NOT-009)
          logger.error({ err, to, requestId }, 'Email delivery permanently failed after retries');
          return;
        }
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  async dispatchPush(fcmToken: string, title: string, body: string): Promise<void> {
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: { title, body },
        android: { priority: 'normal' },
        apns:    { payload: { aps: { contentAvailable: true } } },
      });
    } catch (err) {
      // Push is best-effort; in-app notification is authoritative (NFR-NOT-007)
      logger.warn({ err, fcmToken }, 'Push delivery failed (best-effort, not retried)');
    }
  }
}
```

---

### 5.8 Audit Service

**Port:** 3008 | **Owns:** Append-only audit_log writes
**Firestore collections:** `audit_log`

The Audit Service is **purely event-driven** — no synchronous endpoints beyond health probes and the Super Admin query endpoint.

```typescript
// packages/audit-service/src/application/handlers/AuditEventHandler.ts
import { Timestamp } from 'firebase-admin/firestore';

export class AuditEventHandler {
  constructor(private readonly auditRepo: IAuditRepository) {}

  async handle(event: AuditActionEvent): Promise<void> {
    // Firestore Security Rules additionally deny client updates/deletes
    await this.auditRepo.append({
      actorUid:   event.actorUid ?? null,
      action:     event.action,
      targetType: event.targetType,
      targetId:   event.targetId,
      payload:    event.payload ?? {},
      requestId:  event.requestId,
      createdAt:  Timestamp.now(), // Immutable server timestamp
    });
  }
}
```

---

### 5.9 Storage Service

**Port:** 3006 | **Owns:** Attachment upload/download, signed URL generation
**Firebase:** Cloud Storage

#### Endpoints

| Method | Path | Roles | Description |
|--------|------|:-----:|-------------|
| `POST` | `/api/v1/subjects/:id/attachments` | admin, super_admin | Upload attachment (multipart/form-data, max 25 MB) |
| `GET` | `/api/v1/attachments/:id/download-url` | student (enrolled), admin | Get short-lived signed download URL |
| `DELETE` | `/api/v1/attachments/:id` | admin, super_admin | Remove attachment |

#### Attachment Upload Validation (FR-CRS-010)

```typescript
// packages/storage-service/src/http/middleware/attachmentValidator.ts
import multer from 'multer';
import { createHttpError } from '@shared/errors';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE',
        `File type '${file.mimetype}' is not allowed. Accepted: PDF, DOC, DOCX.`));
    }
    cb(null, true);
  },
});
```

---

## 6. Inter-Service Communication

### Synchronous Communication (HTTP)

Services communicate synchronously only when the caller needs an **immediate response**. All internal HTTP calls use a shared `InternalHttpClient` that:

- Adds `X-Internal-Service-Key` authentication header
- Propagates `X-Request-Id` for distributed tracing
- Times out after 5 seconds
- Retries once on 5xx with 500 ms backoff

```typescript
// packages/shared/internal-http-client/src/index.ts
import axios, { AxiosInstance } from 'axios';
import { getRequestId } from './context'; // AsyncLocalStorage context

export function createInternalClient(serviceUrl: string, serviceKey: string): AxiosInstance {
  const client = axios.create({
    baseURL: serviceUrl,
    timeout: 5000,
    headers: {
      'X-Internal-Service-Key': serviceKey,
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(cfg => {
    const requestId = getRequestId();
    if (requestId) cfg.headers['X-Request-Id'] = requestId;
    return cfg;
  });

  // Single retry on 5xx
  client.interceptors.response.use(
    r => r,
    async error => {
      if (!error.config._retried && error.response?.status >= 500) {
        error.config._retried = true;
        await new Promise(r => setTimeout(r, 500));
        return client(error.config);
      }
      throw error;
    }
  );

  return client;
}
```

### Synchronous Call Map

| Caller | Callee | Purpose |
|--------|--------|---------|
| Auth Service | User Service | Check email uniqueness on registration |
| Enrollment Service | User Service | Update user account status on approve/reject |
| Enrollment Service | Course Service | Verify course is PUBLISHED before enrollment |
| Progress Service | Course Service | Get total subject count for aggregate % |
| Storage Service | Course Service | Verify subject exists before upload |

---

## 7. Event Bus — Domain Events

### Event Bus Strategy

For v1.0, the Event Bus uses the **Transactional Outbox Pattern** with Firestore as the message store. This avoids introducing an external broker (Kafka/Pub-Sub) while guaranteeing at-least-once delivery.

```
Service writes domain event
    |
    v
Firestore: outbox collection (written in same transaction as primary data)
    |
    v  (Outbox Worker polls every 5 seconds)
Outbox Worker
    |
    +-> Notification Service HTTP endpoint
    +-> Audit Service HTTP endpoint
```

### Domain Events Catalogue

| Event | Published By | Consumed By | Key Payload Fields |
|-------|-------------|-------------|-------------------|
| `user.registered` | Auth Service | User Svc, Enrollment Svc, Notification Svc, Audit Svc | `studentUid`, `email`, `firstName`, `lastName` |
| `registration.approved` | Enrollment Svc | User Svc, Notification Svc, Audit Svc | `studentUid`, `actorUid`, `registrationId` |
| `registration.rejected` | Enrollment Svc | User Svc, Notification Svc, Audit Svc | `studentUid`, `actorUid`, `registrationId` |
| `enrollment.pending` | Enrollment Svc | Notification Svc, Audit Svc | `studentUid`, `courseId`, `enrollmentId` |
| `enrollment.approved` | Enrollment Svc | Notification Svc, Audit Svc | `studentUid`, `actorUid`, `courseId` |
| `enrollment.rejected` | Enrollment Svc | Notification Svc, Audit Svc | `studentUid`, `actorUid`, `courseId`, `reason?` |
| `course.published` | Course Svc | Notification Svc, Audit Svc | `actorUid`, `courseId`, `courseTitle` |
| `progress.subjectCompleted` | Progress Svc | Progress Svc (re-aggregate), Audit Svc | `studentUid`, `subjectId`, `courseId`, `source` |
| `admin.created` | User Svc | Audit Svc | `actorUid`, `adminUid`, `email` |
| `admin.suspended` | User Svc | Notification Svc, Audit Svc | `actorUid`, `adminUid` |
| `audit.action` | Any service | Audit Svc | `actorUid?`, `action`, `targetType`, `targetId`, `payload`, `requestId` |

### Event Schema

```typescript
// packages/shared/events/src/types.ts
export interface DomainEvent<T = Record<string, unknown>> {
  id:         string;  // UUID v4 -- for deduplication
  type:       string;  // e.g., 'registration.approved'
  occurredAt: string;  // ISO 8601 timestamp
  requestId:  string;  // Correlation ID from X-Request-Id
  payload:    T;
}
```

---

## 8. Project Directory Structure

The monorepo uses **npm workspaces**. Each microservice is an independent package under `packages/`. Shared code lives in `packages/shared/`.

```
slp-backend/
|
+-- packages/
|   |
|   +-- gateway/                     # API Gateway service (:3000)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- config.ts
|   |   |   +-- middleware/
|   |   |       +-- rateLimiter.ts
|   |   |       +-- requestId.ts
|   |   |       +-- logger.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- auth-service/                # Auth Service (:3001)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   |   +-- routes/
|   |   |   |   +-- controllers/
|   |   |   |   +-- validators/
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |       +-- RegisterUseCase.ts
|   |   |   |       +-- LogoutUseCase.ts
|   |   |   |       +-- TrackLoginAttemptsUseCase.ts
|   |   |   +-- domain/
|   |   |   +-- infrastructure/
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- user-service/                # User Service (:3002)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   |   +-- routes/
|   |   |   |   |   +-- me.routes.ts
|   |   |   |   |   +-- users.routes.ts
|   |   |   |   |   +-- superAdmin.routes.ts
|   |   |   |   +-- controllers/
|   |   |   |   |   +-- ProfileController.ts
|   |   |   |   |   +-- UserManagementController.ts
|   |   |   |   |   +-- AdminManagementController.ts
|   |   |   |   +-- validators/
|   |   |   |   +-- middleware/
|   |   |   |       +-- ownershipGuard.ts
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |   |   +-- UpdateProfileUseCase.ts
|   |   |   |   |   +-- SuspendUserUseCase.ts
|   |   |   |   |   +-- CreateAdminUseCase.ts
|   |   |   |   |   +-- DeleteAdminUseCase.ts
|   |   |   |   +-- events/
|   |   |   |       +-- UserEventPublisher.ts
|   |   |   +-- domain/
|   |   |   |   +-- entities/
|   |   |   |   |   +-- User.ts
|   |   |   |   +-- valueObjects/
|   |   |   |   |   +-- UserRole.ts
|   |   |   |   |   +-- UserStatus.ts
|   |   |   |   +-- repositories/
|   |   |   |       +-- IUserRepository.ts
|   |   |   +-- infrastructure/
|   |   |       +-- repositories/
|   |   |           +-- FirestoreUserRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- course-service/              # Course Service (:3003)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |   |   +-- CreateCourseUseCase.ts
|   |   |   |   |   +-- PublishCourseUseCase.ts
|   |   |   |   |   +-- ArchiveCourseUseCase.ts
|   |   |   |   |   +-- CreateSemesterUseCase.ts
|   |   |   |   |   +-- CreateSubjectUseCase.ts
|   |   |   |   +-- events/
|   |   |   |       +-- CourseEventPublisher.ts
|   |   |   +-- domain/
|   |   |   |   +-- entities/
|   |   |   |   |   +-- Course.ts
|   |   |   |   |   +-- Semester.ts
|   |   |   |   |   +-- Subject.ts
|   |   |   |   +-- valueObjects/
|   |   |   |   |   +-- YouTubeVideoId.ts
|   |   |   |   |   +-- CourseState.ts
|   |   |   |   |   +-- Attachment.ts
|   |   |   |   +-- repositories/
|   |   |   |       +-- ICourseRepository.ts
|   |   |   |       +-- ISemesterRepository.ts
|   |   |   |       +-- ISubjectRepository.ts
|   |   |   +-- infrastructure/
|   |   |       +-- repositories/
|   |   |           +-- FirestoreCourseRepository.ts
|   |   |           +-- FirestoreSemesterRepository.ts
|   |   |           +-- FirestoreSubjectRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- enrollment-service/          # Enrollment Service (:3004)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |   |   +-- CreateEnrollmentUseCase.ts
|   |   |   |   |   +-- ApproveRegistrationUseCase.ts
|   |   |   |   |   +-- RejectRegistrationUseCase.ts
|   |   |   |   |   +-- ApproveEnrollmentUseCase.ts
|   |   |   |   |   +-- RejectEnrollmentUseCase.ts
|   |   |   |   |   +-- WithdrawEnrollmentUseCase.ts
|   |   |   |   |   +-- BulkApproveRegistrationsUseCase.ts
|   |   |   |   +-- clients/
|   |   |   |       +-- UserServiceClient.ts
|   |   |   |       +-- CourseServiceClient.ts
|   |   |   +-- domain/
|   |   |   |   +-- entities/
|   |   |   |   |   +-- Enrollment.ts
|   |   |   |   +-- valueObjects/
|   |   |   |   |   +-- EnrollmentState.ts
|   |   |   |   +-- repositories/
|   |   |   |       +-- IEnrollmentRepository.ts
|   |   |   +-- infrastructure/
|   |   |       +-- repositories/
|   |   |           +-- FirestoreEnrollmentRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- progress-service/            # Progress Service (:3005)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |   |   +-- MarkSubjectCompleteUseCase.ts
|   |   |   |   |   +-- UpdateLastAccessedUseCase.ts
|   |   |   |   |   +-- ComputeCourseProgressUseCase.ts
|   |   |   |   |   +-- ResetProgressUseCase.ts
|   |   |   |   +-- clients/
|   |   |   |       +-- CourseServiceClient.ts
|   |   |   +-- domain/
|   |   |   |   +-- entities/
|   |   |   |   |   +-- SubjectProgress.ts
|   |   |   |   |   +-- CourseProgressAggregate.ts
|   |   |   |   +-- repositories/
|   |   |   |       +-- IProgressRepository.ts
|   |   |   +-- infrastructure/
|   |   |       +-- repositories/
|   |   |           +-- FirestoreProgressRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- storage-service/             # Storage Service (:3006)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   |   +-- routes/
|   |   |   |   +-- controllers/
|   |   |   |   +-- middleware/
|   |   |   |       +-- attachmentValidator.ts
|   |   |   +-- application/
|   |   |   |   +-- useCases/
|   |   |   |       +-- UploadAttachmentUseCase.ts
|   |   |   |       +-- GetDownloadUrlUseCase.ts
|   |   |   +-- infrastructure/
|   |   |       +-- CloudStorageRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- notification-service/        # Notification Service (:3007)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   |   +-- routes/          # In-app CRUD endpoints
|   |   |   |   +-- controllers/
|   |   |   +-- application/
|   |   |   |   +-- handlers/        # Domain event handlers
|   |   |   |   |   +-- RegistrationApprovedHandler.ts
|   |   |   |   |   +-- EnrollmentApprovedHandler.ts
|   |   |   |   +-- services/
|   |   |   |       +-- NotificationDispatcher.ts
|   |   |   +-- domain/
|   |   |   +-- infrastructure/
|   |   |       +-- EmailClient.ts
|   |   |       +-- FcmClient.ts
|   |   |       +-- FirestoreNotificationRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- audit-service/               # Audit Service (:3008)
|   |   +-- src/
|   |   |   +-- app.ts
|   |   |   +-- http/
|   |   |   |   +-- routes/          # GET /audit-log (Super Admin)
|   |   |   +-- application/
|   |   |   |   +-- handlers/
|   |   |   |       +-- AuditEventHandler.ts
|   |   |   +-- infrastructure/
|   |   |       +-- FirestoreAuditRepository.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- outbox-worker/               # Outbox Worker (:3009)
|   |   +-- src/
|   |   |   +-- worker.ts
|   |   |   +-- config.ts
|   |   |   +-- dispatcher/
|   |   |       +-- EventDispatcher.ts
|   |   +-- Dockerfile
|   |   +-- package.json
|   |
|   +-- shared/                      # Shared packages (no Dockerfile)
|       +-- auth-middleware/         # authenticate() + authorize() exports
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- errors/                  # createHttpError, AppError, fromZodError
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- events/                  # DomainEvent type, OutboxEventPublisher
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- internal-http-client/    # createInternalClient factory
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- logger/                  # Pino logger factory with redaction
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- response/                # sendSuccess, sendPaginated helpers
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- health/                  # /healthz + /readyz router
|       |   +-- src/healthRouter.ts
|       |   +-- package.json
|       +-- firebase/                # initFirebaseAdmin (idempotent)
|       |   +-- src/index.ts
|       |   +-- package.json
|       +-- tracing/                 # OpenTelemetry initialisation
|           +-- src/index.ts
|           +-- package.json
|
+-- docker-compose.yml               # Local development orchestration
+-- docker-compose.prod.yml          # Production override
+-- .env.example
+-- package.json                     # Workspace root
+-- tsconfig.base.json               # Shared TypeScript config
+-- turbo.json                       # Turborepo build pipeline
```

---

## 9. API Gateway — Routing & Middleware

### Middleware Stack (Gateway)

Every request traverses this pipeline in order:

```
Inbound Request
    |
    v
[1] TLS Termination (load balancer, before Gateway)
    |
    v
[2] Helmet -- security headers (X-Frame-Options, X-Content-Type-Options, etc.)
    |
    v
[3] CORS -- origin allowlist check; reject wildcard in production (NFR-SEC-009)
    |
    v
[4] Request ID Middleware -- inject X-Request-Id (UUID v4) if absent
    |
    v
[5] Structured Request Logger (pino-http)
    |
    v
[6] Rate Limiter -- per-IP; stricter on /auth/* (NFR-SEC-008)
    |
    v
[7] Proxy -- forward to correct downstream service with all headers intact
    |
    v
Downstream Service
```

### Rate Limiter Configuration

```typescript
// packages/gateway/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// General API: 200 req/min per IP
export const rateLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please slow down.' },
  },
});

// Auth endpoints: 10 req/min per IP (NFR-SEC-008)
export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'AUTH_RATE_LIMIT_EXCEEDED', message: 'Too many login attempts.' },
  },
});
```

### Request ID Middleware

```typescript
// packages/gateway/src/middleware/requestId.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
```

---

## 10. Authentication & Authorization Flow

### Full Request Flow

```
Client
  |
  |  GET /api/v1/me/enrollments
  |  Authorization: Bearer <firebase-id-token>
  |  X-Request-Id: <uuid>
  v
API Gateway
  +- Rate limit check -> pass
  +- CORS check -> pass
  +- Add X-Request-Id if absent
  +- Proxy to Enrollment Service :3004
         |
         v
Enrollment Service -- shared authMiddleware pipeline:

  [1] authenticate() middleware
       -> extract Bearer token from Authorization header
       -> admin.auth().verifyIdToken(token, checkRevoked=true)
       -> verify: signature, aud, iss, exp, revocation status
       -> attach principal = { uid, email, role } to req

  [2] authorize('student') middleware
       -> check req.principal.role === 'student' -> PASS

  [3] Controller -> Use Case
       -> use req.principal.uid as studentUid
       -> query enrollments WHERE studentUid = req.principal.uid

  [4] Response: 200 + enrollments array
```

### RBAC Route Definition Pattern

```typescript
// packages/enrollment-service/src/http/routes/enrollment.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { EnrollmentController } from '../controllers/EnrollmentController';

const router = Router();

// All routes require authentication
router.use(authenticate());

// Student-only routes
router.post('/courses/:courseId/enroll',
  authorize('student'), EnrollmentController.enroll);
router.get('/me/enrollments',
  authorize('student'), EnrollmentController.getMyEnrollments);
router.post('/enrollments/:id/withdraw',
  authorize('student'), EnrollmentController.withdraw);

// Admin + Super Admin routes
router.get('/admin/registrations',
  authorize('admin'), EnrollmentController.getRegistrations);
router.post('/admin/registrations/:id/approve',
  authorize('admin'), EnrollmentController.approveRegistration);
router.post('/admin/registrations/:id/reject',
  authorize('admin'), EnrollmentController.rejectRegistration);
router.get('/admin/enrollments',
  authorize('admin'), EnrollmentController.getEnrollments);
router.post('/admin/enrollments/:id/approve',
  authorize('admin'), EnrollmentController.approveEnrollment);
router.post('/admin/enrollments/:id/reject',
  authorize('admin'), EnrollmentController.rejectEnrollment);

export { router as enrollmentRouter };
```

### Resource Ownership Guard

```typescript
// packages/shared/auth-middleware/src/ownershipGuard.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './index';
import { createHttpError } from '@shared/errors';

export function mustBeOwnerOrAdmin(getResourceUid: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const principal = (req as AuthenticatedRequest).principal;
    const resourceUid = getResourceUid(req);

    if (!resourceUid) return next();

    const isOwner = principal.uid === resourceUid;
    const isAdmin = ['admin', 'super_admin'].includes(principal.role);

    if (!isOwner && !isAdmin) {
      return next(createHttpError(403, 'FORBIDDEN',
        'You do not have access to this resource.'));
    }
    next();
  };
}
```

---

## 11. Data Architecture — Firestore Per Service

Each service **owns** its Firestore collections. No service reads another service's collections directly.

### Collection Ownership Map

| Collection | Owning Service | Notes |
|-----------|---------------|-------|
| `users` | User Service | Document ID = Firebase Auth UID |
| `courses` | Course Service | Document ID = auto |
| `courses/{id}/semesters` | Course Service | Sub-collection |
| `courses/{id}/semesters/{id}/subjects` | Course Service | Sub-collection |
| `enrollments` | Enrollment Service | Document ID = `${studentUid}_${courseId}` |
| `progress` | Progress Service | Document ID = `${studentUid}_${subjectId}` |
| `notifications` | Notification Service | Document ID = auto |
| `audit_log` | Audit Service | Append-only |
| `outbox` | All services (write), Outbox Worker (read) | Transactional outbox |

### Firestore Repository Pattern

```typescript
// packages/course-service/src/infrastructure/repositories/FirestoreCourseRepository.ts
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ICourseRepository } from '@/domain/repositories/ICourseRepository';
import { Course } from '@/domain/entities/Course';

const db = getFirestore();
const COURSES = 'courses';

export class FirestoreCourseRepository implements ICourseRepository {

  async findById(id: string): Promise<Course | null> {
    const doc = await db.collection(COURSES).doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.id, doc.data()!);
  }

  async findPublished(limit: number, cursor?: string): Promise<{ items: Course[]; nextCursor: string | null }> {
    let query = db.collection(COURSES)
      .where('state', '==', 'published')
      .where('deletedAt', '==', null)
      .orderBy('publishedAt', 'desc')
      .limit(limit + 1);

    if (cursor) {
      const cursorDoc = await db.collection(COURSES).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.slice(0, limit).map(d => this.toDomain(d.id, d.data()));
    const nextCursor = snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null;
    return { items, nextCursor };
  }

  async create(course: Course): Promise<void> {
    await db.collection(COURSES).doc(course.id).set({
      ...this.toFirestore(course),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(course: Course): Promise<void> {
    await db.collection(COURSES).doc(course.id).update({
      ...this.toFirestore(course),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async softDelete(id: string): Promise<void> {
    await db.collection(COURSES).doc(id).update({
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  private toDomain(id: string, data: any): Course {
    return new Course({
      id,
      title:         data.title,
      description:   data.description,
      coverImageUrl: data.coverImageUrl ?? null,
      state:         data.state,
      createdBy:     data.createdBy,
      createdByName: data.createdByName,
      semesterCount: data.semesterCount ?? 0,
      publishedAt:   data.publishedAt?.toDate().toISOString() ?? null,
      deletedAt:     data.deletedAt?.toDate().toISOString() ?? null,
    });
  }

  private toFirestore(course: Course): Record<string, unknown> {
    return {
      title:         course.title,
      titleSlug:     course.titleSlug,
      description:   course.description,
      coverImageUrl: course.coverImageUrl,
      state:         course.state,
      createdBy:     course.createdBy,
      createdByName: course.createdByName,
      semesterCount: course.semesterCount,
    };
  }
}
```

### Composite Indexes (firestore.indexes.json — per service)

```json
{
  "indexes": [
    {
      "collectionGroup": "courses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "state",       "order": "ASCENDING"  },
        { "fieldPath": "publishedAt", "order": "DESCENDING" },
        { "fieldPath": "deletedAt",   "order": "ASCENDING"  }
      ]
    },
    {
      "collectionGroup": "enrollments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "state",     "order": "ASCENDING" },
        { "fieldPath": "courseId",  "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "progress",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "studentUid", "order": "ASCENDING" },
        { "fieldPath": "courseId",   "order": "ASCENDING" },
        { "fieldPath": "state",      "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userUid",   "order": "ASCENDING"  },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 12. Service Implementation Patterns

### Standard Express App Bootstrap

```typescript
// packages/[service]/src/app.ts
import 'reflect-metadata';
import express, { Application } from 'express';
import helmet from 'helmet';
import { json } from 'body-parser';
import { initFirebaseAdmin } from '@shared/firebase';
import { errorHandler } from '@shared/errors';
import { httpLogger } from '@shared/logger';
import { healthRouter } from '@shared/health';
import { serviceRouter } from './http/routes/index';

export function createApp(): Application {
  initFirebaseAdmin(); // idempotent

  const app = express();
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(httpLogger);
  app.use(healthRouter);          // /healthz and /readyz
  app.use('/api/v1', serviceRouter);
  app.use(errorHandler);          // Global error handler -- MUST be last
  return app;
}
```

### Global Error Handler (NFR-AVL-006)

```typescript
// packages/shared/errors/src/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string ?? 'unknown';
  const statusCode = err.status ?? err.statusCode ?? 500;

  // Log full error for internal debugging
  logger.error({ err, requestId, method: req.method, url: req.url }, 'Request failed');

  // Sanitised response -- NEVER expose stack traces (NFR-AVL-006)
  res.status(statusCode).json({
    error: {
      code:    err.errorCode ?? 'INTERNAL_ERROR',
      message: statusCode < 500 ? err.message : 'An internal error occurred. Please try again.',
      details: statusCode === 400 ? err.details : undefined,
    },
    requestId,
  });
}
```

### Health & Readiness Probes (NFR-AVL-002)

```typescript
// packages/shared/health/src/healthRouter.ts
import { Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';

export const healthRouter = Router();

// Liveness: process is running
healthRouter.get('/healthz', (_, res) => {
  res.json({ status: 'ok', service: process.env.SERVICE_NAME });
});

// Readiness: Firestore is reachable
healthRouter.get('/readyz', async (_, res) => {
  try {
    await getFirestore().collection('_health').doc('probe').get();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready', error: 'Firestore unreachable' });
  }
});
```

### Controller Pattern (Thin)

```typescript
// packages/course-service/src/http/controllers/CourseController.ts
import { Request, Response, NextFunction } from 'express';
import { PublishCourseUseCase } from '@/application/useCases/PublishCourseUseCase';
import { AuthenticatedRequest } from '@shared/auth-middleware';
import { sendSuccess } from '@shared/response';

export class CourseController {
  constructor(private readonly publishCourseUseCase: PublishCourseUseCase) {}

  publishCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { uid: actorUid } = (req as AuthenticatedRequest).principal;
      const course = await this.publishCourseUseCase.execute(id, actorUid);
      sendSuccess(res, course, 200);
    } catch (err) {
      next(err); // Delegate to global error handler
    }
  };
}
```

### Dependency Injection (Manual Constructor Injection)

```typescript
// packages/course-service/src/container.ts
import { FirestoreCourseRepository }   from './infrastructure/repositories/FirestoreCourseRepository';
import { FirestoreSemesterRepository } from './infrastructure/repositories/FirestoreSemesterRepository';
import { FirestoreOutboxRepository }   from './infrastructure/repositories/FirestoreOutboxRepository';
import { CourseEventPublisher }        from './application/events/CourseEventPublisher';
import { PublishCourseUseCase }        from './application/useCases/PublishCourseUseCase';
import { CourseController }            from './http/controllers/CourseController';

// Infrastructure
const courseRepo   = new FirestoreCourseRepository();
const semesterRepo = new FirestoreSemesterRepository();
const outboxRepo   = new FirestoreOutboxRepository();

// Application
const eventPublisher = new CourseEventPublisher(outboxRepo);
const publishUseCase = new PublishCourseUseCase(courseRepo, semesterRepo, eventPublisher);

// HTTP
export const courseController = new CourseController(publishUseCase);
```

---

## 13. Transactional Outbox Pattern

The Outbox Pattern guarantees domain events are **never lost** even if Notification or Audit Service is temporarily down. Events are written atomically with primary business data in the same Firestore transaction.

### Outbox Collection Schema

```
outbox -- collection (Document ID = auto)
  id:          string   -- UUID v4 (deduplication key)
  eventType:   string   -- e.g., 'registration.approved'
  payload:     map      -- event-specific data
  requestId:   string   -- X-Request-Id correlation
  status:      string   -- 'pending' | 'processing' | 'delivered' | 'failed'
  attempts:    number   -- delivery attempt count (max 5)
  createdAt:   timestamp
  processedAt: timestamp (optional)
  error:       string   (optional, last error message)
```

### Writing to Outbox (Within a Transaction)

```typescript
// packages/shared/events/src/OutboxEventPublisher.ts
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

export class OutboxEventPublisher {
  private readonly db = getFirestore();

  async publishWithBatch(
    event: { type: string; payload: unknown; requestId: string },
    batch?: WriteBatch
  ): Promise<void> {
    const entry = {
      id:          uuidv4(),
      eventType:   event.type,
      payload:     event.payload,
      requestId:   event.requestId,
      status:      'pending',
      attempts:    0,
      createdAt:   new Date().toISOString(),
      processedAt: null,
      error:       null,
    };

    const ref = this.db.collection('outbox').doc();
    if (batch) {
      batch.set(ref, entry);
    } else {
      await ref.set(entry);
    }
  }
}
```

### Outbox Worker

```typescript
// packages/outbox-worker/src/worker.ts
import cron from 'node-cron';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { EventDispatcher } from './dispatcher/EventDispatcher';
import { logger } from '@shared/logger';

const db = getFirestore();
const dispatcher = new EventDispatcher();

// Poll every 5 seconds (configurable via OUTBOX_POLL_INTERVAL_SECONDS)
cron.schedule('*/5 * * * * *', async () => {
  const snapshot = await db.collection('outbox')
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(20) // OUTBOX_BATCH_SIZE
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const entry = doc.data();

    // Mark as processing to prevent double-dispatch
    await doc.ref.update({ status: 'processing' });

    try {
      await dispatcher.dispatch(entry.eventType, entry.payload, entry.requestId);
      await doc.ref.update({ status: 'delivered', processedAt: Timestamp.now() });
      logger.info({ eventId: entry.id, eventType: entry.eventType }, 'Event dispatched');
    } catch (err: any) {
      const attempts = (entry.attempts ?? 0) + 1;
      const status = attempts >= 5 ? 'failed' : 'pending';
      await doc.ref.update({ status, attempts, error: err.message });
      logger.error({ err, eventId: entry.id, attempts }, 'Event dispatch failed');
    }
  }
});
```

---

## 14. Error Handling & Response Contracts

### Standard Error Envelope (from SRS Section 7.2.1)

```json
{
  "error": {
    "code":    "COURSE_NOT_FOUND",
    "message": "The requested course could not be found.",
    "details": {
      "courseId": ["Course with this ID does not exist"]
    }
  },
  "requestId": "7f3a1c2d-4e5b-6f7a-8b9c-0d1e2f3a4b5c"
}
```

### Application Error Class

```typescript
// packages/shared/errors/src/AppError.ts
export class AppError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, AppError);
  }
}

export function createHttpError(
  status: number, errorCode: string, message: string,
  details?: Record<string, string[]>
): AppError {
  return new AppError(status, errorCode, message, details);
}
```

### HTTP Status Code Policy

| Status | When Used |
|--------|-----------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Zod validation failure |
| 401 | Missing / expired / revoked token |
| 403 | Valid token, insufficient role or ownership |
| 404 | Resource does not exist (or DRAFT course accessed by student) |
| 409 | Duplicate email, duplicate enrollment, invalid state transition |
| 415 | Invalid attachment MIME type |
| 422 | Business rule violation (publish with no subjects) |
| 429 | Rate limit exceeded |
| 500 | Unhandled exception (sanitised message returned) |
| 502 | Downstream service unreachable (Gateway level) |
| 503 | Readiness check failed |

---

## 15. Security Implementation

### OWASP Top 10 Mitigations

| Risk | Mitigation |
|------|-----------|
| A01 Broken Access Control | Central `authenticate()` + `authorize()` in every service; ownership guards; CI tests |
| A02 Cryptographic Failures | TLS 1.2+ everywhere; Firebase-managed credential hashing; Google at-rest encryption |
| A03 Injection | Typed Firestore SDK queries; Zod schema validation; allowlisted field paths |
| A05 Security Misconfiguration | Hardened Dockerfile; least-privilege IAM; default-deny Firestore rules |
| A07 Auth Failures | Firebase abuse-detection + application lockout; `checkRevoked=true` always |
| A08 Software & Data Integrity | Signed Docker images; `package-lock.json` committed; `npm audit` in CI |
| A09 Logging & Monitoring Failures | Pino structured logs; OpenTelemetry traces; 5xx rate alerts |

### Account Lockout (FR-AUTH-008)

```typescript
// packages/auth-service/src/application/useCases/TrackLoginAttemptsUseCase.ts
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export class TrackLoginAttemptsUseCase {
  async recordFailedAttempt(email: string): Promise<void> {
    const db = getFirestore();
    const ref = db.collection('loginAttempts').doc(email);

    await db.runTransaction(async (t) => {
      const doc  = await t.get(ref);
      const data = doc.data() ?? { count: 0, windowStart: Timestamp.now() };
      const now  = Date.now();

      if (now - data.windowStart.toDate().getTime() > LOCKOUT_WINDOW_MS) {
        t.set(ref, { count: 1, windowStart: Timestamp.now() });
        return;
      }

      const newCount = (data.count ?? 0) + 1;
      t.update(ref, { count: FieldValue.increment(1) });

      if (newCount >= LOCKOUT_THRESHOLD) {
        const user = await getAuth().getUserByEmail(email);
        await getAuth().updateUser(user.uid, { disabled: true });
        // Notification Service will handle email notification via domain event
      }
    });
  }
}
```

---

## 16. Observability — Logging, Metrics, Tracing

### Structured Logging (Pino) — Redaction

```typescript
// packages/shared/logger/src/index.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    env:     process.env.NODE_ENV,
  },
  serializers: {
    req: (req) => ({
      method:    req.method,
      url:       req.url,
      requestId: req.headers['x-request-id'],
    }),
    err: pino.stdSerializers.err,
  },
  // Never log tokens or passwords (NFR-SEC-004)
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', '*.idToken'],
    censor: '[REDACTED]',
  },
});
```

### Metrics (Prometheus-compatible per service)

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `service`, `method`, `route`, `status` |
| `http_request_duration_seconds` | Histogram | `service`, `method`, `route` |
| `firestore_reads_total` | Counter | `service`, `collection` |
| `domain_events_published_total` | Counter | `service`, `event_type` |
| `outbox_pending_events` | Gauge | `service` |

### Distributed Tracing (OpenTelemetry)

```typescript
// packages/shared/tracing/src/index.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';

export function initTracing(serviceName: string): void {
  new NodeSDK({
    serviceName,
    traceExporter: new TraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  }).start();
}
```

### Alerts — Four Golden Signals (NFR-AVL-008)

| Signal | Alert Condition |
|--------|----------------|
| **Latency** | p95 read latency > 600 ms for 5-min rolling window |
| **Traffic** | Sudden 3x spike in requests/min (anomaly detection) |
| **Errors** | 5xx error rate > 1% for any service for 2 min |
| **Saturation** | CPU > 80% for any pod for 5 min; memory > 85% |

---

## 17. Scalability & Deployment

### Dockerfile (Shared Pattern per Service)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY packages/[service-name] ./packages/[service-name]

RUN npm ci --workspace=packages/[service-name] --include-workspace-root
RUN npm run build --workspace=packages/[service-name]

# --- Production stage ---
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/[service-name]/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "dist/server.js"]
```

### Docker Compose — Local Development

```yaml
# docker-compose.yml
version: '3.9'
services:
  gateway:
    build: { context: ., dockerfile: packages/gateway/Dockerfile }
    ports: ['3000:3000']
    environment:
      SERVICE_AUTH_URL:          http://auth-service:3001
      SERVICE_USER_URL:          http://user-service:3002
      SERVICE_COURSE_URL:        http://course-service:3003
      SERVICE_ENROLLMENT_URL:    http://enrollment-service:3004
      SERVICE_PROGRESS_URL:      http://progress-service:3005
      SERVICE_STORAGE_URL:       http://storage-service:3006
      SERVICE_NOTIFICATION_URL:  http://notification-service:3007
      SERVICE_AUDIT_URL:         http://audit-service:3008
    depends_on:
      - auth-service
      - user-service
      - course-service
      - enrollment-service
      - progress-service

  auth-service:
    build: { context: ., dockerfile: packages/auth-service/Dockerfile }
    ports: ['3001:3001']
    env_file: .env.local

  user-service:
    build: { context: ., dockerfile: packages/user-service/Dockerfile }
    ports: ['3002:3002']
    env_file: .env.local

  course-service:
    build: { context: ., dockerfile: packages/course-service/Dockerfile }
    ports: ['3003:3003']
    env_file: .env.local

  enrollment-service:
    build: { context: ., dockerfile: packages/enrollment-service/Dockerfile }
    ports: ['3004:3004']
    env_file: .env.local

  progress-service:
    build: { context: ., dockerfile: packages/progress-service/Dockerfile }
    ports: ['3005:3005']
    env_file: .env.local

  storage-service:
    build: { context: ., dockerfile: packages/storage-service/Dockerfile }
    ports: ['3006:3006']
    env_file: .env.local

  notification-service:
    build: { context: ., dockerfile: packages/notification-service/Dockerfile }
    ports: ['3007:3007']
    env_file: .env.local

  audit-service:
    build: { context: ., dockerfile: packages/audit-service/Dockerfile }
    ports: ['3008:3008']
    env_file: .env.local

  outbox-worker:
    build: { context: ., dockerfile: packages/outbox-worker/Dockerfile }
    env_file: .env.local
    depends_on: [notification-service, audit-service]
```

### Kubernetes HPA (per service)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: course-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: course-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Scalability Properties

| Property | Implementation |
|---------|---------------|
| Stateless services (NFR-SCL-001) | No session state in process memory; identity from Firebase ID token per request |
| Horizontal scaling (NFR-SCL-002) | HPA per service; CPU + memory triggers |
| Load balancing (NFR-SCL-003) | L7 load balancer terminates TLS; round-robin to healthy pods |
| Hot-spot avoidance (NFR-SCL-004) | Composite Firestore document IDs; no monotonic counters on indexed fields |
| Async side-effects (NFR-SCL-006) | Notification + Audit writes via Outbox Worker; API unaffected by failures |
| Graceful shutdown (NFR-SCL-007) | `preStop` sleep + `terminationGracePeriodSeconds: 30` |

---

## 18. Environment Configuration

```bash
# .env.example -- commit this; .env.local is gitignored

# Service Identity
SERVICE_NAME=course-service
SERVICE_VERSION=1.0.0
NODE_ENV=development
PORT=3003
LOG_LEVEL=info

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Internal Service URLs
SERVICE_AUTH_URL=http://localhost:3001
SERVICE_USER_URL=http://localhost:3002
SERVICE_COURSE_URL=http://localhost:3003
SERVICE_ENROLLMENT_URL=http://localhost:3004
SERVICE_PROGRESS_URL=http://localhost:3005
SERVICE_STORAGE_URL=http://localhost:3006
SERVICE_NOTIFICATION_URL=http://localhost:3007
SERVICE_AUDIT_URL=http://localhost:3008

# Internal Service Auth
INTERNAL_SERVICE_KEY=change-this-to-a-strong-random-secret

# Email Provider
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=noreply@yourdomain.com

# Gateway CORS
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
AUTH_RATE_LIMIT_MAX=10

# Storage
ATTACHMENT_MAX_SIZE_BYTES=26214400
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Outbox Worker
OUTBOX_POLL_INTERVAL_SECONDS=5
OUTBOX_BATCH_SIZE=20

# Enrollment Rules
ENROLLMENT_REJECTION_COOLOFF_HOURS=24

# Tracing
OTEL_SERVICE_NAME=${SERVICE_NAME}
```

---

## 19. Testing Strategy

### Testing Pyramid

```
             +------------+
             |    E2E     |  ~30 tests (Supertest + Firestore emulator)
             |   Tests    |  Full request chain across services
             +------------+
        +----+Integration +----+
        |    |   Tests    |    |  ~80 tests (Jest + Firestore emulator)
        |    +------------+    |  Use Cases + Repositories + Auth middleware
    +---+--------------------+--+
    |       Unit Tests          |  ~200 tests (Jest)
    | Entities | Use Cases | Utils  Pure logic, no I/O, no Firestore
    +---------------------------+
```

### Unit Test — Progress Aggregate

```typescript
// packages/progress-service/tests/unit/ComputeCourseProgressUseCase.test.ts
describe('ComputeCourseProgressUseCase', () => {
  const mockProgressRepo = { findByCourseAndStudent: jest.fn() };
  const mockCourseClient = { getSubjectCount: jest.fn() };
  const useCase = new ComputeCourseProgressUseCase(
    mockProgressRepo as any, mockCourseClient as any
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns 0% when no subjects are completed', async () => {
    mockCourseClient.getSubjectCount.mockResolvedValue(5);
    mockProgressRepo.findByCourseAndStudent.mockResolvedValue([]);
    const result = await useCase.execute('student-1', 'course-1');
    expect(result.completionPercent).toBe(0);
    expect(result.pendingCount).toBe(5);
  });

  it('computes correct percentage with 1 decimal place', async () => {
    mockCourseClient.getSubjectCount.mockResolvedValue(3);
    mockProgressRepo.findByCourseAndStudent.mockResolvedValue([
      { state: 'completed', lastAccessedAt: '2026-05-01T10:00:00Z', subjectId: 's1' },
    ]);
    const result = await useCase.execute('student-1', 'course-1');
    expect(result.completionPercent).toBe(33.3);
  });

  it('returns 100% when all subjects are completed', async () => {
    mockCourseClient.getSubjectCount.mockResolvedValue(2);
    mockProgressRepo.findByCourseAndStudent.mockResolvedValue([
      { state: 'completed', lastAccessedAt: '2026-05-01T10:00:00Z', subjectId: 's1' },
      { state: 'completed', lastAccessedAt: '2026-05-02T10:00:00Z', subjectId: 's2' },
    ]);
    const result = await useCase.execute('student-1', 'course-1');
    expect(result.completionPercent).toBe(100);
  });
});
```

### Integration Test — Idempotency (FR-LRN-008)

```typescript
// packages/progress-service/tests/integration/markComplete.test.ts
describe('POST /api/v1/progress/subjects/:id/complete', () => {
  it('is idempotent -- second call does not change completedAt', async () => {
    const app = createApp();

    const first = await request(app)
      .post('/api/v1/progress/subjects/subject-1/complete')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const second = await request(app)
      .post('/api/v1/progress/subjects/subject-1/complete')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    // completedAt MUST NOT change on second call (FR-LRN-008)
    expect(second.body.completedAt).toBe(first.body.completedAt);
    expect(second.body.state).toBe('completed');
  });
});
```

### Firestore Security Rules Test

```typescript
// packages/audit-service/tests/rules/auditLog.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment }
  from '@firebase/rules-unit-testing';

describe('audit_log Firestore Security Rules', () => {
  it('denies client writes to audit_log', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const studentDb = env.authenticatedContext('student-uid', { role: 'student' }).firestore();
    await assertFails(studentDb.collection('audit_log').add({ action: 'fake' }));
  });

  it('denies updates to existing audit_log documents', async () => {
    const env = await initializeTestEnvironment({ projectId: 'test' });
    const adminDb = env.authenticatedContext('admin-uid', { role: 'super_admin' }).firestore();
    await assertFails(
      adminDb.collection('audit_log').doc('existing').update({ action: 'tampered' })
    );
  });
});
```

---

## 20. CI/CD Pipeline

### Per-Service Pipeline

```yaml
# .github/workflows/service-ci.yml (illustrative)
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
      - Scan image with Trivy (block on HIGH/CRITICAL CVEs) [NFR-SEC-012]
      - Push image to registry (main branch only)

  deploy-staging:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    steps:
      - Deploy to staging Kubernetes cluster
      - Run E2E smoke tests against staging

  deploy-production:
    needs: deploy-staging
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - Deploy to production Kubernetes cluster
      - Run production smoke tests
```

### Contract Testing

Consumer-driven contract tests run in CI to prevent API drift between services:

```
slp-contracts repository publishes:
  - OpenAPI 3.1 spec
  - TypeScript DTO types
  - Pact consumer contracts

Each service CI pipeline:
  1. Pulls pinned version of slp-contracts
  2. Runs Pact provider tests to verify the service honours all contracts
  3. Fails build if any contract is broken
```

### Local Quick Start

```bash
# 1. Clone and install
git clone https://github.com/futurecx/slp-backend.git && cd slp-backend
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in Firebase credentials

# 3. Start Firebase emulators
npx firebase emulators:start --only firestore,auth,storage

# 4. Start all services
docker-compose up --build

# OR run a single service in watch mode
npm run dev --workspace=packages/course-service

# 5. Run tests
npm run test                # All unit tests across workspaces
npm run test:integration    # Integration tests (requires emulators)
npm run test:e2e            # E2E tests (requires all services running)

# 6. Type-check all workspaces
npm run type-check

# 7. Lint all workspaces
npm run lint
```

---

## 21. SRS Requirement Traceability

| SRS Requirement | Service | Implementation |
|-----------------|---------|---------------|
| FR-AUTH-001 | Auth Service | `POST /auth/register` -> `RegisterUseCase` |
| FR-AUTH-002 | Auth Service | Email uniqueness check via User Service internal API |
| FR-AUTH-003 | Auth Service | Firebase Auth password policy (min 10 chars + complexity) |
| FR-AUTH-004 | All Services | `authenticate()` shared middleware; `verifyIdToken(checkRevoked=true)` |
| FR-AUTH-005 | Auth Service | Firebase SDK handles token refresh; no custom refresh endpoint |
| FR-AUTH-006 | Auth Service | `POST /auth/logout` -> `revokeRefreshTokens(uid)` |
| FR-AUTH-007 | All Services | `authorize()` shared middleware; custom role claims |
| FR-AUTH-008 | Auth Service | `TrackLoginAttemptsUseCase` -- lockout after 10 attempts in 15 min |
| FR-AUTH-009 | Auth Service | Firebase `sendPasswordResetEmail` |
| FR-AUTH-010 | Auth Service | `revokeRefreshTokens` + `checkRevoked=true` on all token verifications |
| FR-SADM-001 | User Service | `POST /super-admin/admins` -> `CreateAdminUseCase` |
| FR-SADM-002 | User Service | `GET /super-admin/admins` paginated |
| FR-SADM-003 | User Service | `POST /super-admin/admins/:id/suspend` -> `revokeRefreshTokens` |
| FR-SADM-004 | User Service | `POST /super-admin/admins/:id/reactivate` |
| FR-SADM-005 | User Service | `DELETE /super-admin/admins/:id` -> soft-delete + reassign |
| FR-SADM-007 | Audit Service | `GET /audit-log` with filters (actor, action, date range) |
| FR-ADM-002 | User/Course/Enrollment Services | Dashboard stats via multiple internal queries |
| FR-ADM-007 | Enrollment Service | `POST /admin/registrations/:id/approve` -> `ApproveRegistrationUseCase` |
| FR-ADM-008 | Enrollment Service | `POST /admin/enrollments/:id/approve` -> `ApproveEnrollmentUseCase` |
| FR-ADM-009 | User Service | `GET /users` paginated + filterable by status and course |
| FR-ADM-011 | Enrollment Service | `BulkApproveRegistrationsUseCase` with `Promise.allSettled` |
| FR-STU-001 | Auth Service | `POST /auth/register` creates PENDING_APPROVAL account |
| FR-STU-005 | Course Service | `GET /courses` filters `state=published` for student role |
| FR-STU-006 | Course Service | `GET /courses/:id` returns 404 if DRAFT and role=student |
| FR-STU-007 | Enrollment Service | `POST /courses/:id/enroll` -> `CreateEnrollmentUseCase` |
| FR-STU-011 | Progress Service | `POST /progress/subjects/:id/complete` -> `MarkSubjectCompleteUseCase` |
| FR-STU-013 | Progress Service | `source=auto` on threshold-triggered completion |
| FR-CRS-004 | Course Service | `PublishCourseUseCase` validates semesters + subjects before publishing |
| FR-CRS-009 | Course Service | `YouTubeVideoId.from()` value object validates 11-char ID + URL parsing |
| FR-CRS-010 | Storage Service | Multer MIME type + file size validation on upload |
| FR-CRS-012 | Course Service | Soft-delete with `deletedAt` timestamp; recoverable 30 days |
| FR-ENR-001 | Enrollment Service | `GET /admin/registrations?status=pending` |
| FR-ENR-002 | Enrollment Service | `ApproveRegistrationUseCase` -> User Service -> email event |
| FR-ENR-004 | Enrollment Service | Max 1 PENDING per (student, course) enforced in use case |
| FR-ENR-008 | Enrollment Service | Cool-off period check using `ENROLLMENT_REJECTION_COOLOFF_HOURS` |
| FR-LRN-001 | Progress Service | `progress` collection with state + source + timestamps |
| FR-LRN-004 | Progress Service | `ComputeCourseProgressUseCase` -- recomputed on every progress event |
| FR-LRN-007 | Progress Service | `lastAccessedAt` updated via `POST /progress/subjects/:id/access` |
| FR-LRN-008 | Progress Service | `MarkSubjectCompleteUseCase` returns existing record if already COMPLETED |
| FR-LRN-009 | Progress Service | `POST /internal/progress/reset` (Admin action, audited) |
| FR-NOT-001 | Notification Service | `GET /me/notifications` |
| FR-NOT-002 | Notification Service | `registration.approved/rejected` event handler dispatches in-app + email |
| FR-NOT-003 | Notification Service | `enrollment.approved/rejected` event handler + push if opted-in |
| FR-NOT-006 | Notification Service | `POST /me/notifications/:id/read` and `/read-all` |
| FR-NOT-009 | Notification Service | `NotificationDispatcher` exponential backoff, max 3 retries |
| NFR-SEC-001 | Gateway | TLS at load balancer; HSTS header in Gateway response |
| NFR-SEC-002 | All Services | `authenticate(checkRevoked=true)` shared middleware |
| NFR-SEC-003 | All Services | `authorize()` per route + `mustBeOwnerOrAdmin()` ownership guard |
| NFR-SEC-007 | All Services | Typed Firestore SDK; Zod validated payloads; no string path interpolation |
| NFR-SEC-008 | Gateway | `authRateLimiter` (10/min) + `rateLimiter` (200/min) |
| NFR-SEC-009 | Gateway | CORS `origin` allowlist configured |
| NFR-SEC-011 | Audit Service | `audit_log` append-only; Firestore rules deny updates/deletes |
| NFR-SCL-001 | All Services | Stateless; Firebase token identity per request |
| NFR-SCL-002 | Kubernetes | HPA per service deployment |
| NFR-SCL-007 | Kubernetes | `preStop` hook + `terminationGracePeriodSeconds: 30` |
| NFR-AVL-001 | Kubernetes | Multi-replica; HPA; health probes |
| NFR-AVL-002 | All Services | `/healthz` (liveness) + `/readyz` (Firestore probe) per service |
| NFR-AVL-003 | All Services | Outbox pattern; push/email failures never block API response |
| NFR-AVL-004 | Firebase | Scheduled Firestore exports to Cloud Storage (RPO 24h, RTO 4h) |
| NFR-AVL-006 | All Services | Global `errorHandler`; sanitised responses; no stack traces in output |
| NFR-AVL-008 | All Services | Pino structured logs; OpenTelemetry traces; Prometheus metrics |
| NFR-PRF-007 | All Services | Repository pattern enforces read budget; N+1 detected in CI lint |
| NFR-PRF-008 | All Services | Stateless pods; HPA enables throughput >= 500 req/s per pod |

---

## Appendix A — Shared Package APIs

| Package | Exports |
|---------|---------|
| `@shared/auth-middleware` | `authenticate()`, `authorize()`, `mustBeOwnerOrAdmin()`, `AuthenticatedRequest` |
| `@shared/errors` | `AppError`, `createHttpError()`, `fromZodError()`, `errorHandler` |
| `@shared/events` | `DomainEvent`, `OutboxEventPublisher` |
| `@shared/logger` | `logger` (Pino with redaction), `httpLogger` (pino-http) |
| `@shared/response` | `sendSuccess()`, `sendPaginated()` |
| `@shared/internal-http-client` | `createInternalClient()` |
| `@shared/health` | `healthRouter` (`/healthz` + `/readyz`) |
| `@shared/firebase` | `initFirebaseAdmin()` (idempotent) |
| `@shared/tracing` | `initTracing(serviceName)` |

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
*Document version: 1.0.0 | Paired with SRS dated 07 May 2026 and CMP Blueprint v1.0.0*
