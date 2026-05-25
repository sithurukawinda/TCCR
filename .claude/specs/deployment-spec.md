# Spec: Deployment & Infrastructure

**Slug:** deployment-spec  
**Service(s):** All services, outbox-worker, gateway  
**Status:** Release Baseline  
**Date:** 2026-05-07  
**Version:** 1.0.0

---

## Problem

Each microservice must be independently buildable, deployable, and scalable. The platform needs zero-downtime deployments, automatic horizontal scaling, health-based traffic routing, and a reliable CI/CD pipeline that blocks unsafe code from reaching production.

---

## 1. Local Development Setup

### Prerequisites
- Node.js >= 20.x
- Docker + Docker Compose
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Firestore, Auth, and Storage enabled

### Step-by-Step

```bash
# 1. Clone and install
git clone https://github.com/sithuru-kawinda/causemanagementsystem.git
cd causemanagementsystem
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — fill in Firebase credentials and service URLs

# 3. Start Firebase emulators (Firestore, Auth, Storage)
npx firebase emulators:start --only firestore,auth,storage

# 4a. Start all services together
docker-compose up --build

# 4b. OR run a single service in watch mode (faster for development)
npm run dev --workspace=packages/course-service
```

### Emulator Ports

| Emulator | Port |
|----------|------|
| Firestore | 8080 |
| Firebase Auth | 9099 |
| Firebase Storage | 9199 |
| Emulator UI | 4000 |

---

## 2. Environment Variables

All services share a common `.env.local` file (gitignored). `.env.example` is committed and shows all required keys.

### Required Variables

```bash
# Service identity (set per service)
SERVICE_NAME=course-service
SERVICE_VERSION=1.0.0
NODE_ENV=development
PORT=3003
LOG_LEVEL=info

# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Internal service URLs (used by inter-service HTTP client)
SERVICE_AUTH_URL=http://localhost:3001
SERVICE_USER_URL=http://localhost:3002
SERVICE_COURSE_URL=http://localhost:3003
SERVICE_ENROLLMENT_URL=http://localhost:3004
SERVICE_PROGRESS_URL=http://localhost:3005
SERVICE_STORAGE_URL=http://localhost:3006
SERVICE_NOTIFICATION_URL=http://localhost:3007
SERVICE_AUDIT_URL=http://localhost:3008

# Internal service auth
INTERNAL_SERVICE_KEY=change-this-to-a-strong-random-secret

# Email (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=noreply@yourdomain.com

# Gateway CORS
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
AUTH_RATE_LIMIT_MAX=10

# Firebase Storage
ATTACHMENT_MAX_SIZE_BYTES=26214400
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Outbox worker
OUTBOX_POLL_INTERVAL_SECONDS=5
OUTBOX_BATCH_SIZE=20

# Enrollment rules
ENROLLMENT_REJECTION_COOLOFF_HOURS=24

# OpenTelemetry
OTEL_SERVICE_NAME=${SERVICE_NAME}
```

---

## 3. Docker

### Dockerfile Pattern (per service)

Every service uses a two-stage build to keep production images small.

```dockerfile
# Stage 1 — Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY packages/<service-name> ./packages/<service-name>

RUN npm ci --workspace=packages/<service-name> --include-workspace-root
RUN npm run build --workspace=packages/<service-name>

# Stage 2 — Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/<service-name>/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE <port>
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:<port>/healthz || exit 1

CMD ["node", "dist/server.js"]
```

### Docker Compose Service Ports

| Service | Host Port | Container Port |
|---------|:---------:|:--------------:|
| gateway | 3000 | 3000 |
| auth-service | 3001 | 3001 |
| user-service | 3002 | 3002 |
| course-service | 3003 | 3003 |
| enrollment-service | 3004 | 3004 |
| progress-service | 3005 | 3005 |
| storage-service | 3006 | 3006 |
| notification-service | 3007 | 3007 |
| audit-service | 3008 | 3008 |
| outbox-worker | 3009 | 3009 |

---

## 4. Kubernetes

### Deployment (per service)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <service-name>
spec:
  replicas: 2
  selector:
    matchLabels:
      app: <service-name>
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: <service-name>
          image: gcr.io/<project>/<service-name>:latest
          ports:
            - containerPort: <port>
          envFrom:
            - secretRef:
                name: cmp-secrets
          livenessProbe:
            httpGet:
              path: /healthz
              port: <port>
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /readyz
              port: <port>
            initialDelaySeconds: 5
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "5"]
```

### Horizontal Pod Autoscaler (per service)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: <service-name>-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: <service-name>
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

### Health Probes

| Probe | Endpoint | Checks |
|-------|----------|--------|
| Liveness (`/healthz`) | All services | Process is alive |
| Readiness (`/readyz`) | All services | Firestore is reachable |

Kubernetes removes pods from load balancer rotation when readiness fails. Liveness failure triggers a pod restart.

---

## 5. CI/CD Pipeline

Pipeline runs per service, triggered on push to paths `packages/<service-name>/**` or `packages/shared/**`.

### Pipeline Stages

```
1. Checkout code
2. Setup Node.js 20.x
3. npm ci (install dependencies)
        ↓
4. tsc --noEmit (type check)          ← fail fast on type errors
        ↓
5. eslint (lint)                       ← fail on errors or warnings
        ↓
6. jest --coverage (unit tests)        ← fail if any test fails
        ↓
7. jest integration config             ← requires Firestore emulator
        ↓
8. Firestore Security Rules tests
        ↓
9. npm audit --audit-level=high        ← fail on HIGH or CRITICAL CVEs
        ↓
10. Docker image build
        ↓
11. Trivy image scan                   ← block on HIGH or CRITICAL CVEs
        ↓
12. Push image to registry             ← main branch only
        ↓
13. Deploy to staging (main branch)
        ↓
14. E2E smoke tests against staging
        ↓
15. Deploy to production (version tags only: v*)
        ↓
16. Production smoke tests
```

### Deployment Strategy

| Environment | Trigger | Strategy |
|-------------|---------|----------|
| Staging | Push to `main` branch | Rolling update |
| Production | Git tag `v*` (e.g. `v1.2.0`) | Rolling update with manual approval |

### Contract Testing

```
slp-contracts repository publishes:
  - OpenAPI 3.1 spec
  - TypeScript DTO types
  - Pact consumer contracts

Each service CI pipeline:
  1. Pulls pinned version of slp-contracts
  2. Runs Pact provider tests
  3. Fails build if any contract is broken
```

---

## 6. Firebase Deployment

### Firestore Indexes

Composite indexes are defined per service in `packages/<service-name>/firestore.indexes.json`.

```bash
# Deploy indexes for a specific service
npx firebase deploy --only firestore:indexes --project <project-id>

# Deploy all indexes
npx firebase deploy --only firestore:indexes
```

**Required composite indexes:**

| Collection | Fields |
|-----------|--------|
| `courses` | `state` ASC, `publishedAt` DESC, `deletedAt` ASC |
| `enrollments` | `state` ASC, `courseId` ASC, `createdAt` ASC |
| `progress` | `studentUid` ASC, `courseId` ASC, `state` ASC |
| `notifications` | `userUid` ASC, `createdAt` DESC |
| `audit_log` | `actorUid` ASC, `action` ASC, `createdAt` DESC |

### Firestore Security Rules

Security Rules are deployed separately from application code:

```bash
npx firebase deploy --only firestore:rules
```

Key rules:
- `audit_log` — reads allowed for `super_admin` only; writes, updates, and deletes denied for all clients
- `outbox` — no client access at all (Admin SDK only)

### Storage Rules

```bash
npx firebase deploy --only storage
```

Signed URLs are generated server-side with 15-minute expiry. Direct client uploads are not permitted.

---

## 7. Data Backup & Recovery

| Property | Value |
|----------|-------|
| Backup mechanism | Scheduled Firestore exports to Cloud Storage |
| Backup frequency | Daily |
| RPO (Recovery Point Objective) | 24 hours |
| RTO (Recovery Time Objective) | 4 hours |
| Retention period | 30 days |

---

## 8. Observability

### Logging (Pino)

- Structured JSON logs — one line per event
- Fields always present: `service`, `version`, `env`, `requestId`, `level`, `time`
- Redacted fields: `req.headers.authorization`, `*.password`, `*.token`, `*.idToken`
- Log levels: `error` (5xx), `warn` (push failures, retries), `info` (request completion, event dispatch), `debug` (disabled in production)

### Distributed Tracing (OpenTelemetry)

- Auto-instrumentation of HTTP requests, Firestore calls, and outbound HTTP
- Traces exported to Google Cloud Trace via `@google-cloud/opentelemetry-cloud-trace-exporter`
- `X-Request-Id` propagated across all internal service calls for correlation

### Metrics (Prometheus-compatible)

| Metric | Type | Labels |
|--------|------|--------|
| `http_requests_total` | Counter | `service`, `method`, `route`, `status` |
| `http_request_duration_seconds` | Histogram | `service`, `method`, `route` |
| `firestore_reads_total` | Counter | `service`, `collection` |
| `domain_events_published_total` | Counter | `service`, `event_type` |
| `outbox_pending_events` | Gauge | — |

### Alerts (Four Golden Signals)

| Signal | Alert condition |
|--------|----------------|
| Latency | p95 > 600 ms for 5-min rolling window |
| Traffic | 3x spike in req/min (anomaly detection) |
| Errors | 5xx rate > 1% for any service for 2 min |
| Saturation | CPU > 80% for any pod for 5 min; memory > 85% |

---

## Out of Scope

- Blue/green or canary deployment strategies (rolling update only in v1)
- Service mesh (Istio, Linkerd)
- Multi-region deployment
- Custom domain TLS certificate management (handled by cloud provider)
- Database migration scripts (Firestore is schemaless — no migrations)

---

*© 2026 Future CX Lanka (Pvt) Ltd — Confidential*  
*Paired with Backend Blueprint v1.0.0 §17–§20*
