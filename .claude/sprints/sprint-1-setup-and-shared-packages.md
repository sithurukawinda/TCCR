# Sprint 1 — Project Setup & Shared Packages

**Sprint:** 1 of 7  
**Week:** 1  
**Focus:** Monorepo scaffold + all shared packages  
**Status:** `[x] Complete`

---

## Goal

By end of Sprint 1, the monorepo is initialised, Firebase emulators run locally, and all shared packages are built and unit-tested. Every microservice added in later sprints will import from these packages.

---

## Services Involved

| Package | Port | Type |
|---------|------|------|
| `@shared/firebase` | — | Shared lib |
| `@shared/logger` | — | Shared lib |
| `@shared/errors` | — | Shared lib |
| `@shared/auth-middleware` | — | Shared lib |
| `@shared/events` | — | Shared lib |
| `@shared/internal-http-client` | — | Shared lib |
| `@shared/response` | — | Shared lib |
| `@shared/health` | — | Shared lib |
| `@shared/tracing` | — | Shared lib |

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S1-01 | As a developer, I can run `npm install` from root and all workspace packages resolve | 2 |
| S1-02 | As a developer, I can start Firebase emulators with one command | 1 |
| S1-03 | As a developer, `authenticate()` verifies a valid token and rejects expired/revoked tokens | 3 |
| S1-04 | As a developer, `authorize()` enforces roles and `super_admin` inherits `admin` | 2 |
| S1-05 | As a developer, `createHttpError()` produces errors with correct status and code | 1 |
| S1-06 | As a developer, `errorHandler` never leaks stack traces in 5xx responses | 2 |
| S1-07 | As a developer, Pino logger redacts `Authorization`, `password`, `token`, `idToken` | 2 |
| S1-08 | As a developer, `OutboxEventPublisher` writes to the `outbox` collection atomically | 3 |
| S1-09 | As a developer, `createInternalClient()` propagates `X-Request-Id` and retries once on 5xx | 2 |
| S1-10 | As a developer, `/healthz` returns `200` and `/readyz` checks Firestore connectivity | 1 |

**Total Points:** 19

---

## Tasks

### Phase 0 — Monorepo Root

- [x] `package.json` — npm workspaces, root scripts (`type-check`, `lint`, `format`, `test`, `test:integration`)
- [x] `tsconfig.base.json` — strict mode, `paths` for `@shared/*`
- [x] `.eslintrc.json` — TypeScript ESLint rules
- [x] `.prettierrc`
- [x] `jest.config.ts` — unit test config (`tests/unit/**`)
- [x] `jest.integration.config.ts` — integration test config (`tests/integration/**`)
- [x] `docker-compose.yml` — stub entries for all 10 services
- [x] `.env.example` — all required environment variables documented
- [x] `.gitignore` — `node_modules`, `.env.local`, `dist/`, `*.js.map`
- [x] `firebase.json` — emulator config (Firestore :8080, Auth :9099, Storage :9199, UI :4000)
- [x] `firestore.rules` — default deny-all client writes (updated per service later)

### Phase 1 — Shared Packages

#### `packages/shared/firebase/`
- [x] `initFirebaseAdmin()` — reads `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; idempotent (no double-init)
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/logger/`
- [x] `logger` — Pino with `service`, `version`, `env` base fields
- [x] Redaction: `req.headers.authorization`, `*.password`, `*.token`, `*.idToken`
- [x] `httpLogger` — pino-http middleware
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/errors/`
- [x] `AppError` class — `status`, `errorCode`, `message`, `details?`
- [x] `createHttpError(status, code, message, details?)` factory
- [x] `fromZodError(zodError)` — converts Zod errors to `AppError` with field-level `details`
- [x] `errorHandler` — sanitises 5xx (no stack traces), logs full error server-side
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/auth-middleware/`
- [x] `authenticate()` — extracts Bearer token, calls `verifyIdToken(token, checkRevoked=true)`, attaches `req.principal`
- [x] Error mapping: `auth/id-token-revoked` → `401 TOKEN_REVOKED`, `auth/id-token-expired` → `401 TOKEN_EXPIRED`, other → `401 INVALID_TOKEN`
- [x] `authorize(...roles)` — checks `req.principal.role`; `super_admin` auto-inherits `admin`
- [x] `mustBeOwnerOrAdmin(getResourceUid)` — ownership guard
- [x] `AuthenticatedRequest` TypeScript type
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/events/`
- [x] `DomainEvent<T>` interface — `id` (UUID v4), `type`, `occurredAt`, `requestId`, `payload`
- [x] `OutboxEventPublisher` — writes to `outbox` collection; accepts optional `WriteBatch` for atomic writes
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/internal-http-client/`
- [x] `createInternalClient(serviceUrl, serviceKey)` — axios instance
- [x] Request interceptor: attach `X-Internal-Service-Key`, propagate `X-Request-Id` from `AsyncLocalStorage`
- [x] Response interceptor: single retry on 5xx with 500 ms backoff
- [x] 5-second timeout
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/response/`
- [x] `sendSuccess(res, data, status?)` — default status 200
- [x] `sendPaginated(res, items, nextCursor, total)` — `{ items, nextCursor, total }`
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/health/`
- [x] `healthRouter` — `GET /healthz` returns `{ status: 'ok', service: SERVICE_NAME }`
- [x] `GET /readyz` — attempts Firestore read on `_health/probe`; returns `503` if unreachable
- [x] `package.json`, `tsconfig.json`

#### `packages/shared/tracing/`
- [x] `initTracing(serviceName)` — OpenTelemetry SDK with auto-instrumentation + Google Cloud Trace exporter
- [x] `package.json`, `tsconfig.json`

---

## Unit Tests

| Test file | Cases |
|-----------|-------|
| `shared/auth-middleware/tests/authenticate.test.ts` | valid token → attaches principal; expired → 401; revoked → 401; no header → 401 |
| `shared/auth-middleware/tests/authorize.test.ts` | correct role → pass; wrong role → 403; `super_admin` passes `admin` route |
| `shared/auth-middleware/tests/ownershipGuard.test.ts` | owner → pass; non-owner student → 403; admin → pass |
| `shared/errors/tests/errorHandler.test.ts` | 4xx returns message; 5xx returns generic message; stack never in response |
| `shared/errors/tests/fromZodError.test.ts` | field-level details mapped correctly |
| `shared/events/tests/OutboxEventPublisher.test.ts` | writes to `outbox`; uses batch when provided |

---

## Acceptance Criteria

- [ ] `npm install` from root installs all workspace dependencies without errors
- [ ] `npx firebase emulators:start --only firestore,auth,storage` starts cleanly
- [ ] `npm run type-check` passes with zero errors across all shared packages
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run test` — all unit tests pass
- [ ] `authenticate()` rejects expired tokens with `401 TOKEN_EXPIRED`
- [ ] `authorize('admin')` passes for `super_admin` role
- [ ] `errorHandler` returns generic message for 500 errors — never the real error message or stack

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Next Sprint: [Sprint 2 — Gateway, Auth & User Service](sprint-2-gateway-auth-and-user-service.md)*
