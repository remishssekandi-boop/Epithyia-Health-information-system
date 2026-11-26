const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const initSqlJs = require('sql.js');
const { after, before, test } = require('node:test');

const databaseFile = path.join(os.tmpdir(), `epithyia-demo-${randomUUID()}.sqlite`);
process.env.DATABASE_MODE = 'demo';
process.env.DEMO_DATABASE_FILE = databaseFile;
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.JWT_EXPIRES_IN = '1h';
process.env.RATE_LIMIT_MAX = '100';

const app = require('../src/app');
let pool = require('../src/config/database');
let server;
let baseUrl;
const accounts = [
  ['ADMIN', 'admin.demo@epithyia.local', 'EpithyiaAdminDemo!2026'],
  ['CONTENT_MANAGER', 'content.demo@epithyia.local', 'EpithyiaContentDemo!2026'],
  ['HEALTH_WORKER', 'worker.demo@epithyia.local', 'EpithyiaWorkerDemo!2026'],
  ['USER', 'user.demo@epithyia.local', 'EpithyiaUserDemo!2026'],
];

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('HTML pages render correctly and old PHP page URLs redirect', async () => {
  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /^text\/html\b/);
  assert.match(await home.text(), /EPITHYIA GROUP/);

  for (const pageName of [
    'about',
    'article',
    'contact',
    'dashboard',
    'health-information',
    'hospital',
    'hospitals',
    'index',
    'login',
    'register',
    'ussd',
  ]) {
    const page = await fetch(`${baseUrl}/${pageName}.html`);
    assert.equal(page.status, 200, `${pageName}.html should be served`);
    assert.match(page.headers.get('content-type'), /^text\/html\b/, `${pageName}.html should have an HTML content type`);
  }

  const legacy = await fetch(`${baseUrl}/about.php?from=legacy`, { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/about.html?from=legacy');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  fs.rmSync(databaseFile, { force: true });
  fs.rmSync(`${databaseFile}-journal`, { force: true });
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

test('persistent demo mode supports public content, accounts, and editing without MySQL', async () => {
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.payload.data.databaseMode, 'demo');
  assert.equal((await request('/api/health/db')).status, 200);

  const categories = await request('/api/health/categories');
  assert.equal(categories.status, 200);
  assert.ok(categories.payload.data.categories.length >= 3);

  const hospitals = await request('/api/hospitals');
  assert.equal(hospitals.status, 200);
  assert.equal(hospitals.payload.data.hospitals.length, 6);
  assert.deepEqual(
    hospitals.payload.data.hospitals.map((hospital) => hospital.name),
    [
      'Mengo Hospital',
      'Rubaga Hospital',
      'Old Kampala Hospital',
      'Kibuli Muslim Hospital',
      'Mulago National Referral Hospital',
      'Nakasero Hospital',
    ],
  );
  for (const hospital of hospitals.payload.data.hospitals) {
    assert.equal(hospital.is_verified, 1);
    assert.ok(hospital.address);
    assert.ok(hospital.phone);
    assert.ok(hospital.operating_info);
    assert.ok(hospital.emergency_contact);
    assert.ok(hospital.services.length > 0);
    assert.ok(hospital.sources.length > 0);
    assert.match(hospital.google_maps_url, /^https:\/\/www\.google\.com\/maps\/search\//);
    assert.equal(
      hospital.image_path,
      {
        'mengo-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSByC5Cl5u25RdZQH2gd4fyy3VPRDGSv9R_gS8A_Y_XhQ&s=10',
        'rubaga-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS54jJRO2AF0DNbTmxTVPEfeDQ9NcZue0vzgJzKE6-mZg&s=10',
        'old-kampala-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwGsq8MwCH5N6StbiEJ6hAEx0YrrDoM6Lhwz68BGxWrQ&s=10',
        'kibuli-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmo-wmV-bP7ghPNQ0gy9Kiz_Ipzmf28yAc9yp2jnvgWg&s=10',
        'mulago-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThwK-UcgW_tOtsB8eA_sCJJlPrFcjeGALh56eOVKKr9A&s=10',
        'nakasero-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5AF1PejntZq2UBMvAbKs5iKfJZPyzZniQnggZdwdq4g&s=10',
      }[hospital.slug],
    );
  }
  assert.equal((await request('/api/hospitals?q=mengo')).payload.data.hospitals.length, 1);
  assert.equal((await request('/api/hospitals?q=Prince Badru Kakungulu')).payload.data.hospitals.length, 1);
  const nakasero = await request('/api/hospitals/nakasero-hospital');
  assert.equal(nakasero.status, 200);
  assert.match(nakasero.payload.data.hospital.address, /14A Akii Bua Road/);
  assert.ok(nakasero.payload.data.hospital.services.some((service) => service.name === 'Emergency and critical care'));
  const hospitalProfile = await request('/api/hospitals/mengo-hospital');
  assert.equal(hospitalProfile.status, 200);
  assert.ok(hospitalProfile.payload.data.hospital.services.some((service) => service.name === 'Accident and Emergency'));
  assert.ok(hospitalProfile.payload.data.hospital.services.every((service) => service.source));

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.demo@epithyia.local', password: 'EpithyiaAdminDemo!2026' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.payload.data.token;
  for (const [role, email, password] of accounts) {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.status, 200);
    assert.equal(login.payload.data.user.role, role);
  }

  const suffix = randomUUID().slice(0, 8);
  const category = await request('/api/health/categories', {
    method: 'POST',
    token: adminToken,
    body: { name: `Demo ${suffix}`, description: 'Temporary demo category.' },
  });
  assert.equal(category.status, 201);

  const userToken = (await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'user.demo@epithyia.local', password: 'EpithyiaUserDemo!2026' },
  })).payload.data.token;
  const hospitalDetails = {
    name: `Community Hospital ${suffix}`,
    location: 'Kampala, Uganda',
    address: 'Example Road, Kampala',
    phone: '+256 700 111 222',
    description: 'A community hospital added for directory testing.',
    operating_info: 'Call ahead to confirm opening hours.',
    emergency_contact: '+256 700 111 222',
    image_path: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc',
  };
  const deniedHospitalCreate = await request('/api/hospitals', {
    method: 'POST',
    token: userToken,
    body: hospitalDetails,
  });
  assert.equal(deniedHospitalCreate.status, 403);
  const invalidHospitalCreate = await request('/api/hospitals', {
    method: 'POST',
    token: adminToken,
    body: { ...hospitalDetails, image_path: 'http://example.test/hospital.jpg' },
  });
  assert.equal(invalidHospitalCreate.status, 400);
  const createdHospital = await request('/api/hospitals', {
    method: 'POST',
    token: adminToken,
    body: hospitalDetails,
  });
  assert.equal(createdHospital.status, 201);
  assert.equal(createdHospital.payload.data.hospital.is_verified, 0);
  const duplicateHospital = await request('/api/hospitals', {
    method: 'POST',
    token: adminToken,
    body: hospitalDetails,
  });
  assert.equal(duplicateHospital.status, 409);
  const dynamicHospital = await request(`/api/hospitals/${createdHospital.payload.data.hospital.slug}`);
  assert.equal(dynamicHospital.status, 200);
  assert.equal(dynamicHospital.payload.data.hospital.name, hospitalDetails.name);
  assert.equal((await request('/api/hospitals')).payload.data.hospitals.length, 7);

  const futureDate = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const appointmentDetails = {
    hospital_id: createdHospital.payload.data.hospital.id,
    appointment_date: futureDate,
    appointment_time: '10:30',
    requested_service: 'General consultation',
  };
  const deniedAppointment = await request('/api/appointments', {
    method: 'POST',
    token: adminToken,
    body: appointmentDetails,
  });
  assert.equal(deniedAppointment.status, 403);
  const invalidAppointment = await request('/api/appointments', {
    method: 'POST',
    token: userToken,
    body: { ...appointmentDetails, appointment_date: '2020-01-01' },
  });
  assert.equal(invalidAppointment.status, 400);
  const appointment = await request('/api/appointments', {
    method: 'POST',
    token: userToken,
    body: appointmentDetails,
  });
  assert.equal(appointment.status, 201);
  assert.equal(appointment.payload.data.appointment.status, 'REQUESTED');
  const deniedStatusUpdate = await request(`/api/appointments/${appointment.payload.data.appointment.id}/status`, {
    method: 'PATCH',
    token: userToken,
    body: { status: 'CONFIRMED' },
  });
  assert.equal(deniedStatusUpdate.status, 403);
  const ownAppointments = await request('/api/appointments', { token: userToken });
  assert.equal(ownAppointments.status, 200);
  assert.equal(ownAppointments.payload.data.appointments.length, 1);
  assert.equal(ownAppointments.payload.data.appointments[0].hospital_name, hospitalDetails.name);
  const adminAppointments = await request('/api/appointments', { token: adminToken });
  assert.ok(adminAppointments.payload.data.appointments.some((item) => item.id === appointment.payload.data.appointment.id));
  const confirmedAppointment = await request(`/api/appointments/${appointment.payload.data.appointment.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'CONFIRMED' },
  });
  assert.equal(confirmedAppointment.status, 200);
  assert.equal(confirmedAppointment.payload.data.appointment.status, 'CONFIRMED');
  assert.equal((await request('/api/appointments', { token: userToken })).payload.data.appointments[0].status, 'CONFIRMED');
  const duplicateConfirmation = await request(`/api/appointments/${appointment.payload.data.appointment.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'DECLINED' },
  });
  assert.equal(duplicateConfirmation.status, 409);

  const deniedCreate = await request('/api/health/articles', {
    method: 'POST',
    token: userToken,
    body: {
      category_id: category.payload.data.category.id,
      title: 'Denied community draft',
      summary: 'A role-restricted operation.',
      content: 'This content must not be created by a community account.',
    },
  });
  assert.equal(deniedCreate.status, 403);

  const created = await request('/api/health/articles', {
    method: 'POST',
    token: adminToken,
    body: {
      category_id: category.payload.data.category.id,
      title: `Demo article ${suffix}`,
      summary: 'A sample article created during the demo.',
      content: 'Demonstration text only; this is not health advice.',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.payload.data.article.status, 'DRAFT');

  const updated = await request(`/api/health/articles/${created.payload.data.article.id}`, {
    method: 'PUT',
    token: adminToken,
    body: { summary: 'Updated sample summary for the demo.' },
  });
  assert.equal(updated.status, 200);

  const published = await request(`/api/health/articles/${created.payload.data.article.id}/publish`, {
    method: 'PATCH',
    token: adminToken,
  });
  assert.equal(published.status, 200);

  const publicArticles = await request(`/api/health/articles?q=${encodeURIComponent(suffix)}`);
  assert.equal(publicArticles.status, 200);
  assert.equal(publicArticles.payload.data.articles.length, 1);
  assert.equal(publicArticles.payload.data.articles[0].title, `Demo article ${suffix}`);

  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Demo Test Member',
      email: `demo.${suffix}@example.test`,
      phone: `+2567${String(Number.parseInt(suffix, 16) % 100000000).padStart(8, '0')}`,
      password: 'DemoMember!Password2026',
    },
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.payload.data.user.role, 'USER');

  const users = await request('/api/users', { token: adminToken });
  assert.equal(users.status, 200);
  const demoUser = users.payload.data.users.find((user) => user.email === 'user.demo@epithyia.local');
  assert.ok(demoUser);
  const roleChange = await request(`/api/users/${demoUser.id}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'HEALTH_WORKER' },
  });
  assert.equal(roleChange.status, 200);
  const roleRestore = await request(`/api/users/${demoUser.id}/role`, {
    method: 'PATCH',
    token: adminToken,
    body: { role: 'USER' },
  });
  assert.equal(roleRestore.status, 200);

  const SQL = await initSqlJs();
  const persistedDatabase = new SQL.Database(fs.readFileSync(databaseFile));
  const persistedStatement = persistedDatabase.prepare('SELECT id FROM health_articles WHERE title = ?');
  persistedStatement.bind([`Demo article ${suffix}`]);
  assert.equal(persistedStatement.step(), true);
  persistedStatement.free();
  persistedDatabase.close();
});

test('USSD simulator persists navigation, validates identity, and deduplicates replayed input', async () => {
  const phoneNumber = '+256700123456';
  const start = await request('/api/ussd/simulator/start', {
    method: 'POST',
    body: { phoneNumber },
  });
  assert.equal(start.status, 200);
  assert.match(start.payload.data.response, /^CON EPITHYIA HEALTH DIRECTORY/);
  const { sessionId } = start.payload.data;

  const hospitals = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1' },
  });
  assert.equal(hospitals.status, 200);
  assert.match(hospitals.payload.data.response, /1\. Mengo Hospital/);
  assert.match(hospitals.payload.data.response, /6\. Nakasero Hospital/);

  const nakaseroSession = await request('/api/ussd/simulator/start', {
    method: 'POST',
    body: { phoneNumber: '+256700765432' },
  });
  await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: {
      sessionId: nakaseroSession.payload.data.sessionId,
      phoneNumber: '+256700765432',
      text: '1',
    },
  });
  const nakaseroDetails = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: {
      sessionId: nakaseroSession.payload.data.sessionId,
      phoneNumber: '+256700765432',
      text: '1*6',
    },
  });
  assert.match(nakaseroDetails.payload.data.response, /Nakasero Hospital/);
  const nakaseroPhone = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: {
      sessionId: nakaseroSession.payload.data.sessionId,
      phoneNumber: '+256700765432',
      text: '1*6*1',
    },
  });
  assert.match(nakaseroPhone.payload.data.response, /Phone: \+256 312 531 400/);

  const selectedHospital = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1' },
  });
  assert.equal(selectedHospital.status, 200);
  assert.match(selectedHospital.payload.data.response, /Mengo Hospital/);
  assert.match(selectedHospital.payload.data.response, /1\. Phone/);

  const detail = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1' },
  });
  assert.equal(detail.status, 200);
  const phone = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1' },
  });
  assert.match(phone.payload.data.response, /Phone: \+256 771 370 263/);

  const replay = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1' },
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.payload.data.response, phone.payload.data.response);

  const address = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*2' },
  });
  assert.match(address.payload.data.response, /Sir Albert Cook Road/);
  const services = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*3' },
  });
  assert.match(services.payload.data.response, /Services:/);
  const hours = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*4' },
  });
  assert.match(hours.payload.data.response, /Hours:.*24\/7/);

  const wrongPhone = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber: '+256700999999', text: '1*1*1*2*3*4*0' },
  });
  assert.equal(wrongPhone.status, 403);

  const invalid = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1*2*3*4*7' },
  });
  assert.match(invalid.payload.data.response, /Invalid selection/);

  const back = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1*2*3*4*7*0' },
  });
  assert.match(back.payload.data.response, /HOSPITALS IN KAMPALA/);

  const end = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1*2*3*4*7*0*9' },
  });
  assert.equal(end.payload.data.ended, true);
  assert.match(end.payload.data.response, /^END /);

  const history = await request(`/api/ussd/sessions/${sessionId}/events`);
  assert.equal(history.status, 200);
  assert.equal(history.payload.data.events.length, 10);

  const afterEnd = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId, phoneNumber, text: '1*1*1*2*3*4*7*0*9*1' },
  });
  assert.equal(afterEnd.status, 410);

  const emergencySession = await request('/api/ussd/simulator/start', {
    method: 'POST',
    body: { phoneNumber },
  });
  const emergencyList = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId: emergencySession.payload.data.sessionId, phoneNumber, text: '4' },
  });
  assert.match(emergencyList.payload.data.response, /HOSPITAL EMERGENCY CONTACTS/);
  const mulagoEmergency = await request('/api/ussd/simulator/continue', {
    method: 'POST',
    body: { sessionId: emergencySession.payload.data.sessionId, phoneNumber, text: '4*5' },
  });
  assert.match(mulagoEmergency.payload.data.response, /Medical Emergency: \+256 414 675 065/);
});

test('Africa’s Talking-compatible webhook authenticates requests and uses the same USSD service', async () => {
  process.env.USSD_PROVIDER_TOKEN = 'demo-test-provider-token-2026';
  const denied = await fetch(`${baseUrl}/api/ussd/providers/africas-talking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      sessionId: 'provider-session-denied',
      phoneNumber: '+256700123456',
      serviceCode: '*123#',
      text: '',
    }),
  });
  assert.equal(denied.status, 401);
  assert.match(await denied.text(), /^END Unauthorized/);

  const sessionId = `provider-${randomUUID()}`;
  const response = await fetch(`${baseUrl}/api/ussd/providers/africas-talking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-USSD-Provider-Token': process.env.USSD_PROVIDER_TOKEN,
    },
    body: new URLSearchParams({
      sessionId,
      phoneNumber: '+256700123456',
      serviceCode: '*123#',
      text: '',
    }),
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /^CON EPITHYIA HEALTH DIRECTORY/);
});

test('demo controls require ADMIN and reset only explicitly marked demo records', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.demo@epithyia.local', password: 'EpithyiaAdminDemo!2026' },
  });
  const adminToken = login.payload.data.token;
  const communityLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'user.demo@epithyia.local', password: 'EpithyiaUserDemo!2026' },
  });
  const denied = await request('/api/demo/activity', { token: communityLogin.payload.data.token });
  assert.equal(denied.status, 403);

  const activity = await request('/api/demo/activity', { token: adminToken });
  assert.equal(activity.status, 200);
  assert.ok(Array.isArray(activity.payload.data.audit));
  assert.ok(Array.isArray(activity.payload.data.ussd));

  const cleared = await request('/api/demo/sessions/clear', { method: 'POST', token: adminToken });
  assert.equal(cleared.status, 200);
  const [remainingEvents] = await pool.execute('SELECT COUNT(*) AS count FROM ussd_session_events');
  assert.equal(Number(remainingEvents[0].count), 0);

  process.env.DATABASE_MODE = 'mysql';
  const mysqlDisabled = await request('/api/demo/activity', { token: adminToken });
  process.env.DATABASE_MODE = 'demo';
  assert.equal(mysqlDisabled.status, 404);

  const [demoCategory] = await pool.execute(
    "SELECT is_demo FROM health_categories WHERE name LIKE 'Demo %' LIMIT 1",
  );
  assert.equal(Number(demoCategory[0].is_demo), 1);
  const [demoArticle] = await pool.execute(
    "SELECT is_demo FROM health_articles WHERE title LIKE 'Demo article %' LIMIT 1",
  );
  assert.equal(Number(demoArticle[0].is_demo), 1);
  const [registeredUsers] = await pool.execute(
    "SELECT id FROM users WHERE email LIKE 'demo.%@example.test' AND is_demo = 0",
  );
  assert.equal(registeredUsers.length, 1);
  const [realCategory] = await pool.execute(
    'INSERT INTO health_categories (name, description, is_demo) VALUES (?, ?, 0)',
    [`Preserved category ${randomUUID()}`, 'Non-demo reset safety fixture.'],
  );
  const [realArticle] = await pool.execute(
    `INSERT INTO health_articles (category_id, title, summary, content, status, created_by, is_demo)
     VALUES (?, ?, ?, ?, 'DRAFT', ?, 0)`,
    [realCategory.insertId, 'Preserved non-demo article', 'Safe reset test', 'Not demo content.', registeredUsers[0].id],
  );

  const reset = await request('/api/demo/reset', { method: 'POST', token: adminToken });
  assert.equal(reset.status, 200);
  const [hospitals] = await pool.execute('SELECT COUNT(*) AS count FROM hospitals WHERE is_demo = 1');
  assert.equal(Number(hospitals[0].count), 6);
  const [appointments] = await pool.execute('SELECT COUNT(*) AS count FROM appointments WHERE is_demo = 1');
  assert.equal(Number(appointments[0].count), 0);
  const [preservedArticle] = await pool.execute(
    'SELECT id FROM health_articles WHERE id = ? AND is_demo = 0',
    [realArticle.insertId],
  );
  assert.equal(preservedArticle.length, 1);
  const [resetActivity] = await pool.execute(
    "SELECT action FROM audit_logs WHERE action = 'DEMO_RESET'",
  );
  assert.equal(resetActivity.length, 1);

  const secondLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.demo@epithyia.local', password: 'EpithyiaAdminDemo!2026' },
  });
  const secondReset = await request('/api/demo/reset', {
    method: 'POST',
    token: secondLogin.payload.data.token,
  });
  assert.equal(secondReset.status, 200);
  const [demoHospitals] = await pool.execute('SELECT COUNT(*) AS count FROM hospitals WHERE is_demo = 1');
  const [demoArticles] = await pool.execute('SELECT COUNT(*) AS count FROM health_articles WHERE is_demo = 1');
  assert.equal(Number(demoHospitals[0].count), 6);
  assert.equal(Number(demoArticles[0].count), 9);
});
