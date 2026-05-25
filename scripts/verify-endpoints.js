/**
 * Full endpoint verification — runs against online Firebase.
 * Usage: node scripts/verify-endpoints.js
 */
'use strict';

const BASE = 'http://localhost:3000/api/v1';
const KEY  = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0';

const pass = [], fail = [], skip = [];

async function req(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + path, {
    method, headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = r.headers.get('content-type') || '';
  const d  = r.status !== 204 && ct.includes('json') ? await r.json().catch(() => null) : null;
  return { s: r.status, d };
}

async function signIn(email, pw) {
  const r = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + KEY,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw, returnSecureToken: true }) }
  );
  const d = await r.json();
  return d.idToken ? { token: d.idToken, uid: d.localId } : null;
}

function check(label, s, expect) {
  const exp = Array.isArray(expect) ? expect : [expect];
  const good = exp.includes(s);
  const icon = good ? '✅' : '❌';
  if (good) pass.push({ label, s }); else fail.push({ label, s, expect: exp.join(' | ') });
  return good;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   CMP — Full Endpoint Verification (online Firebase)     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── Health ──────────────────────────────────────────────────────────
  console.log('── Health (all 9 services) ──────────────');
  const services = [
    ['gateway',3000],['auth-service',3001],['user-service',3002],
    ['course-service',3003],['enrollment-service',3004],['progress-service',3005],
    ['storage-service',3006],['notification-service',3007],['audit-service',3008],
  ];
  for (const [name, port] of services) {
    const hz = await fetch(`http://localhost:${port}/healthz`).then(r => r.json()).catch(() => null);
    const rz = await fetch(`http://localhost:${port}/readyz`).then(r => r.json()).catch(() => null);
    const good = hz?.status === 'ok';
    check(`${name} healthz`, good ? 200 : 0, 200);
    console.log(`${good ? '✅' : '❌'}  :${port}  ${name.padEnd(22)} healthz: ${good ? 'OK' : 'DOWN'} | readyz: ${rz?.status ?? '?'}`);
  }

  // ── Auth endpoints (no token) ────────────────────────────────────────
  console.log('\n── Auth Service (public) ─────────────────');
  let r;
  const RUN = Date.now();

  r = await req('POST', '/auth/register', {
    firstName: 'Verify', lastName: 'User',
    email: `verify_${RUN}@test.com`, password: 'Verify@2026Pass!',
  });
  check('POST /auth/register → 201', r.s, 201);
  console.log(`${r.s === 201 ? '✅' : '❌'}  POST /auth/register → ${r.s}`);

  r = await req('POST', '/auth/password-reset', { email: 'anyone@test.com' });
  check('POST /auth/password-reset → 200|204', r.s, [200, 204]);
  console.log(`${[200,204].includes(r.s) ? '✅' : '❌'}  POST /auth/password-reset → ${r.s}`);

  r = await req('POST', '/auth/track-failure', { email: 'test@test.com' });
  check('POST /auth/track-failure → 200', r.s, 200);
  console.log(`${r.s === 200 ? '✅' : '❌'}  POST /auth/track-failure → ${r.s}`);

  // ── Auth guard (no token → 401) ──────────────────────────────────────
  console.log('\n── Auth Guard (no token → 401) ───────────');
  for (const [m, p] of [
    ['GET', '/me'], ['GET', '/users'], ['GET', '/admin/registrations'],
    ['GET', '/audit-log'], ['GET', '/me/notifications'], ['GET', '/me/enrollments'],
  ]) {
    r = await req(m, p);
    check(`${m} ${p} → 401`, r.s, 401);
    console.log(`${r.s === 401 ? '✅' : '❌'}  ${m} ${p} → ${r.s}`);
  }

  // ── Public courses ───────────────────────────────────────────────────
  console.log('\n── Public Courses ────────────────────────');
  r = await req('GET', '/courses');
  check('GET /courses → 200', r.s, 200);
  console.log(`${r.s === 200 ? '✅' : '❌'}  GET /courses → ${r.s}  (total: ${r.d?.total ?? '?'})`);

  // ── Sign in ──────────────────────────────────────────────────────────
  console.log('\n── Signing in seed accounts ──────────────');
  const SA  = await signIn('superadmin@cmp.com', 'SuperAdmin@123');
  const ADM = await signIn('admin@cmp.com',       'Admin@12345');
  const STU = await signIn('student2@cmp.com',    'Student2@123');

  if (!SA || !ADM || !STU) {
    console.log('❌  Sign-in FAILED — Email/Password not yet enabled in Firebase Console.');
    console.log('   → https://console.firebase.google.com/project/e-learning-f4209/authentication/providers');
    console.log('   Enable Email/Password → Save, then re-run.\n');
    skip.push('All authenticated endpoints (Email/Password sign-in disabled)');
  } else {
    console.log('✅  superadmin@cmp.com');
    console.log('✅  admin@cmp.com');
    console.log('✅  student2@cmp.com');

    // ── Profile ────────────────────────────────────────────────────────
    console.log('\n── Profile (/me) ─────────────────────────');
    r = await req('GET', '/me', null, ADM.token);
    check('GET /me → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /me → ${r.s}  (role: ${r.d?.role})`);

    r = await req('PATCH', '/me', { firstName: 'Admin', lastName: 'Verified' }, ADM.token);
    check('PATCH /me → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  PATCH /me → ${r.s}`);

    // ── User management ────────────────────────────────────────────────
    console.log('\n── User Management ───────────────────────');
    r = await req('GET', '/users', null, ADM.token);
    check('GET /users → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /users → ${r.s}  (total: ${r.d?.total ?? '?'})`);

    r = await req('GET', `/users/${STU.uid}`, null, ADM.token);
    check('GET /users/:uid → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /users/:uid → ${r.s}`);

    r = await req('POST', `/users/${STU.uid}/suspend`, null, ADM.token);
    check('POST /users/:uid/suspend → 200|409', r.s, [200, 409]);
    console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /users/:uid/suspend → ${r.s}`);

    r = await req('POST', `/users/${STU.uid}/reactivate`, null, ADM.token);
    check('POST /users/:uid/reactivate → 200|409', r.s, [200, 409]);
    console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /users/:uid/reactivate → ${r.s}`);

    // ── Super Admin management ──────────────────────────────────────────
    console.log('\n── Admin Management (super_admin) ────────');
    r = await req('GET', '/super-admin/admins', null, SA.token);
    check('GET /super-admin/admins → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /super-admin/admins → ${r.s}  (total: ${r.d?.total ?? '?'})`);

    const tmpEmail = `tmp_admin_${RUN}@cmp.com`;
    r = await req('POST', '/super-admin/admins', {
      firstName: 'Tmp', lastName: 'Admin',
      email: tmpEmail, initialPassword: 'TmpAdmin@2026!',
    }, SA.token);
    check('POST /super-admin/admins → 201', r.s, 201);
    console.log(`${r.s === 201 ? '✅' : '❌'}  POST /super-admin/admins → ${r.s}`);
    const tmpUid = r.d?.uid ?? r.d?.id;

    if (tmpUid) {
      r = await req('GET', `/super-admin/admins/${tmpUid}`, null, SA.token);
      check('GET /super-admin/admins/:uid → 200', r.s, 200);
      console.log(`${r.s === 200 ? '✅' : '❌'}  GET /super-admin/admins/:uid → ${r.s}`);

      r = await req('POST', `/super-admin/admins/${tmpUid}/suspend`, null, SA.token);
      check('POST .../suspend → 200|409', r.s, [200, 409]);
      console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /super-admin/admins/:uid/suspend → ${r.s}`);

      r = await req('POST', `/super-admin/admins/${tmpUid}/reactivate`, null, SA.token);
      check('POST .../reactivate → 200|409', r.s, [200, 409]);
      console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /super-admin/admins/:uid/reactivate → ${r.s}`);

      r = await req('DELETE', `/super-admin/admins/${tmpUid}`, null, SA.token);
      check('DELETE /super-admin/admins/:uid → 204', r.s, 204);
      console.log(`${r.s === 204 ? '✅' : '❌'}  DELETE /super-admin/admins/:uid → ${r.s}`);
    }

    // ── Course service ──────────────────────────────────────────────────
    console.log('\n── Course Service ────────────────────────');
    r = await req('POST', '/courses', { title: `VerifyCourse_${RUN}`, description: 'Verification run' }, ADM.token);
    check('POST /courses → 201', r.s, 201);
    console.log(`${r.s === 201 ? '✅' : '❌'}  POST /courses → ${r.s}`);
    const cid = r.d?.id;

    r = await req('GET', `/courses/${cid}`, null, ADM.token);
    check('GET /courses/:id → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /courses/:id → ${r.s}`);

    r = await req('PATCH', `/courses/${cid}`, { title: `VerifyCourse_${RUN}_upd` }, ADM.token);
    check('PATCH /courses/:id → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  PATCH /courses/:id → ${r.s}`);

    r = await req('POST', `/courses/${cid}/semesters`, { name: 'Sem 1', sortOrder: 1 }, ADM.token);
    check('POST /courses/:id/semesters → 201', r.s, 201);
    console.log(`${r.s === 201 ? '✅' : '❌'}  POST /courses/:id/semesters → ${r.s}`);
    const semId = r.d?.id;

    r = await req('PATCH', `/semesters/${semId}`, { name: 'Sem 1 Updated' }, ADM.token);
    check('PATCH /semesters/:id → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  PATCH /semesters/:id → ${r.s}`);

    r = await req('POST', `/semesters/${semId}/subjects`, {
      title: 'Subject 1', description: 'desc',
      youtubeVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', sortOrder: 1,
    }, ADM.token);
    check('POST /semesters/:id/subjects → 201', r.s, 201);
    console.log(`${r.s === 201 ? '✅' : '❌'}  POST /semesters/:id/subjects → ${r.s}`);
    const subId = r.d?.id;

    r = await req('PATCH', `/subjects/${subId}`, { title: 'Subject 1 Updated' }, ADM.token);
    check('PATCH /subjects/:id → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  PATCH /subjects/:id → ${r.s}`);

    // Extra sem+sub to test delete
    r = await req('POST', `/courses/${cid}/semesters`, { name: 'Sem Del', sortOrder: 2 }, ADM.token);
    const delSemId = r.d?.id;
    r = await req('POST', `/semesters/${delSemId}/subjects`, {
      title: 'Sub Del', description: 'del', youtubeVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', sortOrder: 1,
    }, ADM.token);
    const delSubId = r.d?.id;

    r = await req('DELETE', `/subjects/${delSubId}`, null, ADM.token);
    check('DELETE /subjects/:id → 204', r.s, 204);
    console.log(`${r.s === 204 ? '✅' : '❌'}  DELETE /subjects/:id → ${r.s}`);

    r = await req('DELETE', `/semesters/${delSemId}`, null, ADM.token);
    check('DELETE /semesters/:id → 204', r.s, 204);
    console.log(`${r.s === 204 ? '✅' : '❌'}  DELETE /semesters/:id → ${r.s}`);

    r = await req('POST', `/courses/${cid}/publish`, null, ADM.token);
    check('POST /courses/:id/publish → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  POST /courses/:id/publish → ${r.s}`);

    r = await req('POST', `/courses/${cid}/unpublish`, null, ADM.token);
    check('POST /courses/:id/unpublish → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  POST /courses/:id/unpublish → ${r.s}`);

    await req('POST', `/courses/${cid}/publish`, null, ADM.token); // re-publish for enrollment

    // ── Enrollment ──────────────────────────────────────────────────────
    console.log('\n── Enrollment Service ────────────────────');
    r = await req('GET', '/admin/registrations', null, ADM.token);
    check('GET /admin/registrations → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /admin/registrations → ${r.s}  (total: ${r.d?.total ?? '?'})`);

    // Approve student2 registration
    r = await req('POST', `/admin/registrations/${STU.uid}/approve`, null, ADM.token);
    check('POST /admin/registrations/:id/approve → 200|409', r.s, [200, 409]);
    console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /admin/registrations/:id/approve → ${r.s}`);

    // Bulk approve (idempotent)
    r = await req('POST', '/admin/registrations/bulk-approve', { ids: [STU.uid] }, ADM.token);
    check('POST bulk-approve → 200|207', r.s, [200, 207]);
    console.log(`${[200,207].includes(r.s) ? '✅' : '❌'}  POST /admin/registrations/bulk-approve → ${r.s}`);

    // Register new student for reject test
    const s3email = `s3_${RUN}@test.com`;
    await req('POST', '/auth/register', { firstName: 'S3', lastName: 'Student', email: s3email, password: 'SmokeS3@2026!' });
    const S3 = await signIn(s3email, 'SmokeS3@2026!');
    if (S3) {
      r = await req('POST', `/admin/registrations/${S3.uid}/reject`, { reason: 'Verify test' }, ADM.token);
      check('POST /admin/registrations/:id/reject → 200|409', r.s, [200, 409]);
      console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /admin/registrations/:id/reject → ${r.s}`);
    }

    r = await req('POST', `/courses/${cid}/enroll`, null, STU.token);
    check('POST /courses/:id/enroll → 201|409', r.s, [201, 409]);
    console.log(`${[201,409].includes(r.s) ? '✅' : '❌'}  POST /courses/:id/enroll → ${r.s}`);
    const enrollId = `${STU.uid}_${cid}`;

    r = await req('GET', '/me/enrollments', null, STU.token);
    check('GET /me/enrollments → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /me/enrollments → ${r.s}  (total: ${r.d?.total ?? '?'})`);

    r = await req('GET', '/admin/enrollments', null, ADM.token);
    check('GET /admin/enrollments → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /admin/enrollments → ${r.s}  (total: ${r.d?.total ?? '?'})`);

    r = await req('POST', `/admin/enrollments/${enrollId}/approve`, null, ADM.token);
    check('POST /admin/enrollments/:id/approve → 200|409', r.s, [200, 409]);
    console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /admin/enrollments/:id/approve → ${r.s}`);

    // Enroll new user for reject test
    const s4email = `s4_${RUN}@test.com`;
    await req('POST', '/auth/register', { firstName: 'S4', lastName: 'Student', email: s4email, password: 'SmokeS4@2026!' });
    const S4 = await signIn(s4email, 'SmokeS4@2026!');
    if (S4) {
      await req('POST', `/admin/registrations/${S4.uid}/approve`, null, ADM.token);
      await req('POST', `/courses/${cid}/enroll`, null, S4.token);
      const s4EnrollId = `${S4.uid}_${cid}`;
      r = await req('POST', `/admin/enrollments/${s4EnrollId}/reject`, { reason: 'Verify' }, ADM.token);
      check('POST /admin/enrollments/:id/reject → 200|409', r.s, [200, 409]);
      console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /admin/enrollments/:id/reject → ${r.s}`);
    }

    r = await req('POST', `/enrollments/${enrollId}/withdraw`, null, STU.token);
    check('POST /enrollments/:id/withdraw → 200|409', r.s, [200, 409]);
    console.log(`${[200,409].includes(r.s) ? '✅' : '❌'}  POST /enrollments/:id/withdraw → ${r.s}`);

    // Re-enroll + approve for progress tests
    await req('POST', `/courses/${cid}/enroll`, null, STU.token);
    await req('POST', `/admin/enrollments/${enrollId}/approve`, null, ADM.token);

    // ── Progress ─────────────────────────────────────────────────────────
    console.log('\n── Progress Service ──────────────────────');
    r = await req('POST', `/progress/subjects/${subId}/complete`, { courseId: cid, semesterId: semId }, STU.token);
    check('POST /progress/subjects/:id/complete → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  POST /progress/subjects/:id/complete → ${r.s}  (state: ${r.d?.state ?? '?'})`);

    r = await req('POST', `/progress/subjects/${subId}/access`, { courseId: cid, semesterId: semId }, STU.token);
    check('POST /progress/subjects/:id/access → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  POST /progress/subjects/:id/access → ${r.s}`);

    r = await req('GET', `/me/progress/courses/${cid}`, null, STU.token);
    check('GET /me/progress/courses/:courseId → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /me/progress/courses/:courseId → ${r.s}  (${r.d?.completionPercent ?? '?'}%)`);

    r = await req('GET', `/me/progress/subjects/${subId}`, null, STU.token);
    check('GET /me/progress/subjects/:subjectId → 200|404', r.s, [200, 404]);
    console.log(`${[200,404].includes(r.s) ? '✅' : '❌'}  GET /me/progress/subjects/:subjectId → ${r.s}`);

    r = await req('GET', `/admin/progress/courses/${cid}`, null, ADM.token);
    check('GET /admin/progress/courses/:courseId → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /admin/progress/courses/:courseId → ${r.s}  (enrolled: ${r.d?.enrolledCount ?? '?'})`);

    // ── Archive & delete course ───────────────────────────────────────────
    console.log('\n── Course Lifecycle (archive/delete) ─────');
    r = await req('POST', `/courses/${cid}/archive`, null, ADM.token);
    check('POST /courses/:id/archive → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  POST /courses/:id/archive → ${r.s}`);

    r = await req('DELETE', `/courses/${cid}`, null, ADM.token);
    check('DELETE /courses/:id → 204', r.s, 204);
    console.log(`${r.s === 204 ? '✅' : '❌'}  DELETE /courses/:id → ${r.s}`);

    // ── Promote to admin (14.7) ───────────────────────────────────────────
    console.log('\n── Promote to Admin (14.7) ───────────────');
    const promEmail = `prom_${RUN}@test.com`;
    await req('POST', '/auth/register', { firstName: 'Prom', lastName: 'User', email: promEmail, password: 'PromUser@2026!' });
    const PROM = await signIn(promEmail, 'PromUser@2026!');
    if (PROM) {
      await req('POST', `/admin/registrations/${PROM.uid}/approve`, null, ADM.token);
      r = await req('POST', `/super-admin/users/${PROM.uid}/make-admin`, null, SA.token);
      check('POST /super-admin/users/:uid/make-admin → 200', r.s, 200);
      console.log(`${r.s === 200 ? '✅' : '❌'}  POST /super-admin/users/:uid/make-admin → ${r.s}  (roles: ${JSON.stringify(r.d?.roles ?? '?')})`);
    }

    // ── Storage (no file — check 404 guard is working) ───────────────────
    console.log('\n── Storage Service ───────────────────────');
    r = await req('GET', '/attachments/nonexistent/download-url', null, ADM.token);
    check('GET /attachments/:id/download-url → 404', r.s, 404);
    console.log(`${r.s === 404 ? '✅' : '❌'}  GET /attachments/:id/download-url → ${r.s}  (404 expected)`);
    skip.push('POST /subjects/:id/attachments (requires multipart/form-data — use Postman or curl)');
    skip.push('GET /attachments/:id/download-url with real file');
    skip.push('DELETE /attachments/:id (no file uploaded)');
    console.log('⬜  POST /subjects/:id/attachments — skipped (needs multipart upload)');

    // ── Notifications (wait for outbox) ──────────────────────────────────
    console.log('\n── Notification Service (waiting 6s for outbox) ─');
    await sleep(6000);
    r = await req('GET', '/me/notifications', null, ADM.token);
    check('GET /me/notifications → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /me/notifications → ${r.s}  (unread: ${r.d?.unreadCount ?? '?'})`);

    const nid = r.d?.items?.[0]?.id;
    if (nid) {
      r = await req('POST', `/me/notifications/${nid}/read`, null, ADM.token);
      check('POST /me/notifications/:id/read → 200', r.s, 200);
      console.log(`${r.s === 200 ? '✅' : '❌'}  POST /me/notifications/:id/read → ${r.s}`);
    } else {
      skip.push('POST /me/notifications/:id/read (no notifications — outbox-worker may not be running)');
      console.log('⬜  POST /me/notifications/:id/read — skipped (no notifications yet)');
    }

    r = await req('POST', '/me/notifications/read-all', null, ADM.token);
    check('POST /me/notifications/read-all → 200|204', r.s, [200, 204]);
    console.log(`${[200,204].includes(r.s) ? '✅' : '❌'}  POST /me/notifications/read-all → ${r.s}`);

    // ── Audit log ─────────────────────────────────────────────────────────
    console.log('\n── Audit Service ─────────────────────────');
    r = await req('GET', '/audit-log', null, SA.token);
    check('GET /audit-log → 200', r.s, 200);
    console.log(`${r.s === 200 ? '✅' : '❌'}  GET /audit-log → ${r.s}  (total: ${r.d?.total ?? '?'})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('  FINAL RESULTS');
  console.log('═'.repeat(62));
  console.log(`  ✅ Passed  : ${pass.length}`);
  console.log(`  ❌ Failed  : ${fail.length}`);
  console.log(`  ⬜ Skipped : ${skip.length}`);
  console.log(`  Total     : ${pass.length + fail.length + skip.length}`);

  if (fail.length) {
    console.log('\n  ❌ FAILURES:');
    fail.forEach(f => console.log(`    • ${f.label}  — got ${f.s}, expected ${f.expect}`));
  }
  if (skip.length) {
    console.log('\n  ⬜ SKIPPED:');
    skip.forEach(s => console.log(`    • ${s}`));
  }
  console.log('');
  process.exit(fail.length ? 1 : 0);
}

run().catch(e => { console.error('\nABORTED:', e.message); process.exit(1); });
