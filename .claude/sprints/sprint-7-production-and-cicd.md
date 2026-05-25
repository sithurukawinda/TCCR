# Sprint 7 — Firestore Indexes, Security Rules & CI/CD Pipeline

**Sprint:** 7 of 7  
**Week:** 7  
**Focus:** Production readiness — indexes, security rules, CI/CD, Kubernetes, monitoring  
**Status:** `[x] Complete`

---

## Goal

By end of Sprint 7, all Firestore composite indexes are deployed, security rules are enforced, the CI/CD pipeline is live for all services, and the platform is deployed to staging and production on Kubernetes with full observability.

---

## Services Involved

All 10 services + infrastructure (Firebase, Kubernetes, GitHub Actions)

---

## User Stories

| ID | Story | Points |
|----|-------|:------:|
| S7-01 | All Firestore composite indexes are deployed and in READY state | 3 |
| S7-02 | Firestore Security Rules deny all unauthorised client access | 3 |
| S7-03 | A push to `main` automatically runs type-check, lint, tests, Docker build, Trivy scan, and deploys to staging | 5 |
| S7-04 | A git tag `v*` triggers a production deployment after staging smoke tests pass | 3 |
| S7-05 | HIGH or CRITICAL CVEs in Docker images block the pipeline | 2 |
| S7-06 | Each service scales between 2–10 replicas based on CPU via Kubernetes HPA | 3 |
| S7-07 | Services are removed from load balancer rotation when readiness probe fails | 2 |
| S7-08 | Structured logs, distributed traces, and Prometheus metrics are available for all services | 3 |
| S7-09 | Alerts fire when p95 latency > 600 ms or 5xx rate > 1% for any service | 2 |
| S7-10 | Daily Firestore exports to Cloud Storage are scheduled (RPO 24 h) | 2 |

**Total Points:** 28

---

## Tasks

### Phase 12 — Firestore Composite Indexes

- [ ] Deploy `courses` index: `state` ASC · `publishedAt` DESC · `deletedAt` ASC
- [ ] Deploy `enrollments` index: `state` ASC · `courseId` ASC · `createdAt` ASC
- [ ] Deploy `progress` index: `studentUid` ASC · `courseId` ASC · `state` ASC
- [ ] Deploy `notifications` index: `userUid` ASC · `createdAt` DESC
- [ ] Deploy `audit_log` index: `actorUid` ASC · `action` ASC · `createdAt` DESC
- [ ] Verify all indexes show `READY` in Firebase Console → Firestore → Indexes

```bash
npx firebase deploy --only firestore:indexes --project <project-id>
```

---

### Firestore Security Rules

- [ ] `audit_log` — reads: `super_admin` claim only; writes/updates/deletes: denied all clients
- [ ] `outbox` — no client access (Admin SDK only)
- [ ] `users` — reads: owner (`uid == request.auth.uid`) or admin/super_admin claim; writes: denied (Admin SDK only)
- [ ] `courses` — reads: published only for students; writes: denied (Admin SDK only)
- [ ] All other collections — default deny for client writes; reads scoped by role claim
- [ ] Deploy rules: `npx firebase deploy --only firestore:rules`
- [ ] Deploy Storage rules: `npx firebase deploy --only storage`
- [ ] Security Rules unit tests pass (all service-level `tests/rules/*.test.ts`)

---

### Phase 13 — CI/CD Pipeline

#### `.github/workflows/service-ci.yml` — Per Service

- [ ] Trigger: `push` on `packages/<service-name>/**` or `packages/shared/**`
- [ ] Step 1: Checkout + Node.js 20.x setup + `npm ci`
- [ ] Step 2: `tsc --noEmit` — fail on type errors
- [ ] Step 3: `eslint packages/<service>/src --max-warnings=0`
- [ ] Step 4: `jest --coverage` — unit tests
- [ ] Step 5: Firebase emulator + `npm run test:integration --workspace=packages/<service>`
- [ ] Step 6: `npm audit --audit-level=high` — fail on HIGH/CRITICAL
- [ ] Step 7: `docker build -f packages/<service>/Dockerfile -t <image>:<sha> .`
- [ ] Step 8: Trivy scan — `trivy image --exit-code 1 --severity HIGH,CRITICAL <image>`
- [ ] Step 9: Push image to registry (only on `main` branch)
- [ ] Step 10: Deploy to staging Kubernetes cluster (only on `main` branch)
- [ ] Step 11: E2E smoke tests against staging
- [ ] Step 12: Deploy to production (only on tag `v*` with manual approval)

#### GitHub Secrets Required
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `INTERNAL_SERVICE_KEY`
- [ ] `SENDGRID_API_KEY`
- [ ] `CONTAINER_REGISTRY_URL`
- [ ] `KUBE_CONFIG_STAGING`
- [ ] `KUBE_CONFIG_PRODUCTION`

---

### Kubernetes — Staging & Production

#### Deployment (per service)
- [ ] `Deployment` manifest — 2 replicas, health probes, env from secrets, `preStop: sleep 5`
- [ ] `Service` manifest — ClusterIP
- [ ] `HorizontalPodAutoscaler` — min 2, max 10, CPU 70%
- [ ] `Secret` manifest — all env vars from `.env.example`
- [ ] Ingress / Load Balancer — routes `/api/v1/*` to gateway service, TLS termination

```bash
# Apply all manifests
kubectl apply -f k8s/staging/
kubectl apply -f k8s/production/
```

#### Health Probe Configuration (per service)
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: <port>
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: <port>
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

---

### Observability

#### Logging
- [ ] Verify Pino JSON logs are ingested into Google Cloud Logging for all services
- [ ] Confirm redaction of `authorization`, `password`, `token`, `idToken` fields in live logs
- [ ] Set log retention: 30 days (staging), 90 days (production)

#### Distributed Tracing
- [ ] Confirm OpenTelemetry traces appear in Google Cloud Trace
- [ ] Verify `X-Request-Id` links traces across services (correlation ID propagation)

#### Metrics & Alerts
- [ ] Prometheus scraping configured for all services
- [ ] Alert: p95 latency > 600 ms for 5-minute rolling window → PagerDuty / Slack
- [ ] Alert: 5xx error rate > 1% for any service for 2 minutes → PagerDuty / Slack
- [ ] Alert: CPU > 80% for any pod for 5 minutes → Slack
- [ ] Alert: Memory > 85% for any pod → Slack
- [ ] Alert: `outbox_pending_events` gauge > 100 for > 10 minutes → Slack (worker may be stuck)

#### Backup
- [ ] Schedule daily Firestore exports to Cloud Storage bucket: `gs://<project>-backups/firestore/`
- [ ] Verify export job runs and produces files
- [ ] Document restore procedure: RTO target 4 hours, RPO 24 hours

---

### E2E Smoke Tests

Run against staging after each deployment:

- [ ] `POST /auth/register` → `201`
- [ ] `GET /courses` → `200` with paginated response
- [ ] `GET /healthz` → `200` on all services via Gateway
- [ ] `GET /readyz` → `200` on all services (Firestore connected)
- [ ] Auth rate limiter active (11 auth requests → `429`)

---

## Acceptance Criteria

- [ ] All 5 composite Firestore indexes show `READY` status in Firebase Console
- [ ] Client write to `audit_log` returns `PERMISSION_DENIED`
- [ ] Push to `main` branch: pipeline runs and deploys to staging automatically
- [ ] Pipeline fails and does not deploy if any unit test fails
- [ ] Pipeline fails and does not deploy if Trivy finds HIGH/CRITICAL CVE
- [ ] Production deployment only triggers on git tag `v*` with manual approval gate
- [ ] Each service HPA shows min 2 / max 10 replicas in `kubectl get hpa`
- [ ] Failed readiness probe removes pod from load balancer within 30 seconds
- [ ] Logs appear in Google Cloud Logging with all sensitive fields redacted
- [ ] Traces appear in Google Cloud Trace with `X-Request-Id` correlation
- [ ] Latency alert fires in test when p95 exceeds threshold

---

## Sprint Notes

_Use this section during the sprint to record decisions, blockers, and discoveries._

---

*Previous: [Sprint 6 — Audit & Outbox Worker](sprint-6-audit-and-outbox-worker.md) | Project Complete ✅*

---

## Post-Sprint Checklist

After Sprint 7, verify the full system end-to-end:

- [ ] Student can register → pending approval
- [ ] Admin approves registration → student receives in-app + email notification
- [ ] Student can browse published courses
- [ ] Student requests enrollment → admin approves → student receives notification
- [ ] Student marks subject complete → progress aggregate updates correctly
- [ ] Admin uploads PDF attachment → student gets signed download URL
- [ ] Super Admin views audit log — all actions recorded
- [ ] Super Admin creates admin account — audit entry created
- [ ] Outbox worker dispatches all pending events within 5 seconds
- [ ] All service health probes return `200` in production
