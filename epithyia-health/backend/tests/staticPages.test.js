const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
const apiSource = fs.readFileSync(path.join(frontendPath, 'js', 'api.js'), 'utf8');
const siteData = JSON.parse(fs.readFileSync(path.join(frontendPath, 'data', 'site-data.json'), 'utf8'));
const htmlPages = fs.readdirSync(frontendPath).filter((file) => file.endsWith('.html'));

function createStaticApi() {
  const document = {
    baseURI: 'https://remishssekandi-boop.github.io/epithyia-health/index.html',
    querySelector(selector) {
      if (selector === 'meta[name="api-mode"]') return { content: 'static' };
      return null;
    },
  };
  const window = { location: { search: '' } };
  const context = {
    document,
    window,
    URL,
    URLSearchParams,
    fetch: async (url) => {
      assert.equal(new URL(url).pathname, '/epithyia-health/data/site-data.json');
      return { ok: true, status: 200, json: async () => siteData };
    },
  };
  vm.runInNewContext(apiSource, context);
  return window.EpithyiaApi;
}

test('static public content works at a GitHub Pages repository path', async () => {
  assert.ok(htmlPages.length > 0);
  for (const page of htmlPages) {
    const markup = fs.readFileSync(path.join(frontendPath, page), 'utf8');
    assert.doesNotMatch(markup, /\b(?:href|src|action)="\//, `${page} should use repository-relative URLs`);
  }

  const api = createStaticApi();
  assert.equal(api.siteUrl('hospitals.html'), 'https://remishssekandi-boop.github.io/epithyia-health/hospitals.html');

  const categories = await api.request('/health/categories');
  assert.equal(categories.data.categories.length, 9);

  const hospitals = await api.request('/hospitals');
  assert.equal(hospitals.data.hospitals.length, 6);
  assert.equal(hospitals.data.hospitals[5].slug, 'nakasero-hospital');

  const article = await api.request('/health/articles?limit=2&q=malaria');
  assert.equal(article.data.pagination.total, 1);
  assert.match(article.data.articles[0].title.toLowerCase(), /malaria/);
});

test('static USSD works in-browser and backend-only actions are clearly unavailable', async () => {
  const api = createStaticApi();
  const start = await api.request('/ussd/simulator/start', {
    method: 'POST',
    body: { phoneNumber: '+256700123456' },
  });
  assert.match(start.data.response, /EPITHYIA HEALTH DIRECTORY/);

  const next = await api.request('/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId: start.data.sessionId, phoneNumber: '+256700123456', text: '1' },
  });
  assert.match(next.data.response, /Mengo Hospital/);

  const history = await api.request(`/ussd/sessions/${start.data.sessionId}/events`);
  assert.equal(history.data.events.length, 2);

  await assert.rejects(api.request('/auth/me', { auth: true }), (error) => error.status === 503);
});
