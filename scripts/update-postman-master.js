#!/usr/bin/env node
'use strict';
const fs = require('fs');

let raw = fs.readFileSync('postman/CMP_Backend.postman_collection.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const col = JSON.parse(raw);

// ── 1. Master Sign In → add to Sign In folder ─────────────────────────────
const signInFolder = col.item.find(f => f.name.includes('Sign In'));

signInFolder.item.push({
  id: 'a1b2c3d4-0001-4000-8000-mastersignin0',
  name: 'Master Sign In',
  request: {
    method: 'POST',
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: {
      mode: 'raw',
      raw: '{\n  "email": "superadmin@cmp.com",\n  "password": "SuperAdmin@123",\n  "returnSecureToken": true\n}',
      options: { raw: { language: 'json' } },
    },
    url: {
      raw: '{{authBaseUrl}}/accounts:signInWithPassword?key={{firebaseWebApiKey}}',
      host: ['{{authBaseUrl}}'],
      path: ['accounts:signInWithPassword'],
      query: [{ key: 'key', value: '{{firebaseWebApiKey}}' }],
    },
    auth: { type: 'noauth' },
  },
  response: [],
  event: [{
    listen: 'test',
    script: {
      id: 'a1b2c3d4-0001-test-mastersi01',
      type: 'text/javascript',
      exec: [
        '// Run AFTER "Assign Master Role" so the token carries master claims.',
        'pm.test("200 OK - Master Sign In", () => pm.response.to.have.status(200));',
        'const j = pm.response.json();',
        'pm.test("TOKEN received", () => {',
        '  pm.expect(j.idToken).to.be.a("string").and.not.empty;',
        '  if (j.idToken) {',
        '    pm.environment.set("masterToken", j.idToken);',
        '    pm.environment.set("masterId", j.localId);',
        '  }',
        '});',
      ],
    },
  }],
});

// ── 2. Master Role folder ─────────────────────────────────────────────────
const masterFolder = {
  id: 'a1b2c3d4-0002-4000-8000-masterfolder',
  name: '🎖️ Master Role (V2)',
  item: [
    {
      id: 'a1b2c3d4-0003-4000-8000-assignmaster',
      name: 'Assign Master Role to Super Admin (super_admin caller)',
      request: {
        method: 'PATCH',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "role": "master",\n  "action": "add"\n}',
          options: { raw: { language: 'json' } },
        },
        url: {
          raw: '{{baseUrl}}/users/{{superAdminId}}/roles',
          host: ['{{baseUrl}}'],
          path: ['users', '{{superAdminId}}', 'roles'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{superAdminToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0003-test-assign000',
          type: 'text/javascript',
          exec: [
            'pm.test("200 OK - master role assigned", () => pm.response.to.have.status(200));',
            '// After this, re-run Master Sign In to get a fresh token with master claims.',
          ],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0004-4000-8000-masterlistad',
      name: 'Master - List Admins (super_admin-only endpoint)',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/super-admin/admins',
          host: ['{{baseUrl}}'],
          path: ['super-admin', 'admins'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0004-test-listadmin',
          type: 'text/javascript',
          exec: ['pm.test("200 OK - master accesses super_admin-only endpoint", () => pm.response.to.have.status(200));'],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0005-4000-8000-mastercreate',
      name: 'Master - Create Admin',
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "firstName": "Master",\n  "lastName": "Created",\n  "email": "masteradmin{{runId}}@tccr.lk",\n  "initialPassword": "Admin@Tccr2026",\n  "preferredLanguage": "en"\n}',
          options: { raw: { language: 'json' } },
        },
        url: {
          raw: '{{baseUrl}}/super-admin/admins',
          host: ['{{baseUrl}}'],
          path: ['super-admin', 'admins'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0005-test-crtadmin0',
          type: 'text/javascript',
          exec: [
            'pm.test("201 Created - master can create admin", () => pm.response.to.have.status(201));',
            'const j = pm.response.json();',
            'if (j.uid) pm.environment.set("masterCreatedAdminId", j.uid);',
          ],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0006-4000-8000-masterhardel',
      name: 'Master - Hard Delete Course (super_admin-only endpoint)',
      request: {
        method: 'DELETE',
        header: [],
        url: {
          raw: '{{baseUrl}}/courses/{{courseId}}/hard',
          host: ['{{baseUrl}}'],
          path: ['courses', '{{courseId}}', 'hard'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0006-test-harddel00',
          type: 'text/javascript',
          exec: ['pm.test("204 No Content - master can hard-delete course", () => pm.response.to.have.status(204));'],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0007-4000-8000-mastermkadmn',
      name: 'Master - Make User Admin',
      request: {
        method: 'POST',
        header: [],
        url: {
          raw: '{{baseUrl}}/super-admin/users/{{registeredUid}}/make-admin',
          host: ['{{baseUrl}}'],
          path: ['super-admin', 'users', '{{registeredUid}}', 'make-admin'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0007-test-makeadmin',
          type: 'text/javascript',
          exec: ['pm.test("200 OK - master can make-admin", () => pm.response.to.have.status(200));'],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0008-4000-8000-masterdelcad',
      name: 'Master - Delete Created Admin',
      request: {
        method: 'DELETE',
        header: [],
        url: {
          raw: '{{baseUrl}}/super-admin/admins/{{masterCreatedAdminId}}',
          host: ['{{baseUrl}}'],
          path: ['super-admin', 'admins', '{{masterCreatedAdminId}}'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0008-test-delcadmin',
          type: 'text/javascript',
          exec: ['pm.test("204 No Content - master can delete admin", () => pm.response.to.have.status(204));'],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0009-4000-8000-removemaster',
      name: 'Remove Master Role from Super Admin (super_admin caller)',
      request: {
        method: 'PATCH',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: '{\n  "role": "master",\n  "action": "remove"\n}',
          options: { raw: { language: 'json' } },
        },
        url: {
          raw: '{{baseUrl}}/users/{{superAdminId}}/roles',
          host: ['{{baseUrl}}'],
          path: ['users', '{{superAdminId}}', 'roles'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{superAdminToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0009-test-rmvmaster',
          type: 'text/javascript',
          exec: ['pm.test("200 OK - super_admin can remove master role", () => pm.response.to.have.status(200));'],
        },
      }],
    },
    {
      id: 'a1b2c3d4-0010-4000-8000-nonmaster403',
      name: 'Non-master tries List Admins (expect 403)',
      request: {
        method: 'GET',
        header: [],
        url: {
          raw: '{{baseUrl}}/super-admin/admins',
          host: ['{{baseUrl}}'],
          path: ['super-admin', 'admins'],
        },
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{studentToken}}', type: 'string' }] },
      },
      response: [],
      event: [{
        listen: 'test',
        script: {
          id: 'a1b2c3d4-0010-test-403block0',
          type: 'text/javascript',
          exec: ['pm.test("403 Forbidden - non-master blocked from super_admin endpoint", () => pm.response.to.have.status(403));'],
        },
      }],
    },
  ],
};

// Insert before Health Checks
const healthIdx = col.item.findIndex(f => f.name.includes('Health'));
col.item.splice(healthIdx, 0, masterFolder);

fs.writeFileSync('postman/CMP_Backend.postman_collection.json', JSON.stringify(col, null, 2));
console.log('Done. Folders now:', col.item.map(f => f.name).join(', '));
