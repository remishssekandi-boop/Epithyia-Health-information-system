const pool = require('../config/database');
const { recordAudit } = require('../utils/audit');
const { validateHospital } = require('../validators/hospitals');

const SOURCES = {
  'mengo-hospital': [
    { label: 'Mengo Hospital contact details', url: 'https://mengohospital.org/contact-us/' },
    { label: 'Mengo Hospital medical services', url: 'https://mengohospital.org/services/' },
    { label: 'Mengo Hospital Accident and Emergency', url: 'https://mengohospital.org/mengo-hospital-expands-accident-and-emergency-department/' },
    { label: 'KCCA hospital listing', url: 'https://visitkampala.kcca.go.ug/business_details/mengo-hospital' },
  ],
  'rubaga-hospital': [
    { label: 'Lubaga Hospital contact details and hours', url: 'https://lubagahospital.org/contact-us/' },
    { label: 'KCCA hospital listing and services', url: 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital' },
  ],
  'old-kampala-hospital': [
    { label: 'Old Kampala Hospital contact details', url: 'https://oldkampalahospital.org/contact/' },
    { label: 'Old Kampala Hospital services and emergency care', url: 'https://oldkampalahospital.org/' },
  ],
  'kibuli-hospital': [
    { label: 'Kibuli Muslim Hospital contact details', url: 'https://kibulimuslimhospital.ug/contact/' },
    { label: 'Kibuli Muslim Hospital services', url: 'https://kibulimuslimhospital.ug/services/' },
    { label: 'KCCA hospital listing and emergency services', url: 'https://visitkampala.kcca.go.ug/business_details/kibuli-hospital' },
  ],
  'mulago-hospital': [
    { label: 'Mulago National Referral Hospital', url: 'https://mulagohospital.go.ug/' },
    { label: 'Mulago Hospital emergency contacts', url: 'https://mulagohospital.go.ug/contact2.html' },
    { label: 'KCCA hospital listing', url: 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital' },
  ],
  'nakasero-hospital': [
    { label: 'Nakasero Hospital contact and patient information', url: 'https://nakaserohospital.com/contact-us/' },
    { label: 'Nakasero Hospital services and patient support', url: 'https://nakaserohospital.com/patient-support/' },
    { label: 'KCCA hospital listing, contacts, and directions', url: 'https://visitkampala.kcca.go.ug/business_details/nakasero-hospital' },
  ],
};
const SOURCES_CHECKED_ON = '2026-11-18';
const SOURCES_CHECKED_ON_BY_SLUG = {
  'nakasero-hospital': '2026-11-26',
};
const ORDER_SQL = `CASE h.slug
  WHEN 'mengo-hospital' THEN 1
  WHEN 'rubaga-hospital' THEN 2
  WHEN 'old-kampala-hospital' THEN 3
  WHEN 'kibuli-hospital' THEN 4
  WHEN 'mulago-hospital' THEN 5
  WHEN 'nakasero-hospital' THEN 6
  ELSE 7 END`;
const FIELDS = `h.id, h.slug, h.name, h.location, h.address, h.phone, h.description,
  h.operating_info, h.emergency_contact, h.status, h.image_path, h.is_verified`;

function unexpected(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

async function addVerifiedServices(hospitals) {
  if (hospitals.length === 0) return hospitals;
  const placeholders = hospitals.map(() => '?').join(', ');
  const [services] = await pool.execute(
    `SELECT hospital_id, service_name, source_url
     FROM hospital_services
     WHERE is_verified = 1 AND hospital_id IN (${placeholders})
     ORDER BY service_name ASC`,
    hospitals.map((hospital) => hospital.id),
  );
  const byHospital = new Map(hospitals.map((hospital) => [String(hospital.id), []]));
  for (const service of services) {
    byHospital.get(String(service.hospital_id))?.push({
      name: service.service_name,
      source: service.source_url,
    });
  }
  return hospitals.map((hospital) => {
    const sources = SOURCES[hospital.slug] || [];
    return {
      ...hospital,
      services: byHospital.get(String(hospital.id)) || [],
      sources,
      sources_checked_on: sources.length
        ? SOURCES_CHECKED_ON_BY_SLUG[hospital.slug] || SOURCES_CHECKED_ON
        : null,
      google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name}, Kampala, Uganda`)}`,
    };
  });
}

async function list(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length > 100) {
    return res.status(400).json({ success: false, message: 'Search text must be at most 100 characters.' });
  }
  const search = query ? ' AND (h.name LIKE ? OR h.location LIKE ? OR h.address LIKE ?)' : '';
  const parameters = [];
  if (query) parameters.push(`%${query}%`, `%${query}%`, `%${query}%`);

  try {
    const [rows] = await pool.execute(
      `SELECT ${FIELDS}
       FROM hospitals h
       WHERE h.status = 'ACTIVE'${search}
       ORDER BY ${ORDER_SQL}, h.name ASC`,
      parameters,
    );
    const hospitals = await addVerifiedServices(rows);
    return res.status(200).json({ success: true, data: { hospitals } });
  } catch (error) {
    return unexpected(res, error, 'Hospital directory lookup failed');
  }
}

async function getBySlug(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT ${FIELDS} FROM hospitals h
       WHERE h.slug = ? AND h.status = 'ACTIVE' LIMIT 1`,
      [req.params.slug],
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    const [hospital] = await addVerifiedServices(rows);
    return res.status(200).json({ success: true, data: { hospital } });
  } catch (error) {
    return unexpected(res, error, 'Hospital detail lookup failed');
  }
}

function slugFromName(name) {
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

async function create(req, res) {
  const { errors, value } = validateHospital(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid hospital details.', errors });
  const slug = slugFromName(value.name);
  if (!slug) return res.status(400).json({ success: false, message: 'Hospital name must include at least one English letter or number.' });

  const isDemoRecord = process.env.DATABASE_MODE === 'demo' && Number(req.user.is_demo) === 1;
  try {
    const [result] = await pool.execute(
      `INSERT INTO hospitals
         (slug, name, location, address, phone, description, operating_info, emergency_contact, status, image_path, is_verified${isDemoRecord ? ', is_demo' : ''})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0${isDemoRecord ? ', 1' : ''})`,
      [
        slug,
        value.name,
        value.location,
        value.address || null,
        value.phone || null,
        value.description,
        value.operating_info || null,
        value.emergency_contact || null,
        value.image_path,
      ],
    );
    await recordAudit({
      userId: req.user.id,
      action: 'HOSPITAL_CREATED',
      entity: 'hospitals',
      entityId: result.insertId,
      details: { name: value.name, slug },
    });
    const [rows] = await pool.execute(`SELECT ${FIELDS} FROM hospitals h WHERE h.id = ? LIMIT 1`, [result.insertId]);
    return res.status(201).json({ success: true, data: { hospital: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A hospital with this name or generated directory address already exists.' });
    }
    return unexpected(res, error, 'Hospital creation failed');
  }
}

module.exports = { list, getBySlug, create };
