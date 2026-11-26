const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /placeholder|replace|change.?me/i.test(process.env.JWT_SECRET)) {
  process.env.JWT_SECRET = randomBytes(48).toString('base64url');
}
process.env.JWT_EXPIRES_IN = '1h';
process.env.RATE_LIMIT_MAX = '100';

const app = require('../src/app');
const pool = require('../src/config/database');

let server;
let baseUrl;
let testUserId;

before(async () => {
  const [roles] = await pool.execute('SELECT COUNT(*) AS count FROM roles');
  assert.ok(Number(roles[0].count) >= 4, 'Run npm run db:setup before authentication tests.');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (testUserId) {
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function request(route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

test('Stage 3 authentication, account management, and RBAC integration', async (t) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `stage3.${suffix}@example.test`;
  const phone = `+2567${String(randomBytes(4).readUInt32BE(0) % 100000000).padStart(8, '0')}`;
  const duplicatePhone = `+2567${String(randomBytes(4).readUInt32BE(0) % 100000000).padStart(8, '0')}`;
  const password = 'StageThree!Password27';
  const changedPassword = 'ChangedStageThree!Password28';

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.demo@epithyia.local', password: 'EpithyiaAdminDemo!2026' },
  });
  assert.equal(adminLogin.status, 200, 'seeded demonstration ADMIN must be able to log in');
  const adminToken = adminLogin.payload.data.token;
  const adminId = adminLogin.payload.data.user.id;
  assert.equal(adminLogin.payload.data.user.role, 'ADMIN');
  assert.ok(!JSON.stringify(adminLogin.payload).includes('password_hash'));

  await t.test('registration validates inputs and assigns only USER', async () => {
    let result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email, phone, password } });
    assert.equal(result.status, 201);
    assert.equal(result.payload.data.user.role, 'USER');
    assert.equal(result.payload.data.user.phone, phone);
    assert.ok(!JSON.stringify(result.payload).includes('password_hash'));
    testUserId = result.payload.data.user.id;

    result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email, phone: duplicatePhone, password } });
    assert.equal(result.status, 409);
    result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email: `other.${suffix}@example.test`, phone, password } });
    assert.equal(result.status, 409);
    result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email: 'bad-email', phone: duplicatePhone, password } });
    assert.equal(result.status, 400);
    result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email: `weak.${suffix}@example.test`, phone: duplicatePhone, password: 'weak' } });
    assert.equal(result.status, 400);
    result = await request('/api/auth/register', { method: 'POST', body: { name: 'Member', email: `role.${suffix}@example.test`, phone: duplicatePhone, password, role: 'ADMIN' } });
    assert.equal(result.status, 400);
    result = await request('/api/auth/register', { method: 'POST', body: { email: `missing.${suffix}@example.test` } });
    assert.equal(result.status, 400);
  });

  const userLogin = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(userLogin.status, 200);
  const userToken = userLogin.payload.data.token;

  await t.test('login and token validation work; errors have correct status', async () => {
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email, password: 'Wrong!Password888' } })).status, 401);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: `unknown.${suffix}@example.test`, password } })).status, 401);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'bad', password } })).status, 400);
    assert.equal((await request('/api/auth/me')).status, 401);
    assert.equal((await request('/api/auth/me', { token: 'not-a-jwt' })).status, 401);
    const expiredToken = jwt.sign({ sub: String(testUserId) }, process.env.JWT_SECRET, {
      expiresIn: '-1s',
      issuer: 'epithyia-health-api',
      audience: 'epithyia-health-client',
    });
    assert.equal((await request('/api/auth/me', { token: expiredToken })).status, 401);
    const me = await request('/api/auth/me', { token: userToken });
    assert.equal(me.status, 200);
    assert.equal(me.payload.data.user.role, 'USER');
    assert.equal(me.payload.data.user.status, 'ACTIVE');
    assert.ok(!JSON.stringify(me.payload).includes('password_hash'));
  });

  await t.test('profile updates cannot alter privilege or credentials', async () => {
    const profile = await request('/api/users/me', { method: 'PUT', token: userToken, body: { name: 'Updated Demo Member', phone: '0700123456' } });
    assert.equal(profile.status, 200);
    assert.equal(profile.payload.data.user.phone, '+256700123456');
    assert.equal((await request('/api/users/me', { method: 'PUT', token: userToken, body: { role: 'ADMIN' } })).status, 400);
    assert.equal((await request('/api/users/me', { method: 'PUT', token: userToken, body: { password_hash: 'plaintext' } })).status, 400);
  });

  await t.test('only ADMIN can use user-management endpoints', async () => {
    let result = await request('/api/users', { token: userToken });
    assert.equal(result.status, 403);
    result = await request('/api/users', { token: adminToken });
    assert.equal(result.status, 200);
    assert.ok(result.payload.data.users.some((user) => user.id === testUserId));
    assert.ok(!JSON.stringify(result.payload).includes('password_hash'));
    assert.equal((await request(`/api/users/${testUserId}`, { token: userToken })).status, 403);
    assert.equal((await request(`/api/users/${testUserId}/role`, { method: 'PATCH', token: userToken, body: { role: 'ADMIN' } })).status, 403);

    const expected = { ADMIN: 200, CONTENT_MANAGER: 403, HEALTH_WORKER: 403, USER: 403 };
    for (const [role, expectedStatus] of Object.entries(expected)) {
      const changed = await request(`/api/users/${testUserId}/role`, { method: 'PATCH', token: adminToken, body: { role } });
      assert.equal(changed.status, 200, `ADMIN should set ${role}`);
      const access = await request('/api/users', { token: userToken });
      assert.equal(access.status, expectedStatus, `role ${role} should receive correct access`);
      const current = await request('/api/auth/me', { token: userToken });
      assert.equal(current.payload.data.user.role, role, 'middleware must use current DB role rather than stale JWT claims');
    }
    await request(`/api/users/${testUserId}/role`, { method: 'PATCH', token: adminToken, body: { role: 'USER' } });

    assert.equal((await request(`/api/users/${adminId}/role`, { method: 'PATCH', token: adminToken, body: { role: 'USER' } })).status, 409);
    assert.equal((await request(`/api/users/${adminId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'INACTIVE' } })).status, 409);
    assert.equal((await request(`/api/users/${adminId}`, { method: 'DELETE', token: adminToken })).status, 409);
    assert.equal((await request(`/api/users/${testUserId}/role`, { method: 'PATCH', token: adminToken, body: { role: 'SUPERUSER' } })).status, 400);
    assert.equal((await request(`/api/users/${testUserId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'SUSPENDED' } })).status, 400);
  });

  await t.test('admin status changes immediately revoke protected access', async () => {
    const inactive = await request(`/api/users/${testUserId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'INACTIVE' } });
    assert.equal(inactive.status, 200);
    assert.equal((await request('/api/auth/me', { token: userToken })).status, 403);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email, password } })).status, 403);
    assert.equal((await request(`/api/users/${testUserId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } })).status, 200);
  });

  await t.test('password changes hash new password and logout is honestly stateless', async () => {
    let result = await request('/api/auth/change-password', {
      method: 'PUT', token: userToken, body: { currentPassword: password, newPassword: changedPassword },
    });
    assert.equal(result.status, 200);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email, password } })).status, 401);
    const changedLogin = await request('/api/auth/login', { method: 'POST', body: { email, password: changedPassword } });
    assert.equal(changedLogin.status, 200);
    result = await request('/api/auth/logout', { method: 'POST', token: changedLogin.payload.data.token });
    assert.equal(result.status, 200);
    assert.match(result.payload.data.message, /Remove the Bearer token/);
    assert.equal((await request('/api/auth/me', { token: changedLogin.payload.data.token })).status, 200);
  });

  await t.test('delete deactivates user; audit events are recorded', async () => {
    const result = await request(`/api/users/${testUserId}`, { method: 'DELETE', token: adminToken });
    assert.equal(result.status, 200);
    assert.equal(result.payload.data.user.status, 'INACTIVE');
    assert.equal((await request('/api/auth/me', { token: userToken })).status, 403);
    const [auditRows] = await pool.execute(
      'SELECT action FROM audit_logs WHERE user_id = ? AND action IN (?, ?, ?) ',
      [testUserId, 'REGISTER', 'LOGIN_SUCCESS', 'PASSWORD_CHANGED'],
    );
    const actions = new Set(auditRows.map((row) => row.action));
    assert.ok(actions.has('REGISTER'));
    assert.ok(actions.has('LOGIN_SUCCESS'));
    assert.ok(actions.has('PASSWORD_CHANGED'));
  });
});