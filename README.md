# CMP — Course Management Portal

Backend system for the Course Management Portal (`slp-backend`).

**Organisation:** Future CX Lanka (Pvt) Ltd  
**Version:** 1.0.0  
**Stack:** Node.js 20 · TypeScript 5 · Express 4 · Firebase (Firestore, Auth, Storage, FCM) · Microservice Architecture

---

## Overview

CMP is a microservice backend for managing online courses, student enrollments, and learning progress. It exposes a REST API versioned at `/api/v1` through a single API Gateway, with eight independently deployable services behind it.

---

## Services

| Service | Port | Responsibility |
|---------|:----:|----------------|
| API Gateway | 3000 | Rate limiting, CORS, request ID injection, reverse proxy |
| Auth Service | 3001 | Registration, logout, token verification, account lockout |
| User Service | 3002 | User profiles, admin management, account lifecycle |
| Course Service | 3003 | Courses, semesters, subjects, course lifecycle |
| Enrollment Service | 3004 | Registration queue, enrollment approvals, bulk operations |
| Progress Service | 3005 | Subject completion tracking, course progress aggregates |
| Storage Service | 3006 | File upload/download (PDF/DOC/DOCX, max 25 MB) |
| Notification Service | 3007 | In-app notifications, email, push (FCM) |
| Audit Service | 3008 | Append-only audit log |
| Outbox Worker | 3009 | Event dispatcher (transactional outbox pattern) |

---

## Tech Stack

- **Runtime:** Node.js LTS >= 20.x, TypeScript 5.x
- **Framework:** Express.js 4.x per service
- **Database:** Google Cloud Firestore (Native mode)
- **Identity:** Firebase Authentication (stateless token verification)
- **Storage:** Firebase Cloud Storage
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **Logging:** Pino structured JSON logging
- **Tracing:** OpenTelemetry → Google Cloud Trace
- **Validation:** Zod schema validation

---

## Getting Started

### Prerequisites

- Node.js >= 20.x
- Docker & Docker Compose
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Auth, and Storage enabled

### Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in Firebase credentials and service URLs in .env.local

# 3. Start Firebase emulators
npx firebase emulators:start --only firestore,auth,storage

# 4. Start all services
docker-compose up --build
```

### Run a Single Service

```bash
npm run dev --workspace=packages/course-service
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev --workspace=packages/<service>` | Run a service in watch mode |
| `npm run build --workspace=packages/<service>` | Build a service |
| `npm run type-check` | TypeScript check across all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run format` | Format all workspaces |
| `npm run test` | Run all unit tests |
| `npm run test:integration` | Run integration tests (requires emulators) |
| `npm run test:e2e` | Run E2E tests (requires all services running) |
| `docker-compose up --build` | Start all services locally |

---

## Architecture

### Clean Architecture (per service)

Each service enforces a strict one-way dependency chain:

```
http/           → routes, controllers, request validators
application/    → use cases, event publishers, inter-service clients
domain/         → entities, value objects, repository interfaces (zero infrastructure)
infrastructure/ → Firestore repositories, Firebase SDK, email/FCM clients
```

### Event-Driven Side Effects

Notifications, emails, and audit log writes are decoupled from the API response path using the **Transactional Outbox Pattern**:

1. Service writes a domain event to the `outbox` Firestore collection atomically with primary data.
2. Outbox Worker polls every 5 seconds and dispatches events to Notification Service and Audit Service via internal HTTP.
3. Guarantees at-least-once delivery with up to 5 retry attempts.

### Roles

| Role | Access |
|------|--------|
| `student` | Own profile, published courses, own enrollments, own progress |
| `admin` | All student access + user management, course management, enrollment approvals |
| `super_admin` | All admin access + admin account management, audit log access |

---

## API

All endpoints are prefixed with `/api/v1`.

Authentication: `Authorization: Bearer <firebase-id-token>`

See `.claude/APIdocument/API_Document.md` for the full REST API reference.

---

## Environment Variables

Key variables required in `.env.local`:

```
SERVICE_NAME=course-service
PORT=3003
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
INTERNAL_SERVICE_KEY=your-secret
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@yourdomain.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
ALLOWED_ORIGINS=http://localhost:3000
```

See `.env.example` for the full list.

---

## Security

- Firebase ID token verified with revocation check on every request
- Role-based access control enforced by shared middleware on every route
- Zod input validation at all service boundaries
- Rate limiting: 10 req/min (auth endpoints), 200 req/min (general)
- Helmet security headers, CORS allowlist (no wildcard in production)
- Structured logging with automatic redaction of tokens and passwords
- `audit_log` collection is append-only and immutable

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*
