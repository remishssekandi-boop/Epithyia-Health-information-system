const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');

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
let categoryId;
let articleId;

before(async () => {
  const [tables] = await pool.execute(
    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
    [process.env.DB_NAME || 'epithyia_health', 'health_categories', 'health_articles'],
  );
  assert.equal(Number(tables[0].total), 2, 'Run npm run db:setup before health-content tests.');
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (articleId) await pool.execute('DELETE FROM health_articles WHERE id = ?', [articleId]);
  if (categoryId) await pool.execute('DELETE FROM health_categories WHERE id = ?', [categoryId]);
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
  return { status: response.status, payload: await response.json() };
}

async function login(email, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, `seed account ${email} must log in`);
  return result.payload.data.token;
}

test('Stage 4 health-category and article API integration', async (t) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const adminToken = await login('admin.demo@epithyia.local', 'EpithyiaAdminDemo!2026');
  const managerToken = await login('content.demo@epithyia.local', 'EpithyiaContentDemo!2026');
  const workerToken = await login('worker.demo@epithyia.local', 'EpithyiaWorkerDemo!2026');
  const userToken = await login('user.demo@epithyia.local', 'EpithyiaUserDemo!2026');
  const categoryName = `Stage 4 Test ${suffix}`;
  const articleTitle = `Stage 4 searchable sample ${suffix}`;

  await t.test('public category reads and protected category management', async () => {
    const listed = await request('/api/health/categories');
    assert.equal(listed.status, 200);
    assert.ok(listed.payload.data.categories.length >= 9);
    assert.ok(listed.payload.data.categories.every((category) => category.status === 'ACTIVE'));
    assert.equal((await request('/api/health/categories?includeInactive=true')).status, 403);
    assert.equal((await request('/api/health/categories', { method: 'POST', body: { name: categoryName, description: 'Stage 4 temporary test category.' } })).status, 401);
    assert.equal((await request('/api/health/categories', { method: 'POST', token: userToken, body: { name: categoryName, description: 'User cannot create categories.' } })).status, 403);
    assert.equal((await request('/api/health/categories', { method: 'POST', token: workerToken, body: { name: categoryName, description: 'Worker cannot create categories.' } })).status, 403);

    const created = await request('/api/health/categories', {
      method: 'POST', token: managerToken, body: { name: categoryName, description: 'Stage 4 temporary test category.' },
    });
    assert.equal(created.status, 201);
    categoryId = created.payload.data.category.id;
    assert.equal(created.payload.data.category.status, 'ACTIVE');

    assert.equal((await request('/api/health/categories', {
      method: 'POST', token: adminToken, body: { name: categoryName, description: 'Duplicate name.' },
    })).status, 409);
    assert.equal((await request('/api/health/categories', {
      method: 'POST', token: managerToken, body: { name: 'x', description: '' },
    })).status, 400);

    const inactive = await request(`/api/health/categories/${categoryId}`, {
      method: 'PUT', token: managerToken, body: { status: 'INACTIVE' },
    });
    assert.equal(inactive.status, 200);
    assert.equal((await request(`/api/health/categories/${categoryId}`)).status, 404);
    assert.equal((await request(`/api/health/categories/${categoryId}`, { token: managerToken })).status, 200);
    await request(`/api/health/categories/${categoryId}`, { method: 'PUT', token: managerToken, body: { status: 'ACTIVE' } });
    assert.equal((await request(`/api/health/categories/${categoryId}`, { method: 'PUT', token: managerToken, body: { status: 'BROKEN' } })).status, 400);
    assert.equal((await request('/api/health/categories/not-an-id')).status, 400);
  });

  await t.test('articles default to private drafts and validate content', async () => {
    const publicList = await request('/api/health/articles');
    assert.equal(publicList.status, 200);
    assert.ok(publicList.payload.data.articles.every((article) => article.status === 'PUBLISHED'));
    assert.equal((await request('/api/health/articles?status=DRAFT')).status, 403);
    assert.equal((await request('/api/health/articles?category_id=bad')).status, 400);
    assert.equal((await request('/api/health/articles?q=x&q=y')).status, 400);
    assert.equal((await request('/api/health/articles', { method: 'POST', token: userToken, body: {} })).status, 403);
    assert.equal((await request('/api/health/articles', { method: 'POST', token: workerToken, body: {} })).status, 403);
    assert.equal((await request('/api/health/articles', { method: 'POST', token: managerToken, body: { title: 'Bad article' } })).status, 400);

    const created = await request('/api/health/articles', {
      method: 'POST',
      token: managerToken,
      body: {
        category_id: categoryId,
        title: articleTitle,
        summary: `Searchable summary ${suffix}`,
        content: `Temporary Stage 4 test content ${suffix}. Not medical advice.`,
      },
    });
    assert.equal(created.status, 201);
    articleId = created.payload.data.article.id;
    assert.equal(created.payload.data.article.status, 'DRAFT');
    assert.equal(created.payload.data.article.language, 'English');
    assert.equal(created.payload.data.article.created_by_name, 'Demo Content Manager');
    assert.equal((await request(`/api/health/articles/${articleId}`)).status, 404);
    assert.equal((await request(`/api/health/articles/${articleId}`, { token: managerToken })).status, 200);
    const draftList = await request(`/api/health/articles?status=DRAFT&category_id=${categoryId}`, { token: managerToken });
    assert.equal(draftList.status, 200);
    assert.ok(draftList.payload.data.articles.some((article) => article.id === articleId));
    assert.equal((await request('/api/health/articles?sort=invalid')).status, 400);

    const update = await request(`/api/health/articles/${articleId}`, {
      method: 'PUT', token: managerToken, body: { summary: `Updated summary ${suffix}` },
    });
    assert.equal(update.status, 200);
    assert.equal(update.payload.data.article.summary, `Updated summary ${suffix}`);
    assert.equal((await request(`/api/health/articles/${articleId}`, {
      method: 'PUT', token: managerToken, body: { status: 'PUBLISHED' },
    })).status, 400);
    assert.equal((await request(`/api/health/articles/${articleId}/publish`, { method: 'PATCH', token: userToken })).status, 403);
  });

  await t.test('publish, filter, archive, and category foreign-key rules work', async () => {
    const published = await request(`/api/health/articles/${articleId}/publish`, { method: 'PATCH', token: managerToken });
    assert.equal(published.status, 200);
    assert.equal(published.payload.data.article.status, 'PUBLISHED');
    assert.ok(published.payload.data.article.published_at);

    const publicArticle = await request(`/api/health/articles/${articleId}`);
    assert.equal(publicArticle.status, 200);
    const search = await request(`/api/health/articles?q=${encodeURIComponent(suffix)}&category_id=${categoryId}&language=English&sort=title`);
    assert.equal(search.status, 200);
    assert.ok(search.payload.data.articles.some((article) => article.id === articleId));
    assert.equal(search.payload.data.pagination.total, 1);
    assert.equal((await request(`/api/health/articles?q=${encodeURIComponent(suffix)}&limit=101`)).status, 400);
    assert.equal((await request(`/api/health/categories/${categoryId}`, { method: 'DELETE', token: adminToken })).status, 409);

    const archived = await request(`/api/health/articles/${articleId}/archive`, { method: 'PATCH', token: adminToken });
    assert.equal(archived.status, 200);
    assert.equal(archived.payload.data.article.status, 'ARCHIVED');
    assert.equal((await request(`/api/health/articles/${articleId}`)).status, 404);
    assert.equal((await request(`/api/health/articles/${articleId}`, { token: managerToken })).status, 200);

    const republished = await request(`/api/health/articles/${articleId}/publish`, { method: 'PATCH', token: adminToken });
    assert.equal(republished.status, 200);
    assert.equal(republished.payload.data.article.status, 'PUBLISHED');

    const deactivateCategory = await request(`/api/health/categories/${categoryId}`, {
      method: 'PUT', token: managerToken, body: { status: 'INACTIVE' },
    });
    assert.equal(deactivateCategory.status, 200);
    assert.equal((await request(`/api/health/articles/${articleId}`)).status, 404);
    await request(`/api/health/categories/${categoryId}`, { method: 'PUT', token: managerToken, body: { status: 'ACTIVE' } });
  });

  await t.test('article and category deletion clean up isolated test records', async () => {
    assert.equal((await request(`/api/health/articles/${articleId}`, { method: 'DELETE', token: workerToken })).status, 403);
    const deletedArticle = await request(`/api/health/articles/${articleId}`, { method: 'DELETE', token: managerToken });
    assert.equal(deletedArticle.status, 200);
    articleId = null;
    const deletedCategory = await request(`/api/health/categories/${categoryId}`, { method: 'DELETE', token: managerToken });
    assert.equal(deletedCategory.status, 200);
    categoryId = null;
  });
});