#!/usr/bin/env node
'use strict';
const fs = require('fs');

let raw = fs.readFileSync('postman/CMP_Backend.postman_collection.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const col = JSON.parse(raw);

const masterFolder = col.item.find(f => f.name.includes('Master Role'));
if (!masterFolder) { console.error('Master Role folder not found'); process.exit(1); }

const newRequests = [
  {
    id: 'b2c3d4e5-0001-4000-8000-masterlistus',
    name: 'Master - List All Master Users',
    request: {
      method: 'GET',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/users',
        host: ['{{baseUrl}}'],
        path: ['master', 'users'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0001-test',
        type: 'text/javascript',
        exec: [
          'pm.test("200 OK - list master users", () => pm.response.to.have.status(200));',
          'const j = pm.response.json();',
          'pm.test("has items array", () => pm.expect(j.items).to.be.an("array"));',
        ],
      },
    }],
  },
  {
    id: 'b2c3d4e5-0002-4000-8000-mastergrantu',
    name: 'Master - Grant Master Role to User',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/grant/{{registeredUid}}',
        host: ['{{baseUrl}}'],
        path: ['master', 'grant', '{{registeredUid}}'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0002-test',
        type: 'text/javascript',
        exec: ['pm.test("200 OK - master role granted", () => pm.response.to.have.status(200));'],
      },
    }],
  },
  {
    id: 'b2c3d4e5-0003-4000-8000-masterrevoke',
    name: 'Master - Revoke Master Role from User',
    request: {
      method: 'DELETE',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/revoke/{{registeredUid}}',
        host: ['{{baseUrl}}'],
        path: ['master', 'revoke', '{{registeredUid}}'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{masterToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0003-test',
        type: 'text/javascript',
        exec: ['pm.test("200 OK - master role revoked", () => pm.response.to.have.status(200));'],
      },
    }],
  },
  {
    id: 'b2c3d4e5-0004-4000-8000-supagrantmst',
    name: 'Super Admin - Grant Master Role to User',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/grant/{{registeredUid}}',
        host: ['{{baseUrl}}'],
        path: ['master', 'grant', '{{registeredUid}}'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{superAdminToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0004-test',
        type: 'text/javascript',
        exec: ['pm.test("200 OK - super_admin can grant master", () => pm.response.to.have.status(200));'],
      },
    }],
  },
  {
    id: 'b2c3d4e5-0005-4000-8000-suparevkmst0',
    name: 'Super Admin - Revoke Master Role from User',
    request: {
      method: 'DELETE',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/revoke/{{registeredUid}}',
        host: ['{{baseUrl}}'],
        path: ['master', 'revoke', '{{registeredUid}}'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{superAdminToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0005-test',
        type: 'text/javascript',
        exec: ['pm.test("200 OK - super_admin can revoke master", () => pm.response.to.have.status(200));'],
      },
    }],
  },
  {
    id: 'b2c3d4e5-0006-4000-8000-admin403mast',
    name: 'Admin tries Grant Master (expect 403)',
    request: {
      method: 'POST',
      header: [],
      url: {
        raw: '{{baseUrl}}/master/grant/{{registeredUid}}',
        host: ['{{baseUrl}}'],
        path: ['master', 'grant', '{{registeredUid}}'],
      },
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }] },
    },
    response: [],
    event: [{
      listen: 'test',
      script: {
        id: 'b2c3d4e5-0006-test',
        type: 'text/javascript',
        exec: ['pm.test("403 Forbidden - admin cannot grant master", () => pm.response.to.have.status(403));'],
      },
    }],
  },
];

masterFolder.item.push(...newRequests);

fs.writeFileSync('postman/CMP_Backend.postman_collection.json', JSON.stringify(col, null, 2));
console.log('Added', newRequests.length, 'master API requests to collection');
