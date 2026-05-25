/**
 * Firestore Security Rules tests for audit_log collection.
 * Requires: npm install --save-dev @firebase/rules-unit-testing
 * Run with: npx jest tests/rules/auditLog.rules.test.ts
 *           (Firebase emulator must be running on port 8080)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cmp',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host:  '127.0.0.1',
      port:  8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

afterEach(async () => {
  await env.clearFirestore();
});

describe('audit_log Firestore Security Rules', () => {

  it('super_admin can read audit_log', async () => {
    const ctx = env.authenticatedContext('super-admin-uid', { role: 'super_admin' });
    await assertSucceeds(ctx.firestore().collection('audit_log').get());
  });

  it('student cannot read audit_log', async () => {
    const ctx = env.authenticatedContext('student-uid', { role: 'student' });
    await assertFails(ctx.firestore().collection('audit_log').get());
  });

  it('admin cannot read audit_log', async () => {
    const ctx = env.authenticatedContext('admin-uid', { role: 'admin' });
    await assertFails(ctx.firestore().collection('audit_log').get());
  });

  it('unauthenticated client cannot read audit_log', async () => {
    const ctx = env.unauthenticatedContext();
    await assertFails(ctx.firestore().collection('audit_log').get());
  });

  it('super_admin cannot write to audit_log', async () => {
    const ctx = env.authenticatedContext('super-admin-uid', { role: 'super_admin' });
    await assertFails(
      ctx.firestore().collection('audit_log').add({ action: 'test', actorUid: 'x', createdAt: new Date().toISOString() }),
    );
  });

  it('admin cannot write to audit_log', async () => {
    const ctx = env.authenticatedContext('admin-uid', { role: 'admin' });
    await assertFails(
      ctx.firestore().collection('audit_log').add({ action: 'test' }),
    );
  });

  it('student cannot write to audit_log', async () => {
    const ctx = env.authenticatedContext('student-uid', { role: 'student' });
    await assertFails(
      ctx.firestore().collection('audit_log').add({ action: 'test' }),
    );
  });

});

describe('outbox Firestore Security Rules', () => {

  it('no client can read outbox', async () => {
    const ctx = env.authenticatedContext('admin-uid', { role: 'admin' });
    await assertFails(ctx.firestore().collection('outbox').get());
  });

  it('no client can write to outbox', async () => {
    const ctx = env.authenticatedContext('admin-uid', { role: 'admin' });
    await assertFails(ctx.firestore().collection('outbox').add({ test: true }));
  });

});
