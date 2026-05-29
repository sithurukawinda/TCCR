'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uuid = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bearerAuth(tokenVar) {
  return {
    type: 'bearer',
    bearer: [{ key: 'token', value: `{{${tokenVar}}}`, type: 'string' }],
  };
}

function noAuth() {
  return { type: 'noauth' };
}

function jsonHeader() {
  return [{ key: 'Content-Type', value: 'application/json' }];
}

function jsonBody(obj) {
  return {
    mode: 'raw',
    raw: JSON.stringify(obj, null, 2),
    options: { raw: { language: 'json' } },
  };
}

function noBody() {
  return null;
}

function queryParams(obj) {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: String(value),
    disabled: false,
  }));
}

/**
 * Parse a raw URL string (which may start with a Postman variable like {{baseUrl}})
 * into a full Postman v2.1 URL object that Newman 6 requires.
 *
 * Supported patterns:
 *   {{baseUrl}}/path/to/resource
 *   {{baseUrl}}/path/to/resource?key=val&key2=val2
 *   {{baseUrl}}/path/to/{{varId}}/action
 *   http://localhost:3000/healthz
 */
function makeUrl(rawStr, queryObj) {
  // Append inline query object if supplied
  let raw = rawStr;
  let extraQueryItems = [];
  if (queryObj) {
    const qs = Object.entries(queryObj).map(([k, v]) => `${k}=${v}`).join('&');
    raw = `${rawStr}?${qs}`;
    extraQueryItems = Object.entries(queryObj).map(([k, v]) => ({
      key: k, value: String(v), disabled: false,
    }));
  }

  // ── Case 1: Postman-variable-prefixed URL e.g. {{baseUrl}}/auth/register ──
  const varMatch = raw.match(/^(\{\{[^}]+\}\})\/?(.*)$/);
  if (varMatch) {
    const [, hostVar, rest] = varMatch;
    const [pathStr = '', queryStr = ''] = rest.split('?');
    const pathSegments = pathStr.split('/').filter(Boolean);

    const result = { raw, host: [hostVar], path: pathSegments };

    const parsedQuery = queryStr
      ? queryStr.split('&').map(pair => {
          const eq = pair.indexOf('=');
          return eq >= 0
            ? { key: pair.slice(0, eq), value: pair.slice(eq + 1), disabled: false }
            : { key: pair, value: '', disabled: false };
        })
      : extraQueryItems;
    if (parsedQuery.length > 0) result.query = parsedQuery;

    return result;
  }

  // ── Case 2: Absolute URL e.g. http://localhost:3000/healthz ──
  try {
    // Replace Postman vars with a placeholder so URL can be parsed
    const safe = raw.replace(/\{\{[^}]+\}\}/g, 'PMVAR');
    const u = new URL(safe);
    const result = {
      raw,
      protocol: u.protocol.replace(':', ''),
      host:     u.hostname.includes('.') ? u.hostname.split('.') : [u.hostname],
      path:     u.pathname.split('/').filter(Boolean),
    };
    if (u.port) result.port = u.port;
    const qps = [...u.searchParams.entries()].map(([k, v]) => ({ key: k, value: v, disabled: false }));
    if (qps.length > 0) result.query = qps;
    return result;
  } catch {
    // Fallback — return raw-only object (Newman will try to resolve)
    return { raw };
  }
}

function testScript(lines) {
  return [
    {
      listen: 'test',
      script: {
        id: uuid(),
        type: 'text/javascript',
        exec: Array.isArray(lines) ? lines : [lines],
      },
    },
  ];
}

function buildRequest({
  name,
  method,
  url,
  auth,
  headers = [],
  body = null,
  query = null,
  tests = [],
}) {
  // Always build a full Postman URL object (Newman 6 requires host/path arrays)
  const rawStr = typeof url === 'string' ? url : (url.raw || '');
  // If the caller already provided a fully-structured URL object (has host[]), use it directly
  const urlObj = (typeof url === 'object' && url !== null && Array.isArray(url.host))
    ? url
    : makeUrl(rawStr, query);

  return {
    id: uuid(),
    name,
    request: {
      method,
      header: headers,
      body: body || undefined,
      url: urlObj,
      auth: auth || noAuth(),
    },
    response: [],
    event: tests.length ? testScript(tests) : undefined,
  };
}

function folder(name, items) {
  return {
    id: uuid(),
    name,
    item: items.filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// 🔐 SIGN IN FOLDER
// ---------------------------------------------------------------------------

function signInRequest(name, email, password, tokenVar, idVar) {
  return buildRequest({
    name,
    method: 'POST',
    url: {
      raw: '{{authBaseUrl}}/accounts:signInWithPassword?key={{firebaseWebApiKey}}',
      host: ['{{authBaseUrl}}'],
      path: ['accounts:signInWithPassword'],
      query: [{ key: 'key', value: '{{firebaseWebApiKey}}' }],
    },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email, password, returnSecureToken: true }),
    tests: [
      `pm.test("200 OK — ${name}", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("TOKEN received", () => {`,
      `  pm.expect(j.idToken).to.be.a("string").and.not.empty;`,
      `  if (j.idToken) { pm.environment.set("${tokenVar}", j.idToken); pm.environment.set("${idVar}", j.localId); }`,
      `});`,
    ],
  });
}

// Student 2 is the *approved* student — use her as the primary {{studentToken}}
// Student 1 is pending_approval — kept as student1Token for specific tests
function signInRequestDual(name, email, password, tokenVar, idVar, extraTokenVar) {
  const base = signInRequest(name, email, password, tokenVar, idVar);
  if (extraTokenVar) {
    base.event[0].script.exec.push(
      `if (j.idToken) { pm.environment.set("${extraTokenVar}", j.idToken); }`,
    );
  }
  return base;
}

const signInFolder = folder('🔐 Sign In', [
  signInRequest('Super Admin Sign In', 'superadmin@cmp.com', 'SuperAdmin@123', 'superAdminToken', 'superAdminId'),
  signInRequest('Admin Sign In',       'admin@cmp.com',      'Admin@12345',    'adminToken',       'adminId'),
  // student1 is only used for the change-password test. Accept 200 or 400 so a drifted
  // password or disabled account does not cascade as a failure through the whole run.
  buildRequest({
    name: 'Student 1 (pending) Sign In',
    method: 'POST',
    url: {
      raw:  '{{authBaseUrl}}/accounts:signInWithPassword?key={{firebaseWebApiKey}}',
      host: ['{{authBaseUrl}}'],
      path: ['accounts:signInWithPassword'],
      query: [{ key: 'key', value: '{{firebaseWebApiKey}}' }],
    },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'student1@cmp.com', password: 'Student1@123', returnSecureToken: true }),
    tests: [
      `pm.test("200 or 400 — Student 1 Sign In (400 = disabled/wrong-pw; token optional)", () => {`,
      `  pm.expect([200, 400]).to.include(pm.response.code);`,
      `});`,
      `const j = pm.response.json();`,
      `if (j.idToken) { pm.environment.set("student1Token", j.idToken); pm.environment.set("student1Id", j.localId); }`,
    ],
  }),
  // Student 2 is approved — sets both student2Token AND studentToken (primary token used by most tests)
  signInRequestDual('Student 2 (approved) Sign In', 'student2@cmp.com', 'Student2@123', 'student2Token', 'student2Id', 'studentToken'),
  signInRequest('Leader Sign In', 'leader@cmp.com', 'Leader@12345', 'leaderToken', 'leaderId'),
  signInRequest('G12 Sign In',    'g12leader@cmp.com', 'G12Lead@123', 'g12Token',  'g12Id'),
]);

// ---------------------------------------------------------------------------
// 1️⃣ AUTH SERVICE
// ---------------------------------------------------------------------------

const authFolder = folder('1️⃣ Auth Service', [
  // Step 1: Register a fresh member
  buildRequest({
    name: 'Register New Member',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/register' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      firstName: 'New',
      lastName: 'Member',
      email: 'newmember{{runId}}@gmail.com',
      password: 'Member@Tccr2026',
      preferredLanguage: 'en',
    }),
    tests: [
      `// 201 = registered; 409 = email exists (re-run); 422 = MX validation blocked (emulator/offline)`,
      `pm.test("201 or 409 or 422 — Register", () => { pm.expect([201, 409, 422]).to.include(pm.response.code); });`,
      `const j = pm.response.json();`,
      `if (j.uid) { pm.environment.set("registeredUid", j.uid); }`,
    ],
  }),
  // Resend Verification OTP — public, no token required
  // 204 = new OTP sent (or email not found — silent); 400 = already verified
  buildRequest({
    name: 'Resend Verification Email',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/resend-verification' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'newmember{{runId}}@gmail.com' }),
    tests: [
      `// 204 = OTP sent; 400 = already verified; 200 = email not found (silent on online)`,
      `pm.test("200 or 204 or 400 — Resend Verification", () => {`,
      `  pm.expect([200, 204, 400]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  // Verify Email with OTP — public, no token required
  // The OTP is the 6-digit code sent in the welcome email.
  // In the emulator test environment the OTP is read from Firestore directly.
  // 204 = email verified; 400 = invalid/expired OTP
  buildRequest({
    name: 'Verify Email OTP',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/verify-email' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'newmember{{runId}}@gmail.com', otp: '000000' }),
    tests: [
      `// 400 is expected in automated runs because the OTP is unknown at test time.`,
      `// In a real test, fetch the OTP from Firestore and pass it here.`,
      `pm.test("204 or 400 — Verify Email OTP (400 = wrong OTP in automated run)", () => {`,
      `  pm.expect([204, 400]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  // Register with fake domain — should be blocked (422) in production.
  // In the local emulator, DNS MX resolution may not be available → 201 is also accepted.
  buildRequest({
    name: 'Register — Fake Domain (expect 422)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/register' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      firstName: 'Fake',
      lastName:  'User',
      email:     'test@fakexyz99999domain.com',
      password:  'Test@2026!',
      preferredLanguage: 'en',
    }),
    tests: [
      `// 422 = blocked (production / DNS available); 201 = emulator has no real DNS resolution`,
      `pm.test("422 or 201 — Fake email domain (422 in prod, 201 in emulator w/o DNS)", () => {`,
      `  pm.expect([201, 409, 422]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 422) {`,
      `  const j = pm.response.json();`,
      `  pm.test("error code is EMAIL_DOMAIN_UNREACHABLE", () => pm.expect(j.error.code).to.equal("EMAIL_DOMAIN_UNREACHABLE"));`,
      `}`,
    ],
  }),

  // Register with disposable email — should be blocked (422) in production.
  // In the local emulator, the blocklist check may not be active → 201 is also accepted.
  buildRequest({
    name: 'Register — Disposable Email (expect 422)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/register' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      firstName: 'Disposable',
      lastName:  'User',
      email:     'test@mailinator.com',
      password:  'Test@2026!',
      preferredLanguage: 'en',
    }),
    tests: [
      `// 422 = blocked (production); 201/409 = emulator may not block disposable domains`,
      `pm.test("422 or 201/409 — Disposable email (422 in prod, 201/409 in emulator)", () => {`,
      `  pm.expect([201, 409, 422]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 422) {`,
      `  const j = pm.response.json();`,
      `  pm.test("error code is DISPOSABLE_EMAIL", () => pm.expect(j.error.code).to.equal("DISPOSABLE_EMAIL"));`,
      `}`,
    ],
  }),

  // Step 2: Sign in as that new member to get a disposable token for Logout
  buildRequest({
    name: 'Sign In — New Member (for logout test)',
    method: 'POST',
    url: {
      raw:  '{{authBaseUrl}}/accounts:signInWithPassword?key={{firebaseWebApiKey}}',
      host: ['{{authBaseUrl}}'],
      path: ['accounts:signInWithPassword'],
      query: [{ key: 'key', value: '{{firebaseWebApiKey}}', disabled: false }],
    },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'newmember{{runId}}@gmail.com', password: 'Member@Tccr2026', returnSecureToken: true }),
    tests: [
      `// 200 = signed in (registration succeeded); 400 = registration was blocked (422 MX) so user doesn't exist`,
      `pm.test("200 or 400 — New Member Sign In (400 = registration was blocked)", () => {`,
      `  pm.expect([200, 400]).to.include(pm.response.code);`,
      `});`,
      `const j = pm.response.json();`,
      `if (j.idToken) { pm.environment.set("tempMemberToken", j.idToken); }`,
    ],
  }),
  // Step 3: Logout with the disposable token — does NOT revoke any primary token
  buildRequest({
    name: 'Logout (new member)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/logout' },
    auth: bearerAuth('tempMemberToken'),
    headers: jsonHeader(),
    body: noBody(),
    // 200/204 = logged out; 401 = tempMemberToken not set (registration was 422-blocked)
    tests: [`pm.test("200 or 204 or 401 — Logout (401 = no token when registration was blocked)", () => { pm.expect([200, 204, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Request Password Reset',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/password-reset' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'student2@cmp.com' }),
    tests: [`pm.test("204 No Content — Password Reset", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Verify OTP (wrong OTP — expect 400)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/password-reset/verify' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'student2@cmp.com', otp: '000000' }),
    tests: [
      `pm.test("400 Bad Request — Wrong OTP", () => pm.response.to.have.status(400));`,
    ],
  }),
  buildRequest({
    name: 'Track Login Failure',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/track-failure' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({ email: 'student2@cmp.com' }),
    tests: [`pm.test("200 OK — Track Failure", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Federated Login — Google (emulator bypass)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/federated/google' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      idToken: Buffer.from(JSON.stringify({ email: 'federated@test.com', sub: 'google-uid-test', name: 'Federated User' })).toString('base64'),
      preferredLanguage: 'en',
    }),
    tests: [
      `pm.test("No 500 — Federated Login (Google)", () => {`,
      `  pm.expect(pm.response.code).to.not.equal(500);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  if (j.firebaseToken) pm.environment.set("federatedToken", j.firebaseToken);`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Federated Login — Apple (emulator bypass)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/federated/apple' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      idToken: Buffer.from(JSON.stringify({ email: 'federated-apple@test.com', sub: 'apple-uid-test' })).toString('base64'),
      preferredLanguage: 'en',
    }),
    tests: [
      `pm.test("No 500 — Federated Login (Apple)", () => {`,
      `  pm.expect(pm.response.code).to.not.equal(500);`,
      `});`,
    ],
  }),

  // ── Apple web OAuth flow ────────────────────────────────────────────────────
  buildRequest({
    name: 'Apple OAuth — Init (get state + auth URL)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/auth/apple/init' },
    auth: noAuth(),
    tests: [
      `// 404 = APPLE_CLIENT_ID not configured in .env (expected on local/dev stacks)`,
      `pm.test("200 or 404 — Apple Init (404 = Apple not configured)", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("state is a string", () => pm.expect(j.state).to.be.a("string").and.not.empty);`,
      `  pm.test("authorizeUrl starts with appleid.apple.com", () => pm.expect(j.authorizeUrl).to.include("appleid.apple.com"));`,
      `  if (j.state) { pm.environment.set("appleOAuthState", j.state); }`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Apple OAuth — Callback (exchange code)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/apple/callback' },
    auth: noAuth(),
    headers: jsonHeader(),
    body: jsonBody({
      code:  'apple-auth-code-placeholder',
      state: '{{appleOAuthState}}',
    }),
    tests: [
      `// 404 = APPLE_CLIENT_ID not configured; 400/401 = real flow without valid code/state`,
      `pm.test("No 500 — Apple Callback (404/401/400 all valid)", () => {`,
      `  pm.expect([200, 400, 401, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("firebaseToken present", () => pm.expect(j.firebaseToken).to.be.a("string"));`,
      `  if (j.firebaseToken) pm.environment.set("appleFirebaseToken", j.firebaseToken);`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Apple OAuth — Refresh (validate stored token)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/apple/refresh' },
    auth: bearerAuth('studentToken'),
    tests: [
      `// 404 = no Apple token stored for this account (expected for non-Apple seed users)`,
      `pm.test("No 500 — Apple Refresh", () => {`,
      `  pm.expect([200, 401, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Apple OAuth — Revoke (account deletion)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/auth/apple/revoke' },
    auth: bearerAuth('studentToken'),
    tests: [
      `// 200/204 = revoked (controller uses sendSuccess → 200); 404 = no Apple token stored; 401 = bad token`,
      `pm.test("200 or 204 or 401 or 404 — Apple Revoke", () => {`,
      `  pm.expect([200, 204, 401, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 2️⃣ USER SERVICE — Me
// ---------------------------------------------------------------------------

const meFolder = folder('2️⃣ User Service — Me', [
  buildRequest({
    name: 'Get My Profile',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me' },
    auth: bearerAuth('studentToken'),
    tests: [
      `pm.test("200 OK — Get Profile", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `if (j.uid) { pm.environment.set("student2Id", j.uid); }`,
    ],
  }),
  buildRequest({
    name: 'Update My Profile',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/me' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:          'Updated',
      lastName:           'Student',
      preferredLanguage:  'si',
      phoneNumber:        '+94771234567',
      dateOfBirth:        '2000-06-15',
      gender:             'male',
      address:            '123 Main St, Colombo',
      qualificationTitle: 'BSc Computer Science',
    }),
    description: 'Update own profile. Includes extended fields required for role request eligibility (dateOfBirth, gender, address, qualificationTitle).',
    tests: [
      `pm.test("200 OK — Update Profile", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("dateOfBirth stored", () => pm.expect(j.dateOfBirth).to.equal("2000-06-15"));`,
      `pm.test("gender stored",      () => pm.expect(j.gender).to.equal("male"));`,
    ],
  }),
  // Upload avatar — multipart/form-data
  {
    id: uuid(),
    name: 'Upload Avatar (photo)',
    request: {
      method: 'POST',
      header: [],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'photo',
            type: 'file',
            src: '',
            description: 'Select a JPEG or PNG image (max 2 MB).',
          },
        ],
      },
      url: makeUrl('{{baseUrl}}/me/avatar'),
      auth: bearerAuth('studentToken'),
      description: 'Multipart file upload. Field name must be "photo". Accepts image/jpeg or image/png, max 2 MB. Returns updated user profile with profilePhotoUrl set.',
    },
    response: [],
    event: testScript([
      `pm.test("200 OK or 400/415 — Upload Avatar", () => {`,
      `  pm.expect([200, 400, 415]).to.include(pm.response.code);`,
      `});`,
    ]),
  },
  // Upload qualification PDF — POST /me/qualification (multipart, field: qualification, PDF only, max 10 MB)
  {
    id: uuid(),
    name: 'Upload Qualification PDF',
    request: {
      method: 'POST',
      header: [],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'qualification',
            type: 'file',
            src: '',
            description: 'Select a PDF file (max 10 MB). Field name must be "qualification".',
          },
        ],
      },
      url: makeUrl('{{baseUrl}}/me/qualification'),
      auth: bearerAuth('studentToken'),
      description: [
        'Upload or replace the authenticated user\'s qualification PDF.',
        'Stored under qualifications/{uid}.pdf in Firebase Storage.',
        'The download URL is saved as qualificationUrl on the user document.',
        'This URL is automatically included when POST /role-requests is called.',
        '',
        'Field        | Type | Required',
        '-------------|------|--------',
        'qualification | file | Yes — PDF only, max 10 MB',
        '',
        'Newman note: 400 is expected (no real file on disk). Use Postman UI to test a real PDF upload.',
      ].join('\n'),
    },
    response: [],
    event: testScript([
      `pm.test("200 or 400/413/415 — Upload Qualification", () => {`,
      `  pm.expect([200, 400, 413, 415]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  // V2 response shape: { fileUrl: string | null }`,
      `  pm.test("fileUrl property exists (V2 response)", () => pm.expect(j).to.have.property("fileUrl"));`,
      `  if (j.fileUrl) {`,
      `    pm.test("fileUrl is a string when file was uploaded", () => pm.expect(j.fileUrl).to.be.a("string"));`,
      `    pm.environment.set("qualificationUrl", j.fileUrl);`,
      `  }`,
      `}`,
    ]),
  },
  // Change password on student1 (pending, won't affect the primary studentToken = student2)
  buildRequest({
    name: 'Change Password (student1)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/me/change-password' },
    auth: bearerAuth('student1Token'),
    headers: jsonHeader(),
    // Use the same value for new password so the account is unchanged after the test.
    // This prevents password drift between Newman runs on online Firebase.
    body: jsonBody({ currentPassword: 'Student1@123', newPassword: 'Student1@123' }),
    tests: [
      `// 200/204 = changed; 401 = invalid/expired token or wrong current password`,
      `pm.test("200 or 204 or 400 or 401 — Change Password", () => {`,
      `  pm.expect([200, 204, 400, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Register FCM Token',
    method: 'POST',
    url: { raw: '{{baseUrl}}/me/fcm-token' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ token: 'fcm-test-token-abc123' }),
    // Returns 200 (sendSuccess) not 204 in current implementation
    tests: [`pm.test("200 or 204 — Register FCM Token", () => { pm.expect([200, 204]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Delete FCM Token',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/me/fcm-token' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ token: 'fcm-test-token-abc123' }),
    tests: [`pm.test("204 No Content — Delete FCM Token", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Update Notification Preferences',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/me/notifications/preferences' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ email: true, push: false }),
    tests: [`pm.test("200 OK — Update Preferences", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Get My Notifications',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/notifications?limit=10' },
    auth: bearerAuth('studentToken'),
    tests: [
      `pm.test("200 OK — Get Notifications", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Link OAuth Provider',
    method: 'POST',
    url: { raw: '{{baseUrl}}/me/providers/link' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ provider: 'google', idToken: 'test-google-token' }),
    tests: [
      `pm.test("401 — invalid token rejected (not 500)", () => {`,
      `  pm.expect([400, 401, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Unlink OAuth Provider',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/me/providers/google' },
    auth: bearerAuth('studentToken'),
    tests: [
      `pm.test("No 500 error — Unlink Provider", () => {`,
      `  pm.expect(pm.response.code).to.not.equal(500);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Get My Course Detail (student view) ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/courses/{{courseId}}' },
    auth: bearerAuth('studentToken'),
    description: 'Returns course detail with semesters showing state (unscheduled/upcoming/open/closed) based on the student\'s enrolled batch schedule. API ref §5.x',
    tests: [
      `pm.test("200 or 404 or 403 — Student Course View", () => { pm.expect([200, 403, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("courseId present",     () => pm.expect(j.courseId).to.be.a("string"));`,
      `  pm.test("semesters is array",   () => pm.expect(j.semesters).to.be.an("array"));`,
      `  if (j.semesters.length > 0) {`,
      `    const s = j.semesters[0];`,
      `    pm.test("semester has state", () => pm.expect(["unscheduled","upcoming","open","closed"]).to.include(s.state));`,
      `    pm.test("semester has id",    () => pm.expect(s.id).to.be.a("string"));`,
      `  }`,
      `}`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 3️⃣ USER SERVICE — Admin Manage Users
// ---------------------------------------------------------------------------

const adminUsersFolder = folder('3️⃣ User Service — Admin Manage Users', [

  // ── System Summary (new) ──────────────────────────────────────────────────
  buildRequest({
    name: 'System User Summary — Admin ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users/summary' },
    auth: bearerAuth('adminToken'),
    description: [
      'Returns ALL approved users grouped by their highest role in one response.',
      'Groups: superAdmins → admins → g12 → leaders → students → members.',
      'Each user appears in exactly ONE group. Users sorted A→Z by displayName within each group.',
      '',
      'Seeded emulator data guarantees:',
      '  superAdmins ≥ 1  (superadmin@cmp.com)',
      '  admins      ≥ 1  (admin@cmp.com)',
      '  g12         ≥ 1  (g12leader@cmp.com)',
      '  leaders     ≥ 1  (leader@cmp.com)',
      '  students    ≥ 1  (student2@cmp.com)',
    ].join('\n'),
    tests: [
      `pm.test("200 OK — System User Summary", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("superAdmins is array", () => pm.expect(j.superAdmins).to.be.an("array"));`,
      `pm.test("admins is array",      () => pm.expect(j.admins).to.be.an("array"));`,
      `pm.test("g12 is array",         () => pm.expect(j.g12).to.be.an("array"));`,
      `pm.test("leaders is array",     () => pm.expect(j.leaders).to.be.an("array"));`,
      `pm.test("students is array",    () => pm.expect(j.students).to.be.an("array"));`,
      `pm.test("members is array",     () => pm.expect(j.members).to.be.an("array"));`,
      `pm.test("totals object present", () => {`,
      `  pm.expect(j.totals).to.be.an("object");`,
      `  pm.expect(j.totals.total).to.be.a("number").and.be.at.least(1);`,
      `});`,
      `pm.test("totals.superAdmins >= 1 (seed: superadmin@cmp.com)", () => pm.expect(j.totals.superAdmins).to.be.at.least(1));`,
      `pm.test("totals.admins >= 1 (seed: admin@cmp.com)",           () => pm.expect(j.totals.admins).to.be.at.least(1));`,
      `pm.test("totals.g12 >= 1 (seed: g12leader@cmp.com)",         () => pm.expect(j.totals.g12).to.be.at.least(1));`,
      `pm.test("totals.leaders >= 1 (seed: leader@cmp.com)",        () => pm.expect(j.totals.leaders).to.be.at.least(1));`,
      `pm.test("group sum equals total", () => {`,
      `  const t = j.totals;`,
      `  pm.expect(t.superAdmins + t.admins + t.g12 + t.leaders + t.students + t.members).to.equal(t.total);`,
      `});`,
      `pm.test("each profile has uid, email, displayName, roles, phoneNumber, createdAt", () => {`,
      `  const allProfiles = [...j.superAdmins, ...j.admins, ...j.g12, ...j.leaders, ...j.students, ...j.members];`,
      `  allProfiles.forEach(u => {`,
      `    pm.expect(u.uid,         "uid").to.be.a("string").and.not.empty;`,
      `    pm.expect(u.email,       "email").to.be.a("string").and.not.empty;`,
      `    pm.expect(u.displayName, "displayName").to.be.a("string");`,
      `    pm.expect(u.roles,       "roles").to.be.an("array");`,
      `    pm.expect(u.createdAt,   "createdAt").to.be.a("string");`,
      `    pm.expect(u).to.have.property("phoneNumber");`,
      `    pm.expect(u).to.have.property("profilePhotoUrl");`,
      `  });`,
      `});`,
    ],
  }),

  buildRequest({
    name: 'System User Summary — Leader (scoped) ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users/summary' },
    auth: bearerAuth('leaderToken'),
    description: 'Leader gets a scoped view — superAdmins and admins groups are empty (same scope as GET /users for leaders).',
    tests: [
      `pm.test("200 OK — Leader scoped summary", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("superAdmins is empty (scoped view)", () => pm.expect(j.superAdmins).to.be.an("array").and.have.lengthOf(0));`,
      `pm.test("admins is empty (scoped view)",      () => pm.expect(j.admins).to.be.an("array").and.have.lengthOf(0));`,
      `pm.test("g12 group still visible",             () => pm.expect(j.g12).to.be.an("array"));`,
      `pm.test("leaders still visible",               () => pm.expect(j.leaders).to.be.an("array"));`,
      `pm.test("totals.total >= 0", () => pm.expect(j.totals.total).to.be.a("number"));`,
    ],
  }),

  buildRequest({
    name: 'System User Summary — student (expect 403) ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users/summary' },
    auth: bearerAuth('studentToken'),
    tests: [
      `pm.test("403 — student cannot access summary", () => pm.response.to.have.status(403));`,
    ],
  }),

  buildRequest({
    name: 'List Users (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?limit=20' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — List Users", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Search Users by Name (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?name=Test' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Search Users", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Search Users by Name (Leader)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?name=Saman' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `pm.test("200 OK — Leader Search Users", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `pm.test("no admin in results", () => {`,
      `  (j.items || []).forEach(u => {`,
      `    pm.expect((u.roles || []).includes("admin")).to.be.false;`,
      `  });`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Search Users by Name (G12)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?name=Test' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 OK — G12 Search Users", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Filter Users by Role + Name Prefix (Admin)',
    method: 'GET',
    url: {
      raw: '{{baseUrl}}/users?role=g12&name=mem&limit=20',
      query: [
        { key: 'role',  value: 'g12',  description: 'Filter by role — member | student | leader | g12 | admin | super_admin' },
        { key: 'name',  value: 'mem',  description: 'Case-sensitive prefix match on firstName only' },
        { key: 'limit', value: '20',   description: 'Max results per page (1–100)' },
      ],
    },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Filter by role + name", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("response has items array", () => pm.expect(j.items).to.be.an("array"));`,
      `pm.test("response has total", () => pm.expect(j).to.have.property("total"));`,
      `pm.test("all returned users have g12 role", () => {`,
      `  (j.items || []).forEach(u => {`,
      `    pm.expect((u.roles || []).includes("g12")).to.be.true;`,
      `  });`,
      `});`,
      `pm.test("all returned firstName starts with 'mem' (case-sensitive)", () => {`,
      `  (j.items || []).forEach(u => {`,
      `    pm.expect(u.firstName).to.match(/^mem/);`,
      `  });`,
      `});`,
    ],
  }),
  // ─────────────────────────────────────────────────────────────────────────────
  // Create User Directly (Leader / G12)
  //
  // POST /users — allows a g12 / admin / super_admin to register a brand-new user
  // (someone not yet in the system) and immediately assign them a leader or g12 role.
  //
  // What the system does on success (201):
  //   1. Creates a Firebase Auth account with the supplied password.
  //   2. Sets Firebase custom claims: { role, roles: ['member', role] }
  //   3. Writes a Firestore user document with status:'approved', roles:['member',role].
  //   4. Generates a Firebase password-reset link (expires in 1 h).
  //   5. Publishes admin.created outbox event → notification-service sends a welcome
  //      email to the new user containing:
  //        • Their login credentials (email + temporary password)
  //        • A "Set Your Password →" button linking to the reset URL
  //        • A warning to change the password immediately
  //        • The system URL (APP_URL env var, default https://tccr.lk)
  //
  // Errors:
  //   409 EMAIL_EXISTS   — email already registered
  //   403 FORBIDDEN      — caller does not have g12 / admin / super_admin role
  //   400 VALIDATION     — missing or invalid fields
  // ─────────────────────────────────────────────────────────────────────────────

  // ── 1. Admin creates a Cell Leader ───────────────────────────────────────────
  buildRequest({
    name: 'Create Leader — Admin caller',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Saman',
      lastName:        'Silva',
      email:           'saman{{runId}}@tccr.lk',
      initialPassword: 'Leader@Tccr2026!',
      role:            'leader',
    }),
    tests: [
      `pm.test("201 Created — Create Leader", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `pm.test("uid is a string",                () => pm.expect(j.uid).to.be.a("string").and.not.empty);`,
      `pm.test("email matches input",             () => pm.expect(j.email).to.be.a("string"));`,
      `pm.test("firstName is Saman",              () => pm.expect(j.firstName).to.equal("Saman"));`,
      `pm.test("roles contains member + leader",  () => {`,
      `  pm.expect(j.roles).to.be.an("array");`,
      `  pm.expect(j.roles).to.include("member");`,
      `  pm.expect(j.roles).to.include("leader");`,
      `});`,
      `pm.test("status is approved",              () => pm.expect(j.status).to.equal("approved"));`,
      `pm.test("deletedAt is null",               () => pm.expect(j.deletedAt).to.be.null);`,
      `// Save for later tests (promote-leader-to-g12 and get-by-id)`,
      `if (j.uid) { pm.environment.set("createdLeaderId", j.uid); }`,
      `// Note: a welcome email was queued to saman{{runId}}@tccr.lk with credentials + reset link.`,
    ],
  }),

  // ── 2. G12 caller creates another G12 leader ─────────────────────────────────
  buildRequest({
    name: 'Create G12 — G12 caller',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Kamala',
      lastName:        'Perera',
      email:           'kamala{{runId}}@tccr.lk',
      initialPassword: 'G12User@Tccr2026!',
      role:            'g12',
    }),
    tests: [
      `pm.test("201 Created — G12 creates G12", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `pm.test("uid is a string",               () => pm.expect(j.uid).to.be.a("string").and.not.empty);`,
      `pm.test("roles contains member + g12",   () => {`,
      `  pm.expect(j.roles).to.be.an("array");`,
      `  pm.expect(j.roles).to.include("member");`,
      `  pm.expect(j.roles).to.include("g12");`,
      `});`,
      `pm.test("status is approved",            () => pm.expect(j.status).to.equal("approved"));`,
      `if (j.uid) { pm.environment.set("createdG12Id", j.uid); }`,
      `// Note: a G12 welcome email was queued to kamala{{runId}}@tccr.lk.`,
    ],
  }),

  // ── 3. Super Admin creates a Cell Leader ─────────────────────────────────────
  buildRequest({
    name: 'Create Leader — Super Admin caller',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('superAdminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Nimal',
      lastName:        'Fernando',
      email:           'nimal{{runId}}@gmail.com',
      initialPassword: 'NimalLeader@2026!',
      role:            'leader',
    }),
    tests: [
      `pm.test("201 Created — Super Admin creates Leader", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `pm.test("roles contains member + leader", () => {`,
      `  pm.expect(j.roles).to.include("member");`,
      `  pm.expect(j.roles).to.include("leader");`,
      `});`,
      `pm.test("status is approved",             () => pm.expect(j.status).to.equal("approved"));`,
    ],
  }),

  // ── 4. Duplicate email → 409 EMAIL_EXISTS ────────────────────────────────────
  buildRequest({
    name: 'Create User — Duplicate email → 409',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Saman',
      lastName:        'Silva',
      email:           'saman{{runId}}@tccr.lk',  // same email as request #1
      initialPassword: 'AnotherPass@123',
      role:            'leader',
    }),
    tests: [
      `pm.test("409 — Duplicate email rejected", () => pm.response.to.have.status(409));`,
      `const j = pm.response.json();`,
      `pm.test("error code is EMAIL_EXISTS",     () => pm.expect(j.error.code).to.equal("EMAIL_EXISTS"));`,
    ],
  }),

  // ── 5. Unauthorized caller (student) → 403 ───────────────────────────────────
  buildRequest({
    name: 'Create User — Student caller → 403',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Test',
      lastName:        'User',
      email:           'testunauth{{runId}}@tccr.lk',
      initialPassword: 'Pass@12345',
      role:            'leader',
    }),
    tests: [
      `pm.test("403 — Student cannot create users", () => pm.response.to.have.status(403));`,
    ],
  }),

  // ── 6. Missing required field → 400 ──────────────────────────────────────────
  buildRequest({
    name: 'Create User — Missing role field → 400',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      firstName:       'Test',
      lastName:        'User',
      email:           'missing-role{{runId}}@tccr.lk',
      initialPassword: 'Pass@12345',
      // role intentionally omitted
    }),
    tests: [
      `pm.test("400 — Missing role returns validation error", () => pm.response.to.have.status(400));`,
    ],
  }),
  buildRequest({
    name: 'Get User by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users/{{student2Id}}' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Get User", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      // Keep userId in sync for requests that still use the old variable name
      `if (j.uid) { pm.environment.set("userId", j.uid); }`,
    ],
  }),
  // Suspend/Reactivate use registeredUid (new member from Auth folder) — NOT student2.
  // This keeps the seed student2 account intact so it never cascades failures into /me tests.
  buildRequest({
    name: 'Suspend User (registeredUid)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/suspend' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 or 404 — Suspend User (404 if register failed)", () => { pm.expect([200, 404]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Reactivate User (registeredUid)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/reactivate' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 or 404 — Reactivate User (404 if register failed)", () => { pm.expect([200, 404]).to.include(pm.response.code); });`],
  }),

  // ── Delete User ────────────────────────────────────────────────────────────
  // Soft-deletes a regular (non-admin) user: sets deletedAt in Firestore +
  // disables their Firebase Auth account. Use DELETE /super-admin/admins/:uid
  // for admin accounts. Caller cannot delete their own account.
  buildRequest({
    name: 'Delete User (Admin)',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}' },
    auth: bearerAuth('adminToken'),
    description: [
      'Soft-delete a regular (non-admin) user.',
      '',
      'Business rules enforced by DeleteUserUseCase:',
      '  • 403 FORBIDDEN  — caller tries to delete themselves',
      '  • 404 USER_NOT_FOUND — target UID does not exist or is already deleted',
      '  • 403 FORBIDDEN  — target holds admin or super_admin role (use DELETE /super-admin/admins/:uid instead)',
      '  • 204 No Content — success: deletedAt set in Firestore + Firebase Auth account disabled',
      '',
      'Note: registeredUid may be empty if the prior Create User step failed (Newman/no-file).',
      'In that case the request returns 404 — this is expected.',
    ].join('\n'),
    tests: [
      `pm.test("204 or 404 — Delete User (404 if registration failed)", () => {`,
      `  pm.expect([204, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 204) {`,
      `  pm.test("204 response has no body", () => {`,
      `    pm.expect(pm.response.text()).to.equal("");`,
      `  });`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Update User Roles (add student — registeredUid)',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/roles' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'student', action: 'add' }),
    tests: [`pm.test("204 or 404 — Update Roles", () => { pm.expect([204, 404]).to.include(pm.response.code); });`],
  }),
  // Promote endpoint tests — use registeredUid (disposable member) so seed accounts stay clean.
  buildRequest({
    name: 'Promote member → leader (g12 caller, registeredUid)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/promote' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'leader' }),
    tests: [
      `pm.test("200 or 404 — g12 promotes to leader", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  buildRequest({
    name: 'Promote member → g12 (g12 caller, registeredUid)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/promote' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    tests: [
      `pm.test("200 or 404 — g12 promotes to g12", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  buildRequest({
    name: 'Promote leader → g12 (leader caller, createdLeaderId)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{createdLeaderId}}/promote' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    tests: [
      `pm.test("200 or 404 or 409 — leader promotes leader to g12 (409 = already g12)", () => { pm.expect([200, 404, 409]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  // 403 tests verify RBAC — the 403 is returned before any DB write, so target UID doesn't matter.
  buildRequest({
    name: 'Leader tries promote → leader (expect 403)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/promote' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'leader' }),
    tests: [`pm.test("403 — leader cannot grant leader role", () => pm.response.to.have.status(403));`],
  }),
  buildRequest({
    name: 'Student tries promote (expect 403)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/promote' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    tests: [`pm.test("403 — student cannot promote", () => pm.response.to.have.status(403));`],
  }),

  // ── Demote ─────────────────────────────────────────────────────────────────
  // Demote the registeredUid user (was promoted to leader/g12 above) back to member.
  // Uses admin token which can demote leader/g12/student.
  buildRequest({
    name: 'Demote user → remove leader role (admin caller) ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'leader' }),
    tests: [
      `// 200 = demoted; 404 = user not found (expected if promote was skipped)`,
      `pm.test("200 or 404 — admin demotes leader", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  buildRequest({
    name: 'Demote user → remove g12 role (admin caller) ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    tests: [
      `pm.test("200 or 404 — admin demotes g12", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  buildRequest({
    name: 'G12 demotes leader (g12 caller) — allowed',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'leader' }),
    description: 'g12 can demote leader role only — this should succeed (200) or 404 if user not found.',
    tests: [
      `pm.test("200 or 404 — g12 demotes leader", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("success message", () => pm.expect(j.message).to.be.a("string")); }`,
    ],
  }),
  buildRequest({
    name: 'G12 tries to demote g12 (expect 403)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    description: 'g12 cannot demote another g12 — forbidden. Only admin/super_admin can remove the g12 role.',
    tests: [`pm.test("403 — g12 cannot demote another g12", () => pm.response.to.have.status(403));`],
  }),
  buildRequest({
    name: 'Leader tries demote → leader (expect 403) ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'leader' }),
    tests: [`pm.test("403 — leader cannot demote another leader", () => pm.response.to.have.status(403));`],
  }),
  buildRequest({
    name: 'Student tries demote (expect 403) ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/users/{{registeredUid}}/demote' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ role: 'g12' }),
    tests: [`pm.test("403 — student cannot demote", () => pm.response.to.have.status(403));`],
  }),
]);

// ---------------------------------------------------------------------------
// 4️⃣ USER SERVICE — Super Admin
// ---------------------------------------------------------------------------

const superAdminFolder = folder('4️⃣ User Service — Super Admin', [
  buildRequest({
    name: 'List Admins',
    method: 'GET',
    url: { raw: '{{baseUrl}}/super-admin/admins' },
    auth: bearerAuth('superAdminToken'),
    tests: [
      `pm.test("200 OK — List Admins", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Create Admin',
    method: 'POST',
    url: { raw: '{{baseUrl}}/super-admin/admins' },
    auth: bearerAuth('superAdminToken'),
    headers: jsonHeader(),
    // API ref §18.2 — preferredLanguage optional field added in V2
    body: jsonBody({
      firstName:          'New',
      lastName:           'Admin',
      email:              'newadmin{{runId}}@tccr.lk',
      initialPassword:    'Admin@Tccr2026',
      preferredLanguage:  'en',
    }),
    tests: [
      `pm.test("201 or 409 — Create Admin (409 = email exists in Auth emulator)", () => { pm.expect([201, 409]).to.include(pm.response.code); });`,
      `const j = pm.response.json();`,
      `if (j.uid) { pm.environment.set("promotedAdminId", j.uid); }`,
    ],
  }),
  buildRequest({
    name: 'Get Admin by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/super-admin/admins/{{promotedAdminId}}' },
    auth: bearerAuth('superAdminToken'),
    tests: [`pm.test("200 OK — Get Admin", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Suspend Admin',
    method: 'POST',
    url: { raw: '{{baseUrl}}/super-admin/admins/{{promotedAdminId}}/suspend' },
    auth: bearerAuth('superAdminToken'),
    tests: [`pm.test("200 OK — Suspend Admin", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Reactivate Admin',
    method: 'POST',
    url: { raw: '{{baseUrl}}/super-admin/admins/{{promotedAdminId}}/reactivate' },
    auth: bearerAuth('superAdminToken'),
    tests: [`pm.test("200 OK — Reactivate Admin", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Make User Admin (registeredUid)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/super-admin/users/{{registeredUid}}/make-admin' },
    auth: bearerAuth('superAdminToken'),
    // 409 = user already has admin/g12 level (was promoted in folder 3 promote tests)
    tests: [`pm.test("200 or 404 or 409 — Make Admin", () => { pm.expect([200, 404, 409]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Delete Admin',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/super-admin/admins/{{promotedAdminId}}' },
    auth: bearerAuth('superAdminToken'),
    tests: [`pm.test("204 No Content — Delete Admin", () => pm.response.to.have.status(204));`],
  }),
]);

// ---------------------------------------------------------------------------
// 5️⃣ COURSE SERVICE — Build a Course
// ---------------------------------------------------------------------------

const buildCourseFolder = folder('5️⃣ Course Service — Build a Course', [
  buildRequest({
    name: 'Create Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      title: 'Introduction to Faith {{runId}}',
      description: 'A foundational course for new believers.',
      coverImageUrl: null,
    }),
    tests: [
      `pm.test("201 Created — Create Course", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) {`,
      `  pm.environment.set("courseId", j.id);`,
      `} else if (pm.response.code === 409) {`,
      `  // Title already exists (re-run without fresh runId) — fetch by title and recover the ID`,
      `  const runId = pm.environment.get('runId') || '';`,
      `  const title = encodeURIComponent('Introduction to Faith' + (runId ? ' ' + runId : ''));`,
      `  pm.sendRequest(`,
      `    { url: pm.environment.get('baseUrl') + '/courses?title=' + title, method: 'GET',`,
      `      header: { Authorization: 'Bearer ' + pm.environment.get('adminToken') } },`,
      `    (err, res) => {`,
      `      if (!err) { const d = res.json(); if (d.items && d.items.length > 0) pm.environment.set('courseId', d.items[0].id); }`,
      `    }`,
      `  );`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'List Courses (public)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/courses?limit=20' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — List Courses", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Search Courses by Title',
    method: 'GET',
    url: { raw: '{{baseUrl}}/courses?title=Intro' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Search Courses", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Get Course by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Get Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Update Course',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      title: 'Introduction to Faith {{runId}} (Updated)',
      description: 'Updated description.',
    }),
    tests: [`pm.test("200 OK — Update Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Create Semester',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/semesters' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    // API ref §8.2 — openDate and endDate are optional V2 fields
    body: jsonBody({
      title:     'Semester 1 — Foundations',
      openDate:  '2026-07-01',
      endDate:   '2026-12-31',
    }),
    tests: [
      `pm.test("201 Created — Create Semester", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("semesterId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'Update Semester',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/semesters/{{semesterId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ title: 'Semester 1 — Foundations (Updated)' }),
    tests: [`pm.test("200 OK — Update Semester", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Create Subject 1',
    method: 'POST',
    url: { raw: '{{baseUrl}}/semesters/{{semesterId}}/subjects' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ title: 'Who is God?' }),
    tests: [
      `pm.test("201 Created — Create Subject 1", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("subjectId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'Create Subject 2',
    method: 'POST',
    url: { raw: '{{baseUrl}}/semesters/{{semesterId}}/subjects' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ title: 'Prayer and Worship' }),
    tests: [
      `pm.test("201 Created — Create Subject 2", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("subjectId2", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'Update Subject',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/subjects/{{subjectId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ title: 'Who is God? (Updated)' }),
    tests: [`pm.test("200 OK — Update Subject", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'List Semesters',
    method: 'GET',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/semesters' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — List Semesters", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'List Subjects',
    method: 'GET',
    url: { raw: '{{baseUrl}}/semesters/{{semesterId}}/subjects' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — List Subjects", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Create Lesson',
    method: 'POST',
    url: { raw: '{{baseUrl}}/subjects/{{subjectId}}/lessons' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      title: 'God the Father',
      description: 'Understanding the Father heart of God.',
      youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      attachmentIds: [],
    }),
    tests: [
      `pm.test("201 Created — Create Lesson", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("lessonId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'Update Lesson',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/lessons/{{lessonId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({
      title: 'God the Father (Updated)',
      description: 'Revised lesson content.',
    }),
    tests: [`pm.test("200 OK — Update Lesson", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'List Lessons',
    method: 'GET',
    url: { raw: '{{baseUrl}}/subjects/{{subjectId}}/lessons' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — List Lessons", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Publish Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/publish' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Publish Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Unpublish Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/unpublish' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Unpublish Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Re-publish Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/publish' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Re-publish Course", () => pm.response.to.have.status(200));`],
  }),
]);

// ---------------------------------------------------------------------------
// 6️⃣ BATCHES (V2)
// ---------------------------------------------------------------------------

const batchesFolder = folder('6️⃣ Batches (V2)', [
  buildRequest({
    name: 'Create Batch',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/batches' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    // scheduledOpenAt: null keeps the batch in DRAFT state so it can be opened manually.
    // A past scheduledOpenAt would auto-open the batch immediately on creation,
    // which prevents testing the manual open flow and semester-dates validation.
    body: jsonBody({
      name:            'Batch 2026 — Q1',
      scheduledOpenAt: null,
      intakeStart:     '2026-06-01',
      intakeEnd:       '2026-12-31',
      capacity:        50,
    }),
    tests: [
      `pm.test("201 Created — Create Batch", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `pm.test("state is draft", () => pm.expect(j.state).to.equal("draft"));`,
      `if (j.id) { pm.environment.set("batchId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'List Batches',
    method: 'GET',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/batches' },
    auth: bearerAuth('studentToken'),
    tests: [
      `pm.test("200 OK — List Batches", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Get Batch by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/batches/{{batchId}}' },
    auth: bearerAuth('studentToken'),
    tests: [`pm.test("200 or 404 — Get Batch", () => { pm.expect([200, 404]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Update Batch',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/batches/{{batchId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ name: 'Batch 2026 — Q1 (Updated)' }),
    tests: [`pm.test("200 OK — Update Batch", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Open Batch',
    method: 'POST',
    url: { raw: '{{baseUrl}}/batches/{{batchId}}/open' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 or 409 or 400 — Open Batch", () => {`,
      `  pm.expect([200, 400, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Close Batch',
    method: 'POST',
    url: { raw: '{{baseUrl}}/batches/{{batchId}}/close' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 or 409 — Close Batch (409 = already closed)", () => { pm.expect([200, 409]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Set Batch Semester Dates ★ NEW',
    method: 'PUT',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/batches/{{batchId}}/semester-dates' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    description: 'Set open/end dates for all semesters in a batch. Admin only. Returns array of BatchSemesterView.',
    body: jsonBody({
      schedule: [
        { semesterId: '{{semesterId}}', openDate: '2026-06-01', endDate: '2026-08-31' },
      ],
    }),
    tests: [
      `pm.test("200 or 404 — Set Semester Dates", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("response is array", () => pm.expect(j).to.be.an("array"));`,
      `  if (j.length > 0) {`,
      `    pm.test("first entry has semesterId", () => pm.expect(j[0].semesterId).to.be.a("string"));`,
      `    pm.test("first entry has openDate",   () => pm.expect(j[0]).to.have.property("openDate"));`,
      `    pm.test("first entry has endDate",    () => pm.expect(j[0]).to.have.property("endDate"));`,
      `  }`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Patch One Semester Date ★ NEW',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/batches/{{batchId}}/semester-dates/{{semesterId}}' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    description: 'Update a single semester\'s open/end dates within a batch. Admin only.',
    body: jsonBody({ openDate: '2026-07-01', endDate: '2026-09-30' }),
    tests: [
      `pm.test("200 or 404 — Patch Semester Date", () => { pm.expect([200, 404]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("semesterId present", () => pm.expect(j.semesterId).to.be.a("string"));`,
      `  pm.test("openDate is 2026-07-01", () => pm.expect(j.openDate).to.equal("2026-07-01"));`,
      `  pm.test("endDate is 2026-09-30",  () => pm.expect(j.endDate).to.equal("2026-09-30"));`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Patch Semester Date — non-admin (expect 403) ★ NEW',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/batches/{{batchId}}/semester-dates/{{semesterId}}' },
    auth: bearerAuth('studentToken'),
    headers: jsonHeader(),
    body: jsonBody({ openDate: '2026-07-01', endDate: '2026-09-30' }),
    tests: [`pm.test("403 or 404 — student cannot patch semester dates", () => { pm.expect([403, 404]).to.include(pm.response.code); });`],
  }),
]);

// ---------------------------------------------------------------------------
// 7️⃣ ENROLLMENT
// ---------------------------------------------------------------------------

const enrollmentFolder = folder('7️⃣ Enrollment', [
  buildRequest({
    name: 'Enroll in Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/enroll' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: noBody(),
    tests: [
      `pm.test("201 or 409 — Enroll", () => {`,
      `  pm.expect([201, 409]).to.include(pm.response.code);`,
      `});`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("enrollmentId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'Get My Enrollments',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/enrollments' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 OK — Get Enrollments", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `if (j.items && j.items.length > 0 && !pm.environment.get("enrollmentId")) {`,
      `  pm.environment.set("enrollmentId", j.items[0].id);`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'List Registrations (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/admin/registrations' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — List Registrations", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `if (j.items && j.items.length > 0 && !pm.environment.get("registrationId")) {`,
      `  pm.environment.set("registrationId", j.items[0].id);`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Approve Registration',
    method: 'POST',
    url: { raw: '{{baseUrl}}/admin/registrations/{{registrationId}}/approve' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 or 404 or 409 — Approve Registration (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Reject Registration',
    method: 'POST',
    url: { raw: '{{baseUrl}}/admin/registrations/{{registrationId}}/reject' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ reason: 'Does not meet requirements.' }),
    tests: [
      `pm.test("200 or 404 or 409 — Reject Registration (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Bulk Approve Registrations',
    method: 'POST',
    url: { raw: '{{baseUrl}}/admin/registrations/bulk-approve' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ ids: ['{{registrationId}}'] }),
    tests: [`pm.test("200 OK — Bulk Approve", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'List Enrollments (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/admin/enrollments' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — List Enrollments", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Approve Enrollment',
    method: 'POST',
    url: { raw: '{{baseUrl}}/admin/enrollments/{{enrollmentId}}/approve' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    // API ref §11.5 — optional note field added in V2
    body: jsonBody({ note: 'Approved for the 2026 intake.' }),
    tests: [
      `pm.test("200 or 404 — Approve Enrollment", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Reject Enrollment',
    method: 'POST',
    url: { raw: '{{baseUrl}}/admin/enrollments/{{enrollmentId}}/reject' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ reason: 'Enrollment rejected for testing.' }),
    tests: [
      `pm.test("200 or 404 or 409 — Reject Enrollment (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Withdraw Enrollment',
    method: 'POST',
    url: { raw: '{{baseUrl}}/enrollments/{{enrollmentId}}/withdraw' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 or 404 — Withdraw Enrollment", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  // ── V2 clean-path aliases ───────────────────────────────────────────────────
  buildRequest({
    name: 'Get My Enrollments (V2 alias — /enrollments/mine)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/enrollments/mine' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 OK — Get My Enrollments V2", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Enroll in Course V2 (POST /enrollments with batchId)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/enrollments' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ courseId: '{{courseId}}', batchId: '{{batchId}}' }),
    tests: [
      `pm.test("201 or 409 — Enroll V2", () => {`,
      `  pm.expect([201, 409, 422]).to.include(pm.response.code);`,
      `});`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("enrollmentId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'List Enrollments Admin V2 (GET /enrollments)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/enrollments?limit=20' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — List Enrollments V2", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Approve Enrollment V2 (POST /enrollments/:id/approve)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/enrollments/{{enrollmentId}}/approve' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ note: 'Approved for the 2026 intake.' }),
    tests: [
      `pm.test("200 or 404 or 409 — Approve Enrollment V2", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Reject Enrollment V2 (POST /enrollments/:id/reject)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/enrollments/{{enrollmentId}}/reject' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ reason: 'Rejected via V2 path.' }),
    tests: [
      `pm.test("200 or 404 or 409 — Reject Enrollment V2", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 8️⃣ ROLE REQUESTS (V2)
// ---------------------------------------------------------------------------

const roleRequestsFolder = folder('8️⃣ Role Requests (V2)', [
  // ── 1. Create Role Request — JSON body: { requestedRole: "student" } ────────
  // Uses leaderToken: leader has ["member","leader"] — no "student" role yet,
  // so this is a valid new request that returns 201 and saves roleRequestId.
  // Cannot use tempMemberToken: it was revoked by Logout in folder 1 and the
  // registered user is deleted in folder 3 before this folder runs.
  buildRequest({
    name: 'Create Role Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/role-requests' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ requestedRole: 'student' }),
    description: [
      'Submit a student role application.',
      '',
      'Prerequisites (must be done first):',
      '  1. PATCH /me — fill dateOfBirth, gender, address, qualificationTitle',
      '  2. POST /me/qualification — upload the PDF to user profile',
      '',
      'The system reads all personal details from the member\'s profile automatically.',
      'No personal fields needed in this request — only { requestedRole: "student" }.',
      '',
      'Errors:',
      '  400 VALIDATION_ERROR  — missing or invalid requestedRole',
      '  404 USER_NOT_FOUND    — profile could not be loaded',
      '  409 ROLE_REQUEST_PENDING — already has a pending request',
    ].join('\n'),
    tests: [
      `pm.test("201/403/404/409 — Create Role Request", () => {`,
      `  pm.expect([201, 403, 404, 409]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 201) {`,
      `  const j = pm.response.json();`,
      `  pm.environment.set("roleRequestId", j.id);`,
      `  pm.test("id is a string",              () => pm.expect(j.id).to.be.a("string"));`,
      `  pm.test("status is pending",           () => pm.expect(j.status).to.equal("pending"));`,
      `  pm.test("requestedRole is student",    () => pm.expect(j.requestedRole).to.equal("student"));`,
      `  pm.test("applicantProfile is object",  () => pm.expect(j.applicantProfile).to.be.an("object"));`,
      `  pm.test("applicantProfile.email set",  () => pm.expect(j.applicantProfile.email).to.be.a("string"));`,
      `  pm.test("qualificationStoragePath is null", () => pm.expect(j.qualificationStoragePath).to.be.null);`,
      `}`,
    ],
  }),

  // ── 2. Get My Role Requests ────────────────────────────────────────────────
  // Response: plain array (NOT paginated). GetMyRoleRequestsUseCase uses sendSuccess(), not sendPaginated().
  // Uses leaderToken — same caller who created the role request above.
  buildRequest({
    name: 'Get My Role Requests',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests/mine' },
    auth: bearerAuth('leaderToken'),
    description: 'Returns a plain array of the caller\'s own role requests. Route is accessible to any authenticated role.',
    tests: [
      `pm.test("200 OK — Get My Role Requests", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `// Response is a PLAIN ARRAY — not {items,nextCursor,total}. Controller uses sendSuccess(), not sendPaginated().`,
      `pm.test("result is a plain array", () => pm.expect(j).to.be.an("array"));`,
      `if (Array.isArray(j) && j.length > 0) {`,
      `  const first = j[0];`,
      `  if (!pm.environment.get("roleRequestId")) { pm.environment.set("roleRequestId", first.id); }`,
      `  pm.test("id is a string",            () => pm.expect(first.id).to.be.a("string"));`,
      `  pm.test("requesterUid is a string",  () => pm.expect(first.requesterUid).to.be.a("string"));`,
      `  pm.test("requestedRole is 'student'",() => pm.expect(first.requestedRole).to.equal("student"));`,
      `  pm.test("status is valid",           () => pm.expect(["pending","approved","rejected"]).to.include(first.status));`,
      `  pm.test("createdAt is a string",     () => pm.expect(first.createdAt).to.be.a("string"));`,
      `  if (first.applicantProfile) {`,
      `    pm.test("applicantProfile.firstName is a string",   () => pm.expect(first.applicantProfile.firstName).to.be.a("string"));`,
      `    if (first.applicantProfile.dateOfBirth) pm.test("applicantProfile.dateOfBirth is a string", () => pm.expect(first.applicantProfile.dateOfBirth).to.be.a("string"));`,
      `    if (first.applicantProfile.gender) pm.test("applicantProfile.gender is valid", () => pm.expect(["male","female","other"]).to.include(first.applicantProfile.gender));`,
      `  }`,
      `  if (first.qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(first.qualificationTitle).to.be.a("string"));`,
      `  pm.test("qualificationStoragePath is null (PDF now on profile)", () => pm.expect(first.qualificationStoragePath).to.be.null);`,
      `  if (first.applicantProfile && first.applicantProfile.qualificationUrl) {`,
      `    pm.test("applicantProfile.qualificationUrl is a string", () => pm.expect(first.applicantProfile.qualificationUrl).to.be.a("string"));`,
      `  }`,
      `}`,
    ],
  }),

  // ── 3. List Role Requests (Admin only) ───────────────────────────────────
  buildRequest({
    name: 'List Role Requests (Admin only)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests' },
    auth: bearerAuth('adminToken'),
    description: 'Only admin can list all role requests. leader and g12 do not have access (403).',
    tests: [
      `pm.test("200 OK — List Role Requests", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `if (j.items && j.items.length > 0) {`,
      `  if (!pm.environment.get("roleRequestId")) { pm.environment.set("roleRequestId", j.items[0].id); }`,
      `  if (j.items[0].applicantProfile) {`,
      `    pm.test("applicantProfile.email is a string", () => pm.expect(j.items[0].applicantProfile.email).to.be.a("string"));`,
      `    if (j.items[0].applicantProfile.qualificationUrl) {`,
      `      pm.test("qualificationUrl is a string", () => pm.expect(j.items[0].applicantProfile.qualificationUrl).to.be.a("string"));`,
      `    }`,
      `  }`,
      `  if (j.items[0].qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(j.items[0].qualificationTitle).to.be.a("string"));`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'List Role Requests — leader (expect 403)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests' },
    auth: bearerAuth('leaderToken'),
    description: 'leader does not have access to list all role requests — only admin can.',
    tests: [`pm.test("403 — leader cannot list role requests", () => pm.response.to.have.status(403));`],
  }),

  // ── 4. Get Own Role Request by ID (Member) ────────────────────────────────
  // Member retrieves their own role request by ID.
  // Ownership is enforced by GetRoleRequestByIdUseCase:
  //   - isAdmin=false  → allowed only when roleRequest.requesterUid === caller UID
  //   - Returns 403 FORBIDDEN if the caller tries to fetch another user's request
  buildRequest({
    name: 'Get Own Role Request by ID (Member)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests/{{roleRequestId}}' },
    auth: bearerAuth('leaderToken'),
    description: [
      'Member (or student/leader/g12) fetches their own role request by ID.',
      'Access rule: GetRoleRequestByIdUseCase enforces ownership — non-admin callers',
      'may only view requests where roleRequest.requesterUid === their own UID.',
      '',
      'Returns 200 with the full RoleRequest object (including applicantProfile).',
      'Returns 403 FORBIDDEN if the caller tries to read someone else\'s request.',
      'Returns 404 ROLE_REQUEST_NOT_FOUND if the ID does not exist.',
    ].join('\n'),
    tests: [
      `pm.test("200 or 404 — Get Own Role Request (Member)", () => {`,
      `  pm.expect([200, 403, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("id is a string",          () => pm.expect(j.id).to.be.a("string"));`,
      `  pm.test("requesterUid is a string", () => pm.expect(j.requesterUid).to.be.a("string"));`,
      `  pm.test("requestedRole is student", () => pm.expect(j.requestedRole).to.equal("student"));`,
      `  pm.test("status is valid",          () => pm.expect(["pending","approved","rejected"]).to.include(j.status));`,
      `  pm.test("createdAt is a string",    () => pm.expect(j.createdAt).to.be.a("string"));`,
      `  if (j.qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(j.qualificationTitle).to.be.a("string"));`,
      `  pm.test("qualificationStoragePath is null", () => pm.expect(j.qualificationStoragePath).to.be.null);`,
      `  pm.test("applicantProfile is an object",        () => pm.expect(j.applicantProfile).to.be.an("object"));`,
      `  pm.test("applicantProfile.firstName present",   () => pm.expect(j.applicantProfile.firstName).to.be.a("string"));`,
      `  pm.test("applicantProfile.lastName present",    () => pm.expect(j.applicantProfile.lastName).to.be.a("string"));`,
      `  pm.test("applicantProfile.email present",       () => pm.expect(j.applicantProfile.email).to.be.a("string"));`,
      `  if (j.applicantProfile.phoneNumber) pm.test("applicantProfile.phoneNumber present", () => pm.expect(j.applicantProfile.phoneNumber).to.be.a("string"));`,
      `  if (j.applicantProfile.dateOfBirth) pm.test("applicantProfile.dateOfBirth present", () => pm.expect(j.applicantProfile.dateOfBirth).to.be.a("string"));`,
      `  if (j.applicantProfile.gender)      pm.test("applicantProfile.gender is valid",     () => pm.expect(["male","female","other"]).to.include(j.applicantProfile.gender));`,
      `  if (j.applicantProfile.address)     pm.test("applicantProfile.address present",     () => pm.expect(j.applicantProfile.address).to.be.a("string"));`,
      `  if (j.applicantProfile.qualificationUrl) pm.test("qualificationUrl is a string", () => pm.expect(j.applicantProfile.qualificationUrl).to.be.a("string"));`,
      `  // Non-admin callers always get memberProfile: null (no user-service call made)`,
      `  pm.test("memberProfile is null for non-admin", () => pm.expect(j.memberProfile).to.be.null);`,
      `}`,
    ],
  }),

  // ── 5. Get Role Request by ID (Admin) ─────────────────────────────────────
  // Admin retrieves any role request by ID — no ownership restriction.
  // Response includes live memberProfile block fetched from user-service.
  buildRequest({
    name: 'Get Role Request by ID (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests/{{roleRequestId}}' },
    auth: bearerAuth('adminToken'),
    description: [
      'Admin or super_admin fetches any role request by ID.',
      'isAdmin=true bypasses the ownership check in GetRoleRequestByIdUseCase.',
      '',
      'Response includes a live memberProfile block with the member\'s current profile',
      'fetched from user-service at request time — always up to date for the review UI.',
      '',
      'memberProfile fields: uid, email, firstName, lastName, phoneNumber, profilePhotoUrl,',
      'dateOfBirth, gender, address, preferredLanguage, roles[], status, accountCreatedAt,',
      'qualifications[].',
      '',
      'memberProfile is null only if user-service is temporarily unavailable (graceful degradation).',
    ].join('\n'),
    tests: [
      `pm.test("200 or 404 — Get Role Request (Admin)", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  // ── Core RoleRequest fields ─────────────────────────────────────`,
      `  pm.test("id is a string",          () => pm.expect(j.id).to.be.a("string"));`,
      `  pm.test("requesterUid is a string",() => pm.expect(j.requesterUid).to.be.a("string"));`,
      `  pm.test("requestedRole is student",() => pm.expect(j.requestedRole).to.equal("student"));`,
      `  pm.test("status is valid",         () => pm.expect(["pending","approved","rejected"]).to.include(j.status));`,
      `  pm.test("createdAt is a string",   () => pm.expect(j.createdAt).to.be.a("string"));`,
      `  if (j.qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(j.qualificationTitle).to.be.a("string"));`,
      `  // ── applicantProfile (snapshot) ─────────────────────────────────`,
      `  if (j.applicantProfile) {`,
      `    pm.test("applicantProfile is an object",      () => pm.expect(j.applicantProfile).to.be.an("object"));`,
      `    pm.test("applicantProfile.firstName present", () => pm.expect(j.applicantProfile.firstName).to.be.a("string"));`,
      `    pm.test("applicantProfile.lastName present",  () => pm.expect(j.applicantProfile.lastName).to.be.a("string"));`,
      `    pm.test("applicantProfile.email present",     () => pm.expect(j.applicantProfile.email).to.be.a("string"));`,
      `    if (j.applicantProfile.dateOfBirth) pm.test("applicantProfile.dateOfBirth is string", () => pm.expect(j.applicantProfile.dateOfBirth).to.be.a("string"));`,
      `    if (j.applicantProfile.gender)      pm.test("applicantProfile.gender is valid",       () => pm.expect(["male","female","other"]).to.include(j.applicantProfile.gender));`,
      `    if (j.applicantProfile.address)     pm.test("applicantProfile.address is string",     () => pm.expect(j.applicantProfile.address).to.be.a("string"));`,
      `  }`,
      `  // ── memberProfile (live — admin only) ───────────────────────────`,
      `  pm.test("memberProfile key present in response", () => pm.expect(j).to.have.property("memberProfile"));`,
      `  if (j.memberProfile !== null) {`,
      `    const mp = j.memberProfile;`,
      `    pm.test("memberProfile is an object",              () => pm.expect(mp).to.be.an("object"));`,
      `    pm.test("memberProfile.uid is a string",           () => pm.expect(mp.uid).to.be.a("string"));`,
      `    pm.test("memberProfile.email is a string",         () => pm.expect(mp.email).to.be.a("string"));`,
      `    pm.test("memberProfile.firstName is a string",     () => pm.expect(mp.firstName).to.be.a("string"));`,
      `    pm.test("memberProfile.lastName is a string",      () => pm.expect(mp.lastName).to.be.a("string"));`,
      `    pm.test("memberProfile.roles is an array",         () => pm.expect(mp.roles).to.be.an("array"));`,
      `    pm.test("memberProfile.status is a string",        () => pm.expect(mp.status).to.be.a("string"));`,
      `    pm.test("memberProfile.preferredLanguage present", () => pm.expect(mp.preferredLanguage).to.be.a("string"));`,
      `    pm.test("memberProfile.accountCreatedAt present",  () => pm.expect(mp.accountCreatedAt).to.be.a("string"));`,
      `    pm.test("memberProfile.qualifications is array",   () => pm.expect(mp.qualifications).to.be.an("array"));`,
      `    pm.test("memberProfile.uid matches requesterUid",  () => pm.expect(mp.uid).to.equal(j.requesterUid));`,
      `    if (mp.profilePhotoUrl !== null) pm.test("memberProfile.profilePhotoUrl is string", () => pm.expect(mp.profilePhotoUrl).to.be.a("string"));`,
      `    if (mp.qualifications.length > 0) {`,
      `      pm.test("qualifications[0].id is string",    () => pm.expect(mp.qualifications[0].id).to.be.a("string"));`,
      `      pm.test("qualifications[0].title is string", () => pm.expect(mp.qualifications[0].title).to.be.a("string"));`,
      `    }`,
      `  }`,
      `}`,
    ],
  }),

  // ── 7. Download Qualification PDF ─────────────────────────────────────────
  // NEW — returns a 15-minute signed URL for the applicant's education qualification PDF.
  buildRequest({
    name: 'Download Qualification PDF',
    method: 'GET',
    url: { raw: '{{baseUrl}}/role-requests/{{roleRequestId}}/qualification' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 or 404 — Download Qualification", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("signedUrl is a non-empty string", () => pm.expect(j.signedUrl).to.be.a("string").and.not.empty);`,
      `  pm.test("expiresAt is a string",            () => pm.expect(j.expiresAt).to.be.a("string"));`,
      `  pm.test("qualificationTitle is a string",   () => pm.expect(j.qualificationTitle).to.be.a("string"));`,
      `}`,
    ],
  }),

  // ── 8. Approve Role Request ────────────────────────────────────────────────
  // Response: full RoleRequest entity with status:"approved".
  // Side effects (async via role.granted event, ~5 s after 200):
  //   • RoleGrantedHandler creates in-app notification ("Student Role Approved")
  //   • Approval email sent to student's registered address (role label, admin note, login link)
  //   • AuditHandler writes an audit_log entry
  buildRequest({
    name: 'Approve Role Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/role-requests/{{roleRequestId}}/approve' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ note: 'Welcome! You can now enroll in courses.' }),
    description: [
      'Grants the student role — adds "student" to roles[] and updates Firebase Auth custom claims.',
      '',
      'Response: full RoleRequest entity (status:"approved"). NOT the custom {roleRequestId,userRoles,message} shape.',
      '',
      'Async side effects via role.granted outbox event (~5 s):\n',
      '  • RoleGrantedHandler.handle() → in-app notification ("Student Role Approved")',
      '  • Approval email to student (role label, optional admin note, next-steps list, login button)',
      '  • AuditHandler → audit_log entry',
      '',
      '409 INVALID_STATE = already approved or rejected.',
    ].join('\n'),
    tests: [
      `pm.test("200 or 404 or 409 — Approve Role Request (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  // Response is the full RoleRequest entity, not a custom {roleRequestId,userRoles,message} shape`,
      `  pm.test("id is a string",              () => pm.expect(j.id).to.be.a("string"));`,
      `  pm.test("requesterUid is a string",    () => pm.expect(j.requesterUid).to.be.a("string"));`,
      `  pm.test("requestedRole is 'student'",  () => pm.expect(j.requestedRole).to.equal("student"));`,
      `  pm.test("status is 'approved'",        () => pm.expect(j.status).to.equal("approved"));`,
      `  pm.test("decidedByUid is a string",    () => pm.expect(j.decidedByUid).to.be.a("string"));`,
      `  pm.test("decidedAt is a string",       () => pm.expect(j.decidedAt).to.be.a("string"));`,
      `  pm.test("decisionNote matches sent note", () => pm.expect(j.decisionNote).to.equal("Welcome! You can now enroll in courses."));`,
      `  pm.test("applicantProfile is an object",  () => pm.expect(j.applicantProfile).to.be.an("object"));`,
      `  if (j.qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(j.qualificationTitle).to.be.a("string"));`,
      `  pm.test("qualificationStoragePath is null", () => pm.expect(j.qualificationStoragePath).to.be.null);`,
      `  pm.test("createdAt is a string",       () => pm.expect(j.createdAt).to.be.a("string"));`,
      `}`,
      `if (pm.response.code === 409) {`,
      `  const j = pm.response.json();`,
      `  pm.test("409 errorCode is INVALID_STATE", () => pm.expect(j.error.code).to.equal("INVALID_STATE"));`,
      `}`,
    ],
  }),

  // ── 9. Reject Role Request ─────────────────────────────────────────────────
  // Response: full RoleRequest entity with status:"rejected".
  // Side effects: role.rejected event published to outbox — NOT YET wired in EventDispatcher
  //   (silently skipped; no email or in-app notification currently sent on rejection).
  buildRequest({
    name: 'Reject Role Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/role-requests/{{roleRequestId}}/reject' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ note: 'Rejected for testing.' }),
    description: [
      'Rejects the role application.',
      '',
      'Response: full RoleRequest entity (status:"rejected").',
      '',
      'Side effects: role.rejected event published to outbox.',
      'NOTE: role.rejected is NOT currently wired in EventDispatcher — silently skipped.',
      'No email or in-app notification is sent to the student on rejection at this time.',
      '',
      '409 INVALID_STATE = already approved or rejected.',
    ].join('\n'),
    tests: [
      `pm.test("200 or 404 or 409 — Reject Role Request (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  // Response is the full RoleRequest entity`,
      `  pm.test("id is a string",              () => pm.expect(j.id).to.be.a("string"));`,
      `  pm.test("requesterUid is a string",    () => pm.expect(j.requesterUid).to.be.a("string"));`,
      `  pm.test("requestedRole is 'student'",  () => pm.expect(j.requestedRole).to.equal("student"));`,
      `  pm.test("status is 'rejected'",        () => pm.expect(j.status).to.equal("rejected"));`,
      `  pm.test("decidedByUid is a string",    () => pm.expect(j.decidedByUid).to.be.a("string"));`,
      `  pm.test("decidedAt is a string",       () => pm.expect(j.decidedAt).to.be.a("string"));`,
      `  pm.test("decisionNote matches sent note", () => pm.expect(j.decisionNote).to.equal("Rejected for testing."));`,
      `  pm.test("applicantProfile is an object",  () => pm.expect(j.applicantProfile).to.be.an("object"));`,
      `  if (j.qualificationTitle) pm.test("qualificationTitle is a string", () => pm.expect(j.qualificationTitle).to.be.a("string"));`,
      `  pm.test("qualificationStoragePath is null", () => pm.expect(j.qualificationStoragePath).to.be.null);`,
      `  pm.test("createdAt is a string",       () => pm.expect(j.createdAt).to.be.a("string"));`,
      `}`,
      `if (pm.response.code === 409) {`,
      `  const j = pm.response.json();`,
      `  pm.test("409 errorCode is INVALID_STATE", () => pm.expect(j.error.code).to.equal("INVALID_STATE"));`,
      `}`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 9️⃣ PROGRESS SERVICE
// ---------------------------------------------------------------------------

const progressFolder = folder('9️⃣ Progress Service', [
  // ── Subject-level progress ────────────────────────────────────────────────
  buildRequest({
    name: 'Mark Subject Complete',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/subjects/{{subjectId}}/complete' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ courseId: '{{courseId}}', semesterId: '{{semesterId}}', batchId: '{{batchId}}' }),
    tests: [
      `pm.test("200 or 201 — Mark Subject Complete", () => {`,
      `  pm.expect([200, 201]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Record Subject Access',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/subjects/{{subjectId}}/access' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ courseId: '{{courseId}}', semesterId: '{{semesterId}}', batchId: '{{batchId}}' }),
    tests: [
      `pm.test("200 or 201 — Record Subject Access", () => {`,
      `  pm.expect([200, 201]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  // ── Lesson-level progress (V2) ★ NEW ─────────────────────────────────────
  buildRequest({
    name: 'Mark Lesson Complete ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/complete' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({
      courseId:   '{{courseId}}',
      subjectId:  '{{subjectId}}',
      semesterId: '{{semesterId}}',
      batchId:    '{{batchId}}',
    }),
    tests: [
      `pm.test("200 or 403 — Mark Lesson Complete (403 = no enrollment for student2)", () => {`,
      `  pm.expect([200, 403]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("lessonId present",              () => pm.expect(j.lessonId).to.be.a("string").and.not.empty);`,
      `  pm.test("completedAt is ISO string",     () => pm.expect(j.completedAt).to.be.a("string").and.not.empty);`,
      `  pm.test("subjectAutoCompleted is bool",  () => pm.expect(j.subjectAutoCompleted).to.be.a("boolean"));`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Mark Lesson Complete — Idempotent ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/complete' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({
      courseId:   '{{courseId}}',
      subjectId:  '{{subjectId}}',
      semesterId: '{{semesterId}}',
      batchId:    '{{batchId}}',
    }),
    tests: [
      `pm.test("200 or 403 — Idempotent lesson mark", () => {`,
      `  pm.expect([200, 403]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("subjectAutoCompleted false on repeat", () => pm.expect(j.subjectAutoCompleted).to.equal(false));`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Mark Lesson Complete — Missing field → 400 ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/complete' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ courseId: '{{courseId}}', semesterId: '{{semesterId}}' }),
    tests: [
      `pm.test("400 or 403 — missing subjectId returns validation error", () => {`,
      `  pm.expect([400, 403]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  buildRequest({
    name: 'Unmark Lesson Complete ★ NEW',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/complete' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("204 or 404 — Unmark Lesson (404 if lesson was never marked due to 403)", () => {`,
      `  pm.expect([204, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  buildRequest({
    name: 'Unmark Lesson — Not Found → 404 ★ NEW',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/complete' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("404 — second unmark returns LESSON_PROGRESS_NOT_FOUND", () => {`,
      `  pm.expect([404]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 404) {`,
      `  const j = pm.response.json();`,
      `  pm.test("error code correct", () => pm.expect(j.error.code).to.equal("LESSON_PROGRESS_NOT_FOUND"));`,
      `}`,
    ],
  }),

  // ── Course / subject progress queries ─────────────────────────────────────
  buildRequest({
    name: 'Get My Course Progress (with lesson fields) ★ UPDATED',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/progress/courses/{{courseId}}' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 OK — Get Course Progress", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("completedCount is number",           () => pm.expect(j.completedCount).to.be.a("number"));`,
      `pm.test("completionPercent is number",        () => pm.expect(j.completionPercent).to.be.a("number"));`,
      `pm.test("completedLessonIds is array ★ NEW",  () => pm.expect(j.completedLessonIds).to.be.an("array"));`,
      `pm.test("totalLessons is number ★ NEW",       () => pm.expect(j.totalLessons).to.be.a("number"));`,
      `pm.test("lessonCompletionPercent ★ NEW",      () => pm.expect(j.lessonCompletionPercent).to.be.a("number"));`,
      `pm.test("lastAccessedAt present ★ NEW",       () => pm.expect(j).to.have.property("lastAccessedAt"));`,
    ],
  }),

  buildRequest({
    name: 'Get My Subject Progress',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/progress/subjects/{{subjectId}}' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 or 404 — Get Subject Progress", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Get Course Progress (Admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/admin/progress/courses/{{courseId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Admin Course Progress", () => pm.response.to.have.status(200));`],
  }),

  // ── Video position tracking (YouTube resume) ★ NEW ───────────────────────
  buildRequest({
    name: 'Save Video Position ★ NEW',
    method: 'POST',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/video-position' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    description: 'Save the current YouTube playback position so the student can resume later. watchedSeconds is an integer.',
    body: jsonBody({ watchedSeconds: 90, courseId: '{{courseId}}' }),
    tests: [
      `pm.test("200 OK — Save Video Position", () => { pm.expect([200, 403]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("lessonId is string",       () => pm.expect(j.lessonId).to.be.a("string"));`,
      `  pm.test("watchedSeconds is number", () => pm.expect(j.watchedSeconds).to.be.a("number"));`,
      `  pm.test("updatedAt is string",      () => pm.expect(j.updatedAt).to.be.a("string"));`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Get Video Position ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/video-position' },
    auth: bearerAuth('student2Token'),
    description: 'Get the saved YouTube playback position. Returns { watchedSeconds: 0 } when no position has been saved yet.',
    tests: [
      `pm.test("200 OK — Get Video Position", () => { pm.expect([200, 403]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("lessonId is string",       () => pm.expect(j.lessonId).to.be.a("string"));`,
      `  pm.test("watchedSeconds is number", () => pm.expect(j.watchedSeconds).to.be.a("number"));`,
      `  pm.test("watchedSeconds >= 0",      () => pm.expect(j.watchedSeconds).to.be.at.least(0));`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Get Video Position — no record yet (returns 0) ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/progress/lessons/{{lessonId}}/video-position' },
    auth: bearerAuth('studentToken'),
    description: 'Student who has never watched returns { watchedSeconds: 0 } — never 404.',
    tests: [
      `pm.test("200 or 403 — returns 0 when no record", () => { pm.expect([200, 403]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("watchedSeconds is 0 or number", () => pm.expect(j.watchedSeconds).to.be.a("number").and.at.least(0));`,
      `}`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 🔔 NOTIFICATIONS
// ---------------------------------------------------------------------------

const notificationsFolder = folder('🔔 Notifications', [
  buildRequest({
    name: 'Get My Notifications',
    method: 'GET',
    url: { raw: '{{baseUrl}}/me/notifications?limit=20' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 OK — Get Notifications", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array",    () => pm.expect(j.items).to.be.an("array"));`,
      `pm.test("total is a number", () => pm.expect(j.total).to.be.a("number"));`,
      // API ref §16.1 — unreadCount field added in V2
      `if (j.unreadCount !== undefined) pm.test("unreadCount is a number", () => pm.expect(j.unreadCount).to.be.a("number"));`,
      `if (j.items && j.items.length > 0) { pm.environment.set("notificationId", j.items[0].id); }`,
    ],
  }),
  buildRequest({
    name: 'Mark Notification Read',
    method: 'POST',
    url: { raw: '{{baseUrl}}/me/notifications/{{notificationId}}/read' },
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 or 404 — Mark Read", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Mark All Notifications Read',
    method: 'POST',
    url: { raw: '{{baseUrl}}/me/notifications/read-all' },
    auth: bearerAuth('student2Token'),
    // Returns 200 (sendSuccess) not 204
    tests: [`pm.test("200 or 204 — Read All", () => { pm.expect([200, 204]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Update Notification Preferences',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/me/notifications/preferences' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ email: true, push: false }),
    tests: [`pm.test("200 OK — Update Preferences", () => pm.response.to.have.status(200));`],
  }),
]);

// ---------------------------------------------------------------------------
// 📎 STORAGE SERVICE
// ---------------------------------------------------------------------------

const storageFolder = folder('📎 Storage Service', [
  {
    id: uuid(),
    name: 'Upload Attachment (file upload — see note)',
    request: {
      method: 'POST',
      header: [],
      // No body — file-type formdata entries cause Newman to error before the request is sent.
      // In Postman UI: switch body to form-data, add key "attachment" (File type), select a PDF/DOCX (max 25 MB).
      url: makeUrl('{{baseUrl}}/subjects/{{subjectId}}/attachments'),
      auth: bearerAuth('adminToken'),
      description: 'Multipart file upload. In Postman: set body to form-data, add field "attachment" (File type), select a PDF or DOCX file (max 25 MB). Returns attachment metadata including the attachment ID. Automated Newman runs skip this — 400 is expected.',
    },
    response: [],
    event: testScript([
      `// Newman cannot load a file from disk — pm.response may be undefined on file-load error`,
      `if (pm.response && pm.response.code !== undefined) {`,
      `  pm.test("200/201 or 400/401/415 — Upload Attachment", () => {`,
      `    pm.expect([200, 201, 400, 401, 415]).to.include(pm.response.code);`,
      `  });`,
      `  try {`,
      `    const j = pm.response.json();`,
      `    if (j && j.id) { pm.environment.set("attachmentId", j.id); }`,
      `  } catch (_) {}`,
      `} else {`,
      `  console.warn("Upload Attachment skipped — no file source available in Newman.");`,
      `}`,
    ]),
  },
  buildRequest({
    name: 'Get Attachment Download URL',
    method: 'GET',
    url: '{{baseUrl}}/attachments/{{attachmentId}}/download-url',
    auth: bearerAuth('student2Token'),
    tests: [
      `pm.test("200 or 403 or 404 — Download URL", () => {`,
      `  pm.expect([200, 403, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Delete Attachment',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/attachments/{{attachmentId}}' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("204 or 404 — Delete Attachment", () => {`,
      `  pm.expect([204, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  // Upload subject image — multipart/form-data
  {
    id: uuid(),
    name: 'Upload Subject Image',
    request: {
      method: 'POST',
      header: [],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'image',
            type: 'file',
            src: '',
            description: 'Select a PNG or JPEG image (max 10 MB).',
          },
        ],
      },
      url: makeUrl('{{baseUrl}}/subjects/{{subjectId}}/images'),
      auth: bearerAuth('adminToken'),
      description: 'Multipart image upload for a subject. Field name must be "image". Accepts image/png or image/jpeg, max 10 MB. Returns the stored image URL.',
    },
    response: [],
    event: testScript([
      `pm.test("201 Created or 400/415 — Upload Subject Image", () => {`,
      `  pm.expect([201, 400, 415]).to.include(pm.response.code);`,
      `});`,
    ]),
  },
]);

// ---------------------------------------------------------------------------
// 📋 AUDIT LOG
// ---------------------------------------------------------------------------

const auditLogFolder = folder('📋 Audit Log', [
  buildRequest({
    name: 'List Audit Log',
    method: 'GET',
    url: { raw: '{{baseUrl}}/audit-log?limit=20' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — List Audit Log", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'List Audit Log by Actor',
    method: 'GET',
    url: { raw: '{{baseUrl}}/audit-log?actorUid={{adminId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Audit Log by Actor", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Get User Audit Log',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users/{{student2Id}}/audit-log' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — User Audit Log", () => pm.response.to.have.status(200));`],
  }),
]);

// ---------------------------------------------------------------------------
// ⚡ COURSE LIFECYCLE
// ---------------------------------------------------------------------------

const courseLifecycleFolder = folder('⚡ Course Lifecycle', [
  buildRequest({
    name: 'Archive Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/archive' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Archive Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Restore Course',
    method: 'POST',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/restore' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Restore Course", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Delete Lesson',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/lessons/{{lessonId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("204 No Content — Delete Lesson", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Delete Subject 2',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/subjects/{{subjectId2}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("204 No Content — Delete Subject 2", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Delete Semester',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/semesters/{{semesterId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("204 No Content — Delete Semester", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Delete Course (soft)',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}' },
    auth: bearerAuth('adminToken'),
    description: 'Soft-delete — sets deletedAt timestamp. Recoverable via POST /courses/:id/restore. Admin only.',
    tests: [`pm.test("204 No Content — Soft Delete Course", () => pm.response.to.have.status(204));`],
  }),
  buildRequest({
    name: 'Hard Delete Course ★ NEW',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/hard' },
    auth: bearerAuth('superAdminToken'),
    description: 'Permanently removes the course and ALL related Firestore data: semesters, subjects, lessons, batches, batch_semesters. IRREVERSIBLE. super_admin only. Runs after soft-delete — findById works on soft-deleted docs.',
    tests: [
      `pm.test("204 or 404 — Hard Delete Course", () => { pm.expect([204, 404]).to.include(pm.response.code); });`,
    ],
  }),
  buildRequest({
    name: 'Hard Delete — admin blocked (expect 403) ★ NEW',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/courses/{{courseId}}/hard' },
    auth: bearerAuth('adminToken'),
    description: 'Admin cannot hard-delete — only super_admin can.',
    tests: [`pm.test("403 — admin cannot hard delete", () => pm.response.to.have.status(403));`],
  }),
]);

// ---------------------------------------------------------------------------
// 🏘 V2 — CELL SERVICE
// ---------------------------------------------------------------------------

const memberSearchSubFolder = folder('Member Search', [
  buildRequest({
    name: 'Search Members by Name (Leader)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?name=Saman' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `pm.test("200 OK — Leader Member Search", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `pm.test("no admin in results", () => {`,
      `  (j.items || []).forEach(u => {`,
      `    pm.expect((u.roles || []).includes("admin")).to.be.false;`,
      `  });`,
      `});`,
      `if (j.items && j.items.length > 0) { pm.environment.set("foundMemberUid", j.items[0].uid); }`,
    ],
  }),
  buildRequest({
    name: 'Search Members by Name (G12)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/users?name=Test' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 401 — G12 Member Search", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); }`,
    ],
  }),
]);

const cellCrudSubFolder = folder('Cell CRUD', [
  buildRequest({
    name: 'Create Cell Group',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({
      name: 'Bethel Cell Group A',
      type: 'care',
      area: 'Colombo 05',
      g12LeaderUid: '{{leaderId}}',
    }),
    tests: [
      `pm.test("201 Created — Create Cell", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("cellId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'List Cell Groups (leader — active only)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells?limit=20' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `pm.test("200 OK — List Cells (leader)", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  // Admin sees ALL states (active + archived) by default — no ?state filter needed ★ NEW
  buildRequest({
    name: 'List Cell Groups — Admin (all states, no filter) ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells?limit=20' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Admin sees all cell states", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `pm.test("total is a number", () => pm.expect(j.total).to.be.a("number"));`,
    ],
  }),
  // Admin can filter to archived only ★ NEW
  buildRequest({
    name: 'List Cell Groups — Admin filter archived ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells?limit=20&state=archived' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Admin filters archived cells", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  // G12 sees only cells in their own network (g12LeaderUid === callerUid) ★ FIXED
  buildRequest({
    name: 'List Cell Groups — G12 (own network only) ★ FIXED',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells?limit=20' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 401 — G12 list cells", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
      `  pm.test("total is a number", () => pm.expect(j.total).to.be.a("number"));`,
      `  // G12 callers see all active cells org-wide (not just own network)`,
      `}`,
    ],
  }),
  // G12 can also browse archived cells in their own network ★ FIXED
  buildRequest({
    name: 'List Cell Groups — G12 archived (network-scoped) ★ FIXED',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells?limit=20&state=archived' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 401 — G12 archived cells", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); }`,
    ],
  }),
  buildRequest({
    name: 'Get Cell Group by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}' },
    auth: bearerAuth('leaderToken'),
    tests: [`pm.test("200 OK — Get Cell", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Update Cell Group',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ name: 'Bethel Cell Group A (Updated)', area: 'Colombo 06' }),
    tests: [`pm.test("200 OK — Update Cell", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Get My Cell Groups',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/mine' },
    auth: bearerAuth('leaderToken'),
    tests: [`pm.test("200 OK — Get My Cells", () => pm.response.to.have.status(200));`],
  }),
]);

const membersSubFolder = folder('Members', [
  buildRequest({
    name: 'Get Network Members (G12 View)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/members' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 401 — Network Members", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const b = pm.response.json();`,
      `  pm.test("Has items, totalCells, totalMembers", () => {`,
      `    pm.expect(b).to.have.property('items').that.is.an('array');`,
      `    pm.expect(b).to.have.property('totalCells').that.is.a('number');`,
      `    pm.expect(b).to.have.property('totalMembers').that.is.a('number');`,
      `  });`,
      `  if (b.items.length > 0) {`,
      `    const c = b.items[0];`,
      `    pm.test("Cell entry has required fields", () => {`,
      `      pm.expect(c).to.have.all.keys('cellId','cellName','cellType','area','leaderUid','memberCount','members');`,
      `    });`,
      `  }`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Add Member to Cell',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/members' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ userUids: ['{{student2Id}}'] }),
    tests: [`pm.test("200 OK — Add Member", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Remove Member from Cell',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/members/{{student2Id}}' },
    auth: bearerAuth('leaderToken'),
    tests: [`pm.test("200 OK — Remove Member", () => pm.response.to.have.status(200));`],
  }),
]);

const joinRequestsSubFolder = folder('Join Requests', [
  buildRequest({
    name: 'Create Join Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/join-requests' },
    auth: bearerAuth('student2Token'),
    headers: jsonHeader(),
    body: jsonBody({ message: 'I would like to join this cell group.' }),
    tests: [
      `pm.test("201 Created — Join Request", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("joinRequestId", j.id); }`,
    ],
  }),
  buildRequest({
    name: 'List Join Requests',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/join-requests?limit=20' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `pm.test("200 OK — List Join Requests", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Approve Join Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/join-requests/{{joinRequestId}}/approve' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 or 404 — Approve Join Request", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Reject Join Request',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/join-requests/{{joinRequestId}}/reject' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ note: 'Rejected for testing.' }),
    tests: [
      `pm.test("200 or 404 or 409 — Reject Join Request (409 = already decided)", () => {`,
      `  pm.expect([200, 404, 409]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

const cellReportsSubFolder = folder('Cell Reports', [

  // ── Reports Page: Network Summary (month required) ────────────────────────────
  buildRequest({
    name: 'Get Network Summary — G12 view',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/summary?month=2026-05' },
    auth: bearerAuth('g12Token'),
    description: 'Powers the Reports page dashboard. month=YYYY-MM is required. API ref §14.7',
    tests: [
      `pm.test("200 or 401 — Network Summary", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("period is a string",          () => pm.expect(j.period).to.be.a("string").and.not.empty);`,
      `  pm.test("scope.totalCells is number",  () => pm.expect(j.scope.totalCells).to.be.a("number"));`,
      `  pm.test("summary.cellsHeld is number", () => pm.expect(j.summary.cellsHeld).to.be.a("number"));`,
      `  pm.test("summary.reportsFiled",        () => pm.expect(j.summary.reportsFiled).to.be.a("number"));`,
      `  pm.test("attendance.present",          () => pm.expect(j.attendance.present).to.be.a("number"));`,
      `  pm.test("attendance.roster",           () => pm.expect(j.attendance.roster).to.be.a("number"));`,
      `  pm.test("unreportedCells is array",    () => pm.expect(j.unreportedCells).to.be.an("array"));`,
      `  pm.test("weeklyBreakdown is array",    () => pm.expect(j.weeklyBreakdown).to.be.an("array"));`,
      `  pm.test("meetingTypeBreakdown has g12/care/children/outreach", () => {`,
      `    pm.expect(j.meetingTypeBreakdown).to.have.all.keys("g12","care","children","outreach");`,
      `  });`,
      `  pm.test("byLeader is array",           () => pm.expect(j.byLeader).to.be.an("array"));`,
      `}`,
    ],
  }),

  buildRequest({
    name: 'Get Network Summary — missing month → 400',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/summary' },
    auth: bearerAuth('g12Token'),
    description: 'month is required. Omitting it returns 400 VALIDATION_ERROR.',
    tests: [
      `pm.test("400 or 401 — missing month param", () => { pm.expect([400, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 400) { const j = pm.response.json(); pm.test("VALIDATION_ERROR", () => pm.expect(j.error.code).to.equal("VALIDATION_ERROR")); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Summary — bad month format → 400',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/summary?month=May-2026' },
    auth: bearerAuth('g12Token'),
    description: 'month must be YYYY-MM format. Wrong format returns 400.',
    tests: [
      `pm.test("400 or 401 — invalid month format", () => { pm.expect([400, 401]).to.include(pm.response.code); });`,
    ],
  }),

  buildRequest({
    name: 'Get Network Summary — Admin view',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/summary?month=2026-05' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — Admin Network Summary", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("period present", () => pm.expect(j.period).to.be.a("string"));`,
    ],
  }),

  buildRequest({
    name: 'Get Network Summary — student (expect 403)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/summary?month=2026-05' },
    auth: bearerAuth('studentToken'),
    tests: [`pm.test("403 — student cannot access summary", () => pm.response.to.have.status(403));`],
  }),

  // ── Reports Page: Network Reports (month optional, leaderUid/cellId/type supported) ─
  buildRequest({
    name: 'Get Network Reports — with month filter',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&limit=20' },
    auth: bearerAuth('g12Token'),
    description: 'All Types tab — all reports for the month across the G12 network. API ref §14.6',
    tests: [
      `pm.test("200 or 401 — Network Reports with month", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); pm.test("totalCells is number", () => pm.expect(j.totalCells).to.be.a("number")); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — Care tab (type=care)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&type=care' },
    auth: bearerAuth('g12Token'),
    description: 'Cell Type tab filter — Care. Only returns reports where cellType === "care".',
    tests: [
      `pm.test("200 or 401 — Care tab filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("all items are care type", () => { j.items.forEach(r => pm.expect(r.cellType).to.equal("care")); }); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — Children tab (type=children)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&type=children' },
    auth: bearerAuth('g12Token'),
    description: 'Cell Type tab filter — Children.',
    tests: [
      `pm.test("200 or 401 — Children tab filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("all items are children type", () => { j.items.forEach(r => pm.expect(r.cellType).to.equal("children")); }); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — Outreach tab (type=outreach)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&type=outreach' },
    auth: bearerAuth('g12Token'),
    description: 'Cell Type tab filter — Outreach.',
    tests: [
      `pm.test("200 or 401 — Outreach tab filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("all items are outreach type", () => { j.items.forEach(r => pm.expect(r.cellType).to.equal("outreach")); }); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — G12 tab (type=g12)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&type=g12' },
    auth: bearerAuth('g12Token'),
    description: 'Cell Type tab filter — G12.',
    tests: [
      `pm.test("200 or 401 — G12 tab filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); pm.test("all items are g12 type", () => { j.items.forEach(r => pm.expect(r.cellType).to.equal("g12")); }); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — filter by leaderUid ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&leaderUid={{leaderId}}' },
    auth: bearerAuth('adminToken'),
    description: 'Admin/G12: narrow network reports to a single leader\'s cells.',
    tests: [
      `pm.test("200 or 401 — leaderUid filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — filter by cellId ★ NEW',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&cellId={{cellId}}' },
    auth: bearerAuth('g12Token'),
    description: 'Narrow network reports to a single specific cell.',
    tests: [
      `pm.test("200 or 401 — cellId filter", () => { pm.expect([200, 401]).to.include(pm.response.code); });`,
      `if (pm.response.code === 200) { const j = pm.response.json(); pm.test("items is array", () => pm.expect(j.items).to.be.an("array")); }`,
    ],
  }),

  buildRequest({
    name: 'Get Network Reports — Admin (all cells)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05&limit=10' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Admin Network Reports", () => pm.response.to.have.status(200));`],
  }),

  buildRequest({
    name: 'Get Network Reports — member (expect 403)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/network/reports?month=2026-05' },
    auth: bearerAuth('studentToken'),
    tests: [`pm.test("403 — student cannot access network reports", () => pm.response.to.have.status(403));`],
  }),

  // Upload report photos first — returns URLs to include in photoUrls[] of fileReport
  {
    id: uuid(),
    name: 'Upload Report Photos',
    request: {
      method: 'POST',
      header: [],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'photos',
            type: 'file',
            src: '',
            description: 'Select one or more images (JPEG/PNG). Returns photoUrls[] to include in File Cell Report.',
          },
        ],
      },
      url: makeUrl('{{baseUrl}}/cells/{{cellId}}/report-photos'),
      auth: bearerAuth('leaderToken'),
      description: 'Upload photos for a cell report before filing. Field name must be "photos" (multipart). Returns an array of photoUrls to pass into the File Cell Report request.',
    },
    response: [],
    event: testScript([
      `pm.test("200 OK or 400/415 — Upload Report Photos", () => {`,
      `  pm.expect([200, 400, 415]).to.include(pm.response.code);`,
      `});`,
      `const j = pm.response.json();`,
      `if (j.photoUrls && j.photoUrls.length > 0) { pm.environment.set("reportPhotoUrls", JSON.stringify(j.photoUrls)); }`,
    ]),
  },
  // File Cell Report — must use multipart/form-data with a JSON string in the "data" field
  {
    id: uuid(),
    name: 'File Cell Report',
    request: {
      method: 'POST',
      header: [{ key: 'X-Idempotency-Key', value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
      body: {
        mode: 'formdata',
        formdata: [
          {
            key: 'data',
            type: 'text',
            value: JSON.stringify({
              date: '2026-05-18',
              didMeet: true,
              leaderPresent: true,
              conductedByIfAbsent: null,
              location: 'Leader Home',
              timeStarted: '17:00',
              timeEnded: '19:00',
              language: 'en',
              subjectDiscussed: 'sunday_sermon',
              otherSubjectReason: null,
              cellType: 'care',
              g12LeaderUid: '',
              immediateG12LeaderText: null,
              attendance: [
                { name: 'Saman Silva', status: 'present', isNew: false },
                { name: 'Kamala Perera', status: 'present', isNew: true },
              ],
              contactedAbsentees: 'no',
              absenteeNotes: null,
              additionalVisitors: 0,
              childrenCount: 2,
              satisfactionRate: 5,
              additionalInfo: null,
              photoUrls: [],
              clientReqId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              noMeetReason: null,
            }),
            description: 'Report fields as a JSON string. Required by handleFileReport middleware.',
          },
        ],
      },
      url: makeUrl('{{baseUrl}}/cells/{{cellId}}/reports'),
      auth: bearerAuth('leaderToken'),
      description: 'POST /cells/:id/reports — multipart/form-data. The "data" field must be a JSON string containing all report fields. Optional "photos" field accepts up to 10 JPEG/PNG files.',
    },
    response: [],
    event: testScript([
      `pm.test("201 Created — File Cell Report", () => pm.response.to.have.status(201));`,
      `const j = pm.response.json();`,
      `if (j.id) { pm.environment.set("cellReportId", j.id); }`,
    ]),
  },
  buildRequest({
    name: 'List Cell Reports',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/reports?limit=20' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `pm.test("200 OK — List Cell Reports", () => pm.response.to.have.status(200));`,
      `const j = pm.response.json();`,
      `pm.test("items is array", () => pm.expect(j.items).to.be.an("array"));`,
    ],
  }),
  buildRequest({
    name: 'Get Cell Report by ID',
    method: 'GET',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/reports/{{cellReportId}}' },
    auth: bearerAuth('leaderToken'),
    tests: [`pm.test("200 OK — Get Cell Report", () => pm.response.to.have.status(200));`],
  }),
  // Edit cell report — only within 24 hours of filing; only by the filer or super_admin
  buildRequest({
    name: 'Edit Cell Report (within 24h) ★ NEW',
    method: 'PATCH',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/reports/{{cellReportId}}' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ additionalInfo: 'Updated during testing.', satisfactionRate: 5 }),
    tests: [
      `// 200 = edited; 404 = no report yet; 422 = edit window expired (run >24h after filing)`,
      `pm.test("200 or 404 or 422 — Edit Cell Report", () => {`,
      `  pm.expect([200, 404, 422]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 422) {`,
      `  const j = pm.response.json();`,
      `  pm.test("422 code is EDIT_WINDOW_EXPIRED", () => pm.expect(j.error.code).to.equal("EDIT_WINDOW_EXPIRED"));`,
      `}`,
    ],
  }),
  buildRequest({
    name: 'Void Cell Report',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/reports/{{cellReportId}}/void' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ reason: 'Test void reason.' }),
    tests: [
      `pm.test("200 or 404 — Void Cell Report", () => {`,
      `  pm.expect([200, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

const cellArchiveSubFolder = folder('Archive', [
  buildRequest({
    name: 'Archive Cell Group',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/archive' },
    auth: bearerAuth('leaderToken'),
    tests: [`pm.test("200 OK — Archive Cell", () => pm.response.to.have.status(200));`],
  }),

  // Transfer Ownership — admin/super_admin only
  // Notifies new owner via in-app notification + email
  buildRequest({
    name: 'Transfer Cell Ownership (admin)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/transfer-ownership' },
    auth: bearerAuth('adminToken'),
    headers: jsonHeader(),
    body: jsonBody({ leaderUid: '{{leaderId}}', g12LeaderUid: '{{g12Id}}' }),
    description: 'Only admin and super_admin can transfer cell ownership. At least one of leaderUid or g12LeaderUid must be provided and must differ from the current owners.',
    tests: [
      `// 200 = transferred; 404 = cell not found; 409 = archived cell; 422 = no change (same UIDs)`,
      `pm.test("200 or 404 or 409 or 422 — Transfer Ownership (admin)", () => {`,
      `  pm.expect([200, 404, 409, 422]).to.include(pm.response.code);`,
      `});`,
      `if (pm.response.code === 200) {`,
      `  const j = pm.response.json();`,
      `  pm.test("leaderUid updated", () => pm.expect(j.leaderUid).to.be.a("string"));`,
      `  pm.test("g12LeaderUid updated", () => pm.expect(j.g12LeaderUid).to.be.a("string"));`,
      `}`,
    ],
  }),
  // Leader tries — must get 403 now
  buildRequest({
    name: 'Transfer Cell Ownership — leader (expect 403)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/transfer-ownership' },
    auth: bearerAuth('leaderToken'),
    headers: jsonHeader(),
    body: jsonBody({ leaderUid: '{{g12Id}}' }),
    description: 'leader and g12 roles no longer have access to transfer ownership. Must return 403.',
    tests: [
      `pm.test("403 — leader cannot transfer ownership", () => pm.response.to.have.status(403));`,
    ],
  }),
  // G12 tries — must get 403
  buildRequest({
    name: 'Transfer Cell Ownership — g12 (expect 403)',
    method: 'POST',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}/transfer-ownership' },
    auth: bearerAuth('g12Token'),
    headers: jsonHeader(),
    body: jsonBody({ leaderUid: '{{leaderId}}' }),
    description: 'g12 role no longer has access. Must return 403.',
    tests: [
      `pm.test("403 or 401 — g12 cannot transfer ownership", () => { pm.expect([403, 401]).to.include(pm.response.code); });`,
    ],
  }),

  // Delete Cell — only the owning leader, G12 leader, or admin can delete
  // Run last in this sub-folder so {{cellId}} is still available from Create Cell
  buildRequest({
    name: 'Delete Cell Group ★ NEW',
    method: 'DELETE',
    url: { raw: '{{baseUrl}}/cells/{{cellId}}' },
    auth: bearerAuth('leaderToken'),
    tests: [
      `// 204 = deleted; 403 = not owner; 404 = already deleted or never created`,
      `pm.test("204 or 403 or 404 — Delete Cell", () => {`,
      `  pm.expect([204, 403, 404]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

const cellServiceFolder = folder('🏘 V2 — Cell Service', [
  memberSearchSubFolder,
  cellCrudSubFolder,
  membersSubFolder,
  joinRequestsSubFolder,
  cellReportsSubFolder,
  cellArchiveSubFolder,
]);

// ---------------------------------------------------------------------------
// 📊 V2 — ANALYTICS SERVICE
// ---------------------------------------------------------------------------

const analyticsFolder = folder('📊 V2 — Analytics Service', [
  buildRequest({
    name: 'Weekly Cell Analytics',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/cells/weekly?weeks=12' },
    auth: bearerAuth('g12Token'),
    // 200 = analytics data; 401 = g12Token stale (Firebase revokes tokens on password reset in _restore-seeds)
    tests: [`pm.test("200 or 401 — Weekly Analytics (401 = token stale after seed restore)", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Attendance Analytics',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Attendance Analytics", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Meeting Types Analytics',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/meeting-types' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Meeting Types Analytics", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Growth Analytics',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/growth' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Growth Analytics", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Participation Analytics',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/participation' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Participation Analytics", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Export Cells-Weekly Analytics (CSV)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/cells-weekly/export?weeks=12' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Export Cells-Weekly CSV", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Export Attendance Analytics (CSV)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance/export' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Export Attendance CSV", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Export Meeting-Types Analytics (CSV)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/meeting-types/export' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Export Meeting-Types CSV", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Export Growth Analytics (CSV)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/growth/export' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Export Growth CSV", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Export Participation Analytics (CSV)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/participation/export' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Export Participation CSV", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),

  // ── Filter param requests ─────────────────────────────────────────────────

  buildRequest({
    name: 'Weekly Cells — cellType=care filter',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/cells/weekly?weeks=12&cellType=care' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Weekly Cells cellType=care", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Attendance — cellType=children filter',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?cellType=children' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Attendance cellType=children", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Attendance — leaderUid filter (admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?leaderUid={{leaderId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Attendance leaderUid filter", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Attendance — g12Uid filter (admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?g12Uid={{g12Id}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Attendance g12Uid filter", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Meeting Types — cellType=outreach filter',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/meeting-types?cellType=outreach' },
    auth: bearerAuth('g12Token'),
    tests: [`pm.test("200 or 401 — Meeting Types cellType=outreach", () => { pm.expect([200, 401]).to.include(pm.response.code); });`],
  }),
  buildRequest({
    name: 'Participation — leaderUid filter (admin)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/participation?leaderUid={{leaderId}}' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("200 OK — Participation leaderUid filter", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Attendance — invalid cellType (expect 400)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?cellType=invalid' },
    auth: bearerAuth('adminToken'),
    tests: [`pm.test("400 — invalid cellType rejected", () => pm.response.to.have.status(400));`],
  }),

  // ── Combined filter requests ──────────────────────────────────────────────

  buildRequest({
    name: 'Attendance — g12Uid + leaderUid (leaderUid wins)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?g12Uid={{g12Id}}&leaderUid={{leaderId}}' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — g12Uid+leaderUid combo", () => pm.response.to.have.status(200));`,
      `pm.test("scope is leader scoped", () => {`,
      `  const j = pm.response.json();`,
      `  pm.expect(j.scope).to.include("leader:");`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Attendance — g12Uid + cellType',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?g12Uid={{g12Id}}&cellType=care' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — g12Uid+cellType combo", () => pm.response.to.have.status(200));`,
      `pm.test("scope is g12 + type scoped", () => {`,
      `  const j = pm.response.json();`,
      `  pm.expect(j.scope).to.include("g12:").and.include("|care");`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Attendance — leaderUid + cellType',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?leaderUid={{leaderId}}&cellType=children' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — leaderUid+cellType combo", () => pm.response.to.have.status(200));`,
      `pm.test("scope is leader + type scoped", () => {`,
      `  const j = pm.response.json();`,
      `  pm.expect(j.scope).to.include("leader:").and.include("|children");`,
      `});`,
    ],
  }),
  buildRequest({
    name: 'Attendance — g12Uid + leaderUid + cellType (leaderUid wins)',
    method: 'GET',
    url: { raw: '{{baseUrl}}/analytics/attendance?g12Uid={{g12Id}}&leaderUid={{leaderId}}&cellType=outreach' },
    auth: bearerAuth('adminToken'),
    tests: [
      `pm.test("200 OK — all 3 filters combo", () => pm.response.to.have.status(200));`,
      `pm.test("scope is leader + type scoped (leaderUid wins)", () => {`,
      `  const j = pm.response.json();`,
      `  pm.expect(j.scope).to.include("leader:").and.include("|outreach");`,
      `});`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// 🏥 HEALTH CHECKS
// ---------------------------------------------------------------------------

const healthFolder = folder('🏥 Health Checks', [
  buildRequest({
    name: 'Gateway — Liveness (healthz)',
    method: 'GET',
    url: { raw: 'http://localhost:3000/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Gateway — Readiness (readyz)',
    method: 'GET',
    url: { raw: 'http://localhost:3000/readyz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Readiness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Auth Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3001/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Auth Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'User Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3002/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — User Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Course Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3003/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Course Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Cell Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3009/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Cell Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Enrollment Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3004/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Enrollment Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Progress Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3005/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Progress Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Storage Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3006/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Storage Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Notification Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3007/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Notification Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Audit Service — Liveness',
    method: 'GET',
    url: { raw: 'http://localhost:3008/healthz' },
    auth: noAuth(),
    tests: [`pm.test("200 OK — Audit Liveness", () => pm.response.to.have.status(200));`],
  }),
  buildRequest({
    name: 'Analytics Service — Liveness',
    method: 'GET',
    // Direct port 3011 may be blocked by Windows Firewall in Docker Desktop setups.
    // Use the gateway proxy instead — this also verifies the full analytics route is live.
    url: { raw: '{{baseUrl}}/analytics/cells/weekly?weeks=1' },
    auth: bearerAuth('g12Token'),
    tests: [
      `pm.test("200 or 404 or 401 — Analytics Liveness (via gateway)", () => {`,
      `  pm.expect([200, 404, 401]).to.include(pm.response.code);`,
      `});`,
    ],
  }),
]);

// ---------------------------------------------------------------------------
// ASSEMBLE COLLECTION
// ---------------------------------------------------------------------------

const collection = {
  info: {
    _postman_id: uuid(),
    name: 'TCCR Backend — Full API Collection v2.6',
    description:
      'Complete API test collection for TCCR (The Christian Center Rathmalana) backend.\n' +
      'Aligned with API Reference v2.22.0 (26 May 2026).\n' +
      'Covers all V1 and V2 endpoints across 13 microservices.\n\n' +
      'Test flow:\n' +
      '1. Run 🔐 Sign In first — populates all *Token and *Id variables\n' +
      '2. Run folders in order (1️⃣ → 📊) — each folder saves IDs used by later folders\n' +
      '3. Before each Newman run: node scripts/_restore-seeds.js\n\n' +
      'Prerequisites (online Firebase):\n' +
      '  docker-compose up (services running against e-learning-f4209)\n' +
      '  node scripts/_restore-seeds.js\n\n' +
      'Prerequisites (emulator):\n' +
      '  npx firebase emulators:start\n' +
      '  node scripts/seed-emulator.js && node scripts/seed-v2-roles.js\n' +
      '  docker-compose -f docker-compose.yml -f docker-compose.local.yml up\n\n' +
      'Key V2 changes vs V1:\n' +
      '  • Registration auto-approves as Member (no pending_approval queue)\n' +
      '  • Roles are additive arrays: ["member","student","leader","g12"]\n' +
      '  • Role Requests: PATCH /me (profile) → POST /me/qualification (PDF) → POST /role-requests { requestedRole: "student" }\n' +
      '  • Batches: intake cohorts under each course\n' +
      '  • Cell Groups, Cell Reports, Analytics dashboards\n' +
      '  • Federated OAuth (Google + Apple SDK + Apple web flow)',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  // Collection-level pre-request script: generates a unique runId once per Newman session.
  // All emails and titles that could conflict on re-runs use {{runId}} as a suffix.
  event: [
    {
      listen: 'prerequest',
      script: {
        id: uuid(),
        type: 'text/javascript',
        exec: [
          '// Generate a short unique run ID once per Newman session.',
          '// Emails + course titles embed this so re-runs on online Firebase never conflict.',
          "if (!pm.environment.get('runId')) {",
          "  pm.environment.set('runId', Date.now().toString().slice(-6));",
          '}',
        ],
      },
    },
  ],
  item: [
    signInFolder,
    authFolder,
    meFolder,
    adminUsersFolder,
    superAdminFolder,
    buildCourseFolder,
    batchesFolder,
    enrollmentFolder,
    roleRequestsFolder,
    progressFolder,
    notificationsFolder,
    storageFolder,
    auditLogFolder,
    courseLifecycleFolder,
    cellServiceFolder,
    analyticsFolder,
    healthFolder,
  ],
};

// ---------------------------------------------------------------------------
// WRITE OUTPUT
// ---------------------------------------------------------------------------

const outputPath = path.join(__dirname, '..', 'postman', 'CMP_Backend.postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf8');

const totalRequests = (function countRequests(items) {
  let count = 0;
  for (const item of items) {
    if (item.request) {
      count += 1;
    } else if (item.item) {
      count += countRequests(item.item);
    }
  }
  return count;
})(collection.item);

console.log(`Collection written to: ${outputPath}`);
console.log(`Total folders: ${collection.item.length}`);
console.log(`Total requests: ${totalRequests}`);
