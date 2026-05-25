---
name: test-integration
description: Generate integration tests with Firestore emulator setup and supertest for a CMP service endpoint
argument-hint: Service name and endpoint (e.g. "progress-service POST /api/v1/progress/subjects/:id/complete")
allowed-tools: Read, Write, Glob, Bash
---

# Integration Test Generator

You are generating integration tests for a REST endpoint in the **CMP (Course Management Portal)** backend using Supertest and the Firebase Firestore emulator. Follow every step in order.

## 1. Parse `$ARGUMENTS`

Extract two values:

| Value | Example |
|-------|---------|
| **Service** | `progress-service` |
| **Endpoint** | `POST /api/v1/progress/subjects/:id/complete` |

Derive:

| Value | Rule | Example |
|-------|------|---------|
| **Test file** | `tests/integration/<verb>-<resource>.test.ts` | `tests/integration/complete-subject.test.ts` |
| **Method** | From endpoint | `POST` |
| **Path** | From endpoint | `/api/v1/progress/subjects/:id/complete` |

If either value is missing, ask before continuing.

## 2. Load Context

Read the relevant route and controller:
```bash
cat packages/<service-name>/src/http/routes/*.ts
cat packages/<service-name>/src/http/controllers/*.ts
```

Read the use case for this endpoint:
```bash
cat packages/<service-name>/src/application/useCases/*.ts
```

Read `.claude/blueprint/Backend_Blueprint.md` §19 (Testing Strategy — integration test pattern, emulator setup, Supertest).

Read `.claude/APIdocument/API_Document.md` — find the exact request/response schema for this endpoint.

Check if a test setup file already exists:
```bash
ls packages/<service-name>/tests/
```

## 3. Determine Auth Setup

Identify what role(s) the endpoint accepts:

| Role | Token helper needed |
|------|-------------------|
| `student` | `makeStudentToken(uid)` |
| `admin` | `makeAdminToken(uid)` |
| `super_admin` | `makeSuperAdminToken(uid)` |
| `public` | No token |

Since the Firebase emulator is used, tokens are generated via the Firebase Auth emulator REST API or mocked via `firebase-admin` test utilities.

## 4. Generate the Test File

Create `packages/<service-name>/tests/integration/<test-file>.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '@/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@shared/firebase';

// ─── Setup ───────────────────────────────────────────────────────────────────

// Ensure emulator env vars are set before admin SDK initialises
beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  initFirebaseAdmin();
});

const app = createApp();
const db  = getFirestore();

// Helper — seed a Firestore document before a test
async function seed<Entity>(id: string, data: Record<string, unknown>) {
  await db.collection('<collection>').doc(id).set({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// Helper — clean up documents after each test
afterEach(async () => {
  const snapshot = await db.collection('<collection>').get();
  const batch    = db.batch();
  snapshot.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
});

// Token helpers (replace with actual emulator token generation for your setup)
const studentToken    = 'test-student-token';   // Firebase Auth emulator custom token
const adminToken      = 'test-admin-token';
const superAdminToken = 'test-super-admin-token';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('<METHOD> <path>', () => {

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns <status> and <expected response> when <condition>', async () => {
    // Arrange — seed Firestore with required data
    await seed<Entity>('entity-1', {
      // required fields
    });

    // Act
    const res = await request(app)
      .<method>('<resolved-path>')
      .set('Authorization', `Bearer ${<roleToken>}`)
      .send({
        // request body (for POST/PATCH)
      })
      .expect(<status>);

    // Assert response shape
    expect(res.body.data).toMatchObject({
      // expected response fields
    });
    expect(res.body.requestId).toBeDefined();

    // Assert Firestore state (optional — verify side effects)
    const doc = await db.collection('<collection>').doc('entity-1').get();
    expect(doc.data()!.<field>).toBe(<expectedValue>);
  });

  // ── Idempotency (if applicable) ────────────────────────────────────────────

  it('is idempotent — second call returns same result without changing state', async () => {
    await seed<Entity>('entity-1', { /* initial state */ });

    const first  = await request(app)
      .<method>('<path>')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(<status>);

    const second = await request(app)
      .<method>('<path>')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(<status>);

    // Key immutable field must not change
    expect(second.body.data.<immutableField>).toBe(first.body.data.<immutableField>);
  });

  // ── 401 — missing token ────────────────────────────────────────────────────

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .<method>('<path>')
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  // ── 403 — wrong role ───────────────────────────────────────────────────────

  it('returns 403 when called by a <wrongRole>', async () => {
    const res = await request(app)
      .<method>('<path>')
      .set('Authorization', `Bearer ${<wrongRoleToken>}`)
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ── 404 — not found ────────────────────────────────────────────────────────

  it('returns 404 when <entity> does not exist', async () => {
    const res = await request(app)
      .<method>('/api/v1/<resource>/non-existent-id/<action>')
      .set('Authorization', `Bearer ${<roleToken>}`)
      .expect(404);

    expect(res.body.error.code).toBe('<ENTITY>_NOT_FOUND');
  });

  // ── 400 — validation failure ───────────────────────────────────────────────

  it('returns 400 when request body is invalid', async () => {
    const res = await request(app)
      .<method>('<path>')
      .set('Authorization', `Bearer ${<roleToken>}`)
      .send({ invalidField: 'bad-value' })
      .expect(400);

    expect(res.body.error.code).toBeDefined();
    expect(res.body.error.details).toBeDefined();
  });

  // ── 409 — business rule conflict ──────────────────────────────────────────

  it('returns 409 when <conflict condition>', async () => {
    await seed<Entity>('entity-1', { state: '<conflictingState>' });

    const res = await request(app)
      .<method>('<path>')
      .set('Authorization', `Bearer ${<roleToken>}`)
      .expect(409);

    expect(res.body.error.code).toBe('<CONFLICT_CODE>');
  });

});
```

Remove test blocks that don't apply to this specific endpoint (e.g., no idempotency block if the endpoint is not idempotent, no 400 block if there is no request body).

## 5. Ensure `tests/integration/` Directory Exists

```bash
mkdir -p packages/<service-name>/tests/integration
```

## 6. Check `package.json` for Integration Test Script

Verify `packages/<service-name>/package.json` has:

```json
"test:integration": "jest --config jest.integration.config.ts"
```

If missing, add it.

## 7. Report

```
✅ Integration tests generated!

File: packages/<service-name>/tests/integration/<test-file>.test.ts

Test cases written:
  ✓ Happy path — <status> + <outcome>
  ✓ Idempotency (if applicable)
  ✓ 401 — missing token
  ✓ 403 — wrong role
  ✓ 404 — resource not found
  ✓ 400 — invalid request body (if applicable)
  ✓ 409 — conflict (if applicable)

Prerequisites to run:
  npx firebase emulators:start --only firestore,auth

Run tests:
  npm run test:integration --workspace=packages/<service-name>
```

## Errors

| Issue | Action |
|-------|--------|
| Firestore emulator not running | Tests will fail with connection error — start emulator first |
| `FIRESTORE_EMULATOR_HOST` not set | Set in `beforeAll` before `initFirebaseAdmin()` is called |
| Tests share Firestore state between runs | Add `afterEach` cleanup — delete all seeded documents |
| Real Firebase project credentials in test env | Use emulator only — never run integration tests against production |

---

v1.0.0 — CMP (`slp-backend`)
