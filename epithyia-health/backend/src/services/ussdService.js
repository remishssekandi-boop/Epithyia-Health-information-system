const { createHash, randomUUID } = require('node:crypto');
const pool = require('../config/database');
const { normalizePhone } = require('../validators/auth');

const SESSION_TTL_MS = 5 * 60 * 1000;
const HOSPITAL_SLUGS = [
  'mengo-hospital',
  'rubaga-hospital',
  'old-kampala-hospital',
  'kibuli-hospital',
  'mulago-hospital',
  'nakasero-hospital',
];
const HOME_DEFAULT = [
  'EPITHYIA HEALTH DIRECTORY',
  '1. Hospital directory',
  '2. Hospital details',
  '3. Health guides on the website',
  '4. Emergency contacts',
  '5. About this guide',
  '6. Help',
  '0. End',
].join('\n');

function inputError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateSessionId(sessionId) {
  return typeof sessionId === 'string'
    && sessionId.length <= 191
    && /^[A-Za-z0-9._:-]+$/.test(sessionId);
}

function validateInput(text) {
  return typeof text === 'string' && text.length <= 182 && /^[0-9*#\s]*$/.test(text);
}

function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string') return Number.NaN;
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(' ', 'T')}Z`;
  return Date.parse(timestamp);
}

function eventKey(sessionId, input) {
  return createHash('sha256').update(`${sessionId}\0${input}`).digest('hex');
}

async function findSession(sessionId) {
  const [rows] = await pool.execute(
    'SELECT * FROM ussd_sessions WHERE session_id = ? ORDER BY id DESC LIMIT 1',
    [sessionId],
  );
  return rows[0] || null;
}

async function replay(eventKeyValue) {
  const [rows] = await pool.execute(
    'SELECT response FROM ussd_session_events WHERE event_key = ? LIMIT 1',
    [eventKeyValue],
  );
  if (!rows.length) return null;
  return { response: rows[0].response, ended: rows[0].response.startsWith('END ') };
}

async function getConfiguredMenu(key, fallback) {
  const [rows] = await pool.execute(
    'SELECT menu_text FROM ussd_menu_configs WHERE menu_key = ? LIMIT 1',
    [key],
  );
  return rows[0]?.menu_text || fallback;
}

async function listHospitals() {
  const placeholders = HOSPITAL_SLUGS.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT slug, name FROM hospitals
     WHERE status = 'ACTIVE' AND slug IN (${placeholders})
     ORDER BY CASE slug
       WHEN 'mengo-hospital' THEN 1
       WHEN 'rubaga-hospital' THEN 2
       WHEN 'old-kampala-hospital' THEN 3
       WHEN 'kibuli-hospital' THEN 4
       WHEN 'mulago-hospital' THEN 5
       WHEN 'nakasero-hospital' THEN 6
       ELSE 7 END`,
    HOSPITAL_SLUGS,
  );
  return rows;
}

async function hospitalDetails(selection) {
  const hospitals = await listHospitals();
  const hospital = hospitals[Number(selection) - 1];
  if (!hospital) return null;

  const [rows] = await pool.execute(
    `SELECT h.slug, h.name, h.address, h.phone, h.operating_info, h.emergency_contact
     FROM hospitals h WHERE h.slug = ? AND h.status = 'ACTIVE' LIMIT 1`,
    [hospital.slug],
  );
  if (!rows.length) return null;
  const [services] = await pool.execute(
    'SELECT service_name FROM hospital_services WHERE hospital_id = (SELECT id FROM hospitals WHERE slug = ?) AND is_verified = 1 ORDER BY service_name',
    [hospital.slug],
  );
  return { ...rows[0], services: services.map((service) => service.service_name) };
}

async function renderHospitals() {
  const hospitals = await listHospitals();
  if (hospitals.length === 0) return 'No hospitals are currently listed.';
  return [
    'HOSPITALS IN KAMPALA',
    ...hospitals.map((hospital, index) => `${index + 1}. ${hospital.name}`),
    '00. Main menu',
    '9. End session',
  ].join('\n');
}

async function renderEmergencyHospitals() {
  const hospitals = await listHospitals();
  if (hospitals.length === 0) return 'No hospitals are currently listed.';
  return [
    'HOSPITAL EMERGENCY CONTACTS',
    ...hospitals.map((hospital, index) => `${index + 1}. ${hospital.name.replace(/ Hospital.*/, '')}`),
    '0. Main  9. End',
  ].join('\n');
}

function shorten(value, maximum = 118) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum - 1);
  const wordBoundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, wordBoundary > 0 ? wordBoundary : shortened.length)}…`;
}

function hospitalSection(hospital, section) {
  const heading = hospital.name;
  let detail;
  if (section === '1') {
    const numbers = hospital.phone ? hospital.phone.split(';').map((phone) => phone.trim()) : [];
    detail = `Phone: ${numbers[0] || 'Not published'}${numbers.length > 1 ? ` (+${numbers.length - 1} more on website)` : ''}`;
  }
  if (section === '2') detail = `Address: ${hospital.address || 'Not published'}`;
  if (section === '3') {
    detail = hospital.services.length
      ? `Services: ${hospital.services.join(', ')}`
      : 'No services are listed in the sources.';
  }
  if (section === '4') detail = `Hours: ${hospital.operating_info || 'Not published'}`;
  if (section === '5') detail = `Emergency: ${hospital.emergency_contact || 'No separate number published; call the main hospital line.'}`;
  return `CON ${heading}\n${shorten(detail, 96)}\n0. Back  00. Main  9. End`;
}

async function routeSelection(menu, selection) {
  if (selection === '9') return { menu: 'ENDED', response: 'END Thank you. Session ended.', ended: true };
  if (selection === '00') {
    return { menu: 'HOME', response: `CON ${await getConfiguredMenu('HOME', HOME_DEFAULT)}` };
  }
  if (selection === '0') {
    if (menu.startsWith('HOSPITAL_DETAIL:')) {
      return { menu: 'HOSPITALS', response: `CON ${await renderHospitals()}` };
    }
    if (menu === 'HOSPITALS' || menu === 'EMERGENCY_LIST' || menu === 'HELP') {
      return { menu: 'HOME', response: `CON ${await getConfiguredMenu('HOME', HOME_DEFAULT)}` };
    }
    return { menu: 'ENDED', response: 'END Thank you. Session ended.', ended: true };
  }

  if (menu === 'HOME') {
    if (selection === '1' || selection === '2') {
      return { menu: 'HOSPITALS', response: `CON ${await renderHospitals()}` };
    }
    if (selection === '3') {
      return {
        menu: 'ENDED',
        response: 'END Health guides are available on the EPITHYIA website. This phone menu does not replace clinical advice.',
        ended: true,
      };
    }
    if (selection === '5') {
      return {
        menu: 'ENDED',
        response: 'END This guide lists published hospital information. It cannot make appointments or provide emergency response.',
        ended: true,
      };
    }
    if (selection === '4') {
      return { menu: 'EMERGENCY_LIST', response: `CON ${await renderEmergencyHospitals()}` };
    }
    if (selection === '6') {
      return { menu: 'HELP', response: `CON ${await getConfiguredMenu('HELP', 'Help is unavailable.')}` };
    }
    return { menu: 'HOME', response: `CON Invalid selection.\n${await getConfiguredMenu('HOME', HOME_DEFAULT)}` };
  }

  if (menu === 'HOSPITALS') {
    if (/^[1-6]$/.test(selection)) {
      const hospital = await hospitalDetails(selection);
      if (hospital) {
        return {
          menu: `HOSPITAL_DETAIL:${hospital.slug}`,
          response: `CON ${hospital.name}\n1. Phone  2. Address\n3. Services  4. Hours\n5. Emergency  0. Back  9. End`,
        };
      }
    }
    return { menu: 'HOSPITALS', response: `CON Invalid selection.\n${await renderHospitals()}` };
  }

  if (menu.startsWith('HOSPITAL_DETAIL:')) {
    if (/^[1-6]$/.test(selection)) {
      const slug = menu.slice('HOSPITAL_DETAIL:'.length);
      const hospitals = await listHospitals();
      const hospitalIndex = hospitals.findIndex((hospital) => hospital.slug === slug);
      const hospital = hospitalIndex < 0 ? null : await hospitalDetails(String(hospitalIndex + 1));
      if (hospital) {
        return { menu, response: hospitalSection(hospital, selection) };
      }
    }
    return { menu, response: 'CON Invalid selection. Choose 1-6, 0 to go back, or 9 to end.' };
  }

  if (menu === 'EMERGENCY_LIST') {
    if (/^[1-6]$/.test(selection)) {
      const hospital = await hospitalDetails(selection);
      if (hospital) {
        const emergency = hospital.emergency_contact || 'No separate emergency number published; call the main hospital line.';
        return {
          menu,
          response: `CON ${hospital.name}\n${shorten(emergency, 110)}\n0. Main  9. End`,
        };
      }
    }
    return { menu, response: `CON Invalid selection.\n${await renderEmergencyHospitals()}` };
  }

  if (menu === 'HELP') {
    return { menu: 'HELP', response: `CON Invalid selection.\n${await getConfiguredMenu('HELP', 'Help is unavailable.')}` };
  }

  return { menu: 'ENDED', response: 'END This session has ended. Start a new session to continue.', ended: true };
}

async function processUssd({ sessionId, phoneNumber, text = '', provider = 'simulator' }) {
  if (!validateSessionId(sessionId)) throw inputError('A valid USSD session ID is required.');
  if (!validateInput(text)) throw inputError('USSD input must contain only menu digits and separators.');
  const phone = normalizePhone(phoneNumber);
  if (!phone) throw inputError('A valid phone number is required.');
  const input = text.trim();
  const key = eventKey(sessionId, input);
  let session = await findSession(sessionId);
  if (session && normalizePhone(session.phone_number) !== phone) {
    throw inputError('The phone number does not match this USSD session.', 403);
  }
  const duplicate = await replay(key);
  if (duplicate) return duplicate;

  if (session && session.status !== 'ACTIVE') {
    throw inputError('This USSD session has ended. Start a new session.', 410);
  }
  if (session) {
    const lastActivity = timestampMillis(session.updated_at);
    if (Number.isFinite(lastActivity) && Date.now() - lastActivity > SESSION_TTL_MS) {
      const response = 'END This USSD session expired. Start a new session to continue.';
      await pool.execute(
        'UPDATE ussd_sessions SET status = ?, response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['EXPIRED', response, session.id],
      );
      return { response, ended: true };
    }
  }

  const currentMenu = session?.current_menu || 'HOME';
  const selections = input.split('*');
  const selection = selections[selections.length - 1] || '';
  let result;
  if (!session && !input) {
    result = { menu: 'HOME', response: `CON ${await getConfiguredMenu('HOME', HOME_DEFAULT)}`, ended: false };
  } else {
    result = await routeSelection(currentMenu, selection);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (session) {
      await connection.execute(
        `UPDATE ussd_sessions
         SET input = ?, current_menu = ?, response = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [input, result.menu, result.response.slice(0, 4000), result.ended ? 'COMPLETED' : 'ACTIVE', session.id],
      );
    } else {
      await connection.execute(
        `INSERT INTO ussd_sessions (session_id, phone_number, input, current_menu, response, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, phone, input, result.menu, result.response.slice(0, 4000), result.ended ? 'COMPLETED' : 'ACTIVE'],
      );
    }
    await connection.execute(
      `INSERT INTO ussd_session_events (session_id, event_key, menu, selection, response)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, key, currentMenu, selection, result.response.slice(0, 4000)],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const previous = await replay(key);
      if (previous) return previous;
    }
    throw error;
  } finally {
    connection.release();
  }

  return { response: result.response, ended: result.ended };
}

async function startSession({ phoneNumber, sessionId = randomUUID(), provider = 'simulator' }) {
  const result = await processUssd({ sessionId, phoneNumber, text: '', provider });
  return { sessionId, ...result };
}

async function getSessionHistory(sessionId) {
  if (!validateSessionId(sessionId)) throw inputError('A valid USSD session ID is required.');
  const [rows] = await pool.execute(
    `SELECT menu, selection, response, created_at
     FROM ussd_session_events WHERE session_id = ?
     ORDER BY id ASC`,
    [sessionId],
  );
  return rows;
}

module.exports = { processUssd, startSession, getSessionHistory, validateSessionId };
