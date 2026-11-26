const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

const HOSPITAL_IMAGE_URLS = {
  'kibuli-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmo-wmV-bP7ghPNQ0gy9Kiz_Ipzmf28yAc9yp2jnvgWg&s=10',
  'mengo-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSByC5Cl5u25RdZQH2gd4fyy3VPRDGSv9R_gS8A_Y_XhQ&s=10',
  'rubaga-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS54jJRO2AF0DNbTmxTVPEfeDQ9NcZue0vzgJzKE6-mZg&s=10',
  'old-kampala-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwGsq8MwCH5N6StbiEJ6hAEx0YrrDoM6Lhwz68BGxWrQ&s=10',
  'nakasero-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5AF1PejntZq2UBMvAbKs5iKfJZPyzZniQnggZdwdq4g&s=10',
  'mulago-hospital': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThwK-UcgW_tOtsB8eA_sCJJlPrFcjeGALh56eOVKKr9A&s=10',
};

const projectRoot = path.resolve(__dirname, '../../..');
const configuredFile = process.env.DEMO_DATABASE_FILE || 'backend/data/demo.sqlite';
const databaseFile = path.isAbsolute(configuredFile)
  ? configuredFile
  : path.resolve(projectRoot, configuredFile);
const ready = initialize();

async function initialize() {
  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

  const database = fs.existsSync(databaseFile)
    ? new SQL.Database(fs.readFileSync(databaseFile))
    : new SQL.Database();
  database.run('PRAGMA foreign_keys = ON');
  database.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS health_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS health_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES health_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'English',
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
      created_by INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ussd_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      input TEXT,
      current_menu TEXT NOT NULL DEFAULT 'HOME',
      response TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      location TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      description TEXT NOT NULL,
      operating_info TEXT,
      emergency_contact TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      image_path TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS hospital_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON UPDATE CASCADE ON DELETE CASCADE,
      service_name TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
      source_url TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      UNIQUE (hospital_id, service_name)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      requested_service TEXT,
      status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'CONFIRMED', 'DECLINED')),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_user_date
      ON appointments (user_id, appointment_date, appointment_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_status_date
      ON appointments (status, appointment_date);
    CREATE TABLE IF NOT EXISTS ussd_session_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_key TEXT NOT NULL UNIQUE,
      menu TEXT NOT NULL,
      selection TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ussd_menu_configs (
      menu_key TEXT PRIMARY KEY,
      menu_text TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ussd_events_session_created
      ON ussd_session_events (session_id, created_at);
    CREATE TRIGGER IF NOT EXISTS users_updated_at
      AFTER UPDATE ON users
      FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    CREATE TRIGGER IF NOT EXISTS categories_updated_at
      AFTER UPDATE ON health_categories
      FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE health_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    CREATE TRIGGER IF NOT EXISTS articles_updated_at
      AFTER UPDATE ON health_articles
      FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE health_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);

  for (const [table, columnSql] of [
    ['users', 'INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))'],
    ['health_categories', 'INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))'],
    ['health_articles', 'INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))'],
  ]) {
    const columns = database.exec(`PRAGMA table_info(${table})`)[0].values.map((row) => row[1]);
    if (!columns.includes('is_demo')) database.run(`ALTER TABLE ${table} ADD COLUMN is_demo ${columnSql}`);
  }

  await seedDefaults(database, { save: false });

  persist(database);
  return database;
}

async function seedDefaults(database, { save = true } = {}) {
  for (const [name, description] of [
    ['ADMIN', 'Account administrator'],
    ['CONTENT_MANAGER', 'Health content editor'],
    ['HEALTH_WORKER', 'Health worker'],
    ['USER', 'Community member'],
  ]) {
    run(database, 'INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)', [name, description], { save });
  }

  run(
    database,
    `UPDATE users SET is_demo = 1,
       name = CASE email
         WHEN 'admin.demo@epithyia.local' THEN 'Account Administrator'
         WHEN 'content.demo@epithyia.local' THEN 'Content Editor'
         WHEN 'worker.demo@epithyia.local' THEN 'Health Worker'
         WHEN 'user.demo@epithyia.local' THEN 'Community Member'
         ELSE name END
     WHERE email IN (?, ?, ?, ?)`,
    [
      'admin.demo@epithyia.local',
      'content.demo@epithyia.local',
      'worker.demo@epithyia.local',
      'user.demo@epithyia.local',
    ],
    { save },
  );
  for (const account of [
    ['Account Administrator', 'admin.demo@epithyia.local', '+256700000001', 'ADMIN', 'EpithyiaAdminDemo!2026'],
    ['Content Editor', 'content.demo@epithyia.local', '+256700000003', 'CONTENT_MANAGER', 'EpithyiaContentDemo!2026'],
    ['Health Worker', 'worker.demo@epithyia.local', '+256700000004', 'HEALTH_WORKER', 'EpithyiaWorkerDemo!2026'],
    ['Community Member', 'user.demo@epithyia.local', '+256700000002', 'USER', 'EpithyiaUserDemo!2026'],
  ]) {
    const [existing] = run(database, 'SELECT id FROM users WHERE email = ?', [account[1]], { save });
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(account[4], 12);
      run(
        database,
        `INSERT INTO users (name, email, phone, password_hash, role_id, is_demo)
         VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name = ?), 1)`,
        [account[0], account[1], account[2], passwordHash, account[3]],
        { save },
      );
    }
  }

  for (const [name, description] of [
    ['Maternal Health', 'Practical information for pregnancy, antenatal care, and knowing when to seek urgent help.'],
    ['Child Health', 'Guidance for child wellness visits, vaccination, illness warning signs, and caregiver questions.'],
    ['Malaria', 'Information on malaria prevention, symptoms, testing, and timely care.'],
    ['HIV and Sexual Health', 'Confidential care, prevention, testing, and reproductive health information.'],
    ['Nutrition', 'Everyday nutrition guidance for children and adults.'],
    ['Immunization', 'How routine vaccines protect individuals and communities.'],
    ['Disease Prevention', 'Practical steps for staying healthy and reducing everyday infection risks.'],
    ['Emergency Information', 'How to recognize urgent warning signs and obtain appropriate emergency care.'],
    ['Hospital Access', 'How to find a hospital, prepare for a visit, and confirm available services.'],
  ]) {
    run(
      database,
      'INSERT OR IGNORE INTO health_categories (name, description, is_demo) VALUES (?, ?, 1)',
      [name, description],
      { save },
    );
  }

  run(
    database,
    `UPDATE health_categories SET is_demo = 1
     WHERE name IN (
       'Maternal Health', 'Child Health', 'Malaria', 'HIV and Sexual Health',
       'Nutrition', 'Immunization', 'Disease Prevention',
       'Emergency Information', 'Hospital Access'
     )`,
    [],
    { save },
  );
  for (const article of [
    ['Maternal Health', 'Prepare for antenatal and delivery care', 'What to ask and arrange before and during pregnancy.', 'Antenatal care provides regular checks on the health of the pregnant person and baby. If possible, begin antenatal visits early and attend all recommended appointments. Keep a record of visits, medicines, allergies, and expected delivery date. Seek immediate help for severe bleeding, severe headache, vision changes, convulsions, severe abdominal pain, difficulty breathing, or reduced baby movement after quickening. These are warning signs, not normal discomfort; contact a health facility or emergency service promptly.'],
    ['Child Health', 'Know when a sick child needs urgent care', 'Use a calm checklist of urgent warning signs.', 'A child who is difficult to wake, unable to drink, breathing unusually fast or with difficulty, having convulsions, becoming unusually floppy or irritable, or looking much worse should receive urgent medical assessment. Fever, cough, diarrhea, and vomiting can become serious when a child has poor feeding or dehydration. Follow advice from a qualified health worker and do not delay care because a clinic is closed. Seek the nearest appropriate emergency or pediatric service.'],
    ['Malaria', 'Prevent malaria and seek testing early', 'Practical prevention and when to test.', 'Use insecticide-treated bed nets, keep mosquito control measures around living areas, and follow locally recommended prevention advice. Fever can have several causes, so malaria should be confirmed with a rapid test or microscopy before treatment whenever possible. Do not give leftover medicine or share another person’s prescription. A person who has severe weakness, confusion, breathing difficulty, convulsions, persistent vomiting, or cannot drink needs urgent medical attention.'],
    ['HIV and Sexual Health', 'Know your options for HIV testing and prevention', 'Confidential services help people make informed decisions.', 'Free or low-cost HIV testing and counseling are available through many Ugandan public health facilities. Ask a health worker about testing, condoms, HIV prevention medicines, treatment, pregnancy planning, and confidential reproductive care. HIV treatment works best when started early and taken consistently. A positive or negative result should be explained privately, with follow-up and partner support when appropriate.'],
    ['Nutrition', 'Build a varied everyday meal', 'Choose accessible foods across the main food groups.', 'A balanced meal can include a starchy staple, a protein food such as beans, eggs, fish, or meat, fruits or vegetables, and clean water. Add variety when affordable rather than relying on one type of food. Infants have specific feeding needs; ask a health worker or caregiver-support service for advice. Seek assessment for persistent poor growth, severe weight loss, unusual swelling, or feeding difficulty.'],
    ['Immunization', 'Keep an immunization record up to date', 'Vaccines protect children and some adults.', 'Vaccines are offered according to Uganda’s public immunization schedule. Keep a child health card and take it to each visit so due vaccines are not missed. Vaccines may cause short-lived redness, fever, or soreness. Severe breathing difficulty, swelling of the face or throat, or collapse after vaccination is an emergency and needs immediate care. Ask a health worker about missed doses and adult vaccination where applicable.'],
    ['Disease Prevention', 'Reduce common infection risks', 'Simple habits help protect households and communities.', 'Wash hands with soap and clean water after using a toilet and before preparing or eating food. Use safe drinking water, cook food thoroughly, cover or store food safely, and ventilate crowded rooms. Use local mosquito and water-safety guidance. Stay away from others while seriously unwell if advised, and seek medical advice for persistent fever, cough, diarrhea, or worsening symptoms.'],
    ['Emergency Information', 'Recognize warning signs and act promptly', 'Emergency care is for severe, rapidly worsening, or life-threatening conditions.', 'Difficulty breathing, severe bleeding, collapse, chest pain, stroke-like weakness or facial droop, severe head injury, convulsions, suspected poisoning, and serious allergic reactions require immediate emergency help. Do not move a person unnecessarily after major trauma. Call the facility or emergency service, give a clear location and condition, and follow their instructions. This guide cannot replace emergency dispatch or clinical assessment.'],
    ['Hospital Access', 'Prepare before visiting a hospital', 'Contact the facility and confirm the service you need.', 'Check the hospital address, telephone number, listed department, and operating information. Call first for clinic schedules, referrals, cost information, required documents, and whether specialist or laboratory services are available. Bring identification, previous records, medicine names, and a contact person. For immediate danger, use an emergency unit or local emergency service rather than waiting for a routine clinic.'],
  ]) {
    run(
      database,
      `INSERT INTO health_articles (category_id, title, summary, content, status, created_by, published_at, is_demo)
       SELECT c.id, ?, ?, ?, 'PUBLISHED', u.id, CURRENT_TIMESTAMP, 1
       FROM health_categories c CROSS JOIN users u
       WHERE c.name = ? AND u.email = ?
         AND NOT EXISTS (SELECT 1 FROM health_articles existing WHERE existing.title = ?)`,
      [article[1], article[2], article[3], article[0], 'admin.demo@epithyia.local', article[1]],
      { save },
    );
  }

  for (const [oldTitle, title, summary, content] of [
    ['[DEMO ONLY] Exploring the information library', 'Explore the health information library', 'An overview of the health information library and how its content is reviewed.', 'EPITHYIA GROUP provides a community-oriented health information library. Articles are prepared by authorized editors and should be reviewed by qualified local health authorities before publication.'],
    ['[DEMO ONLY] About the EPITHYIA GROUP project', 'About EPITHYIA GROUP', 'Learn about the community-oriented health information platform.', 'EPITHYIA GROUP is a community-oriented health information platform designed to make reviewed information easier to access.'],
    ['[DEMO ONLY] Planned access channels', 'Access health information', 'Explore web and mobile access to public information.', 'The platform offers a public web library and an interactive phone-style menu for public hospital-directory information. Live mobile-network access depends on provider integration.'],
  ]) {
    run(
      database,
      'UPDATE health_articles SET title = ?, summary = ?, content = ? WHERE title = ? AND is_demo = 1',
      [title, summary, content, oldTitle],
      { save },
    );
  }

  run(
    database,
    `UPDATE health_articles SET is_demo = 1
     WHERE title IN (
       '[DEMO ONLY] Exploring the information library',
       '[DEMO ONLY] About the EPITHYIA GROUP project',
       '[DEMO ONLY] Planned access channels'
     )`,
    [],
    { save },
  );
  const hospitals = [
    [
      'mengo-hospital',
      'Mengo Hospital',
      'Mengo, Kampala, Uganda',
      'Sir Albert Cook Road, Mengo, Kampala, Uganda; P.O. Box 7161',
      '+256 771 370 263; +256 771 370 264; +256 757 143 951; +256 757 143 961; +256 312 307 100',
      'A Kampala hospital on Sir Albert Cook Road in Mengo.',
      'Accident and Emergency is advertised as 24/7. Clinic hours vary; call the hospital to confirm.',
      'No separate emergency number is published. Call the main hospital line and ask for Accident and Emergency.',
    ],
    [
      'rubaga-hospital',
      'Rubaga Hospital',
      'Lubaga Hill, Kampala, Uganda',
      'Next to Lubaga Cathedral, Lubaga Hill, Kampala, Uganda; P.O. Box 14130',
      '+256 200 244 800',
      'A tertiary hospital located beside Lubaga Cathedral on Lubaga Hill.',
      'The hospital contact page states 24/7 service; KCCA lists the emergency department as 24/7. Clinic hours may vary.',
      'No separate emergency number is published. Call +256 200 244 800 and ask for the emergency department.',
    ],
    [
      'old-kampala-hospital',
      'Old Kampala Hospital',
      'Old Kampala Hill, Kampala, Uganda',
      'Old Kampala Hill, opposite Old Kampala Police Post, Kampala, Uganda',
      '+256 752 024 333',
      'A hospital located on Old Kampala Hill, opposite the Old Kampala Police Post.',
      'The hospital advertises 24/7 service and a 24-hour Accident and Emergency unit. Clinic hours vary.',
      '+256 752 024 333 (published by the hospital for emergency care).',
    ],
    [
      'kibuli-hospital',
      'Kibuli Muslim Hospital',
      'Kibuli Hill, Makindye Division, Kampala, Uganda',
      'Kibuli Hill, off Prince Badru Kakungulu Road, Kampala, Uganda; P.O. Box 24548',
      '+256 414 236 476/7; +256 702 542 719',
      'A hospital on Kibuli Hill in Makindye Division, off Prince Badru Kakungulu Road.',
      'Emergency services are listed as 24/7 by KCCA. General and outpatient clinic hours are not published; call to confirm.',
      '+256 414 236 476/7 (published by the hospital as its emergency call number).',
    ],
    [
      'mulago-hospital',
      'Mulago National Referral Hospital',
      'Mulago Hill, Kawempe North Division, Kampala, Uganda',
      'Mulago Hill, Kawempe North Division, Kampala, Uganda; P.O. Box 7051',
      '+256 414 554 008; +256 414 554 001',
      'Uganda’s national referral hospital, located on Mulago Hill in Kawempe North Division.',
      'Medical Emergency, surgical Accident and Emergency, and paediatric Acute Care operate 24/7. Assessment-centre walk-in clinics run during regular working hours; specialist schedules vary.',
      'Medical Emergency: +256 414 675 065; Acute Care Unit: +256 414 675 066.',
    ],
    [
      'nakasero-hospital',
      'Nakasero Hospital',
      'Nakasero, Kampala, Uganda',
      '14A Akii Bua Road, Nakasero, Kampala, Uganda',
      '+256 312 531 400; +256 800 200 035; +256 776 970 220',
      'A private general hospital on Akii Bua Road in Nakasero, Kampala.',
      'The hospital describes 24/7 emergency support. Call ahead to confirm outpatient clinic schedules and service availability.',
      'The hospital provides 24/7 support. Call +256 312 531 400 or +256 800 200 035 and ask for the emergency department.',
    ],
  ];
  for (const hospital of hospitals) {
    run(
      database,
      `INSERT OR IGNORE INTO hospitals
       (slug, name, location, address, phone, description, operating_info, emergency_contact, status, image_path, is_verified, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 1, 1)`,
      [
        hospital[0],
        hospital[1],
        hospital[2],
        hospital[3],
        hospital[4],
        hospital[5],
        hospital[6],
        hospital[7],
        HOSPITAL_IMAGE_URLS[hospital[0]],
      ],
      { save },
    );
    run(
      database,
      `UPDATE hospitals
       SET name = ?, location = ?, address = ?, phone = ?, description = ?, image_path = ?,
           operating_info = ?, emergency_contact = ?, is_verified = 1, is_demo = 1
       WHERE slug = ?`,
      [
        hospital[1],
        hospital[2],
        hospital[3],
        hospital[4],
        hospital[5],
        HOSPITAL_IMAGE_URLS[hospital[0]],
        hospital[6],
        hospital[7],
        hospital[0],
      ],
      { save },
    );
  }

  run(
    database,
    'DELETE FROM hospital_services WHERE is_demo = 1',
    [],
    { save },
  );
  const hospitalServices = [
    ['mengo-hospital', 'Internal medicine', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Surgery', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Eye care', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Obstetrics and gynecology', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Paediatrics', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Dental care', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Endocrinology and non-communicable diseases', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Pathology', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Outpatient care', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Public health and research', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Laboratory', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Mental health', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Accident and Emergency', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Intensive care', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Ambulance', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Blood bank', 'https://mengohospital.org/services/'],
    ['mengo-hospital', 'Urology', 'https://mengohospital.org/services/'],
    ['rubaga-hospital', 'Cardiology', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Surgery', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Dialysis and transplant care', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'CT and MRI imaging', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Intensive care', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Maternity and paediatrics', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'ENT and neurosurgery', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Dental care', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['rubaga-hospital', 'Emergency department', 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'],
    ['old-kampala-hospital', 'Diagnostics and therapeutics', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', 'Eye care', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', 'Dental care', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', 'Primary care and medicine', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', 'Obstetrics and gynecology', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', 'Surgical services and neurosurgery', 'https://oldkampalahospital.org/'],
    ['old-kampala-hospital', '24-hour Accident and Emergency', 'https://oldkampalahospital.org/'],
    ['kibuli-hospital', 'Infectious disease and HIV clinic', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Pharmacy', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Paediatrics', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Eye centre', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Surgery and theatre', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Radiology and imaging', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Physiotherapy', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Dental clinic', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Laboratory', 'https://kibulimuslimhospital.ug/services/'],
    ['kibuli-hospital', 'Emergency, inpatient and outpatient care', 'https://visitkampala.kcca.go.ug/business_details/kibuli-hospital'],
    ['kibuli-hospital', 'Maternity and dialysis', 'https://visitkampala.kcca.go.ug/business_details/kibuli-hospital'],
    ['mulago-hospital', 'Paediatrics', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'Surgery', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'Internal medicine', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'Radiology and imaging', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'Clinical laboratory and pathology', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'Nuclear medicine', 'https://mulagohospital.go.ug/'],
    ['mulago-hospital', 'ENT and neurology', 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'],
    ['mulago-hospital', 'Rheumatology and renal dialysis', 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'],
    ['mulago-hospital', 'Orthopedics', 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'],
    ['mulago-hospital', 'Obstetrics, gynecology and neonatology', 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'],
    ['mulago-hospital', 'Medical Emergency and Accident and Emergency', 'https://mulagohospital.go.ug/contact2.html'],
    ['nakasero-hospital', 'Outpatient and inpatient care', 'https://nakaserohospital.com/patient-support/'],
    ['nakasero-hospital', 'Emergency and critical care', 'https://nakaserohospital.com/patient-support/'],
    ['nakasero-hospital', 'Surgery', 'https://nakaserohospital.com/'],
    ['nakasero-hospital', 'Maternity and neonatal care', 'https://nakaserohospital.com/'],
    ['nakasero-hospital', 'Diagnostics and imaging', 'https://nakaserohospital.com/'],
    ['nakasero-hospital', 'Laboratory and pharmacy', 'https://visitkampala.kcca.go.ug/business_details/nakasero-hospital'],
    ['nakasero-hospital', 'Specialist care', 'https://nakaserohospital.com/'],
    ['nakasero-hospital', 'Physiotherapy and rehabilitation', 'https://nakaserohospital.com/'],
  ];
  for (const [slug, service, source] of hospitalServices) {
    run(
      database,
      `INSERT OR IGNORE INTO hospital_services (hospital_id, service_name, is_verified, source_url, is_demo)
       SELECT id, ?, 1, ?, 1 FROM hospitals WHERE slug = ?`,
      [service, source, slug],
      { save },
    );
    run(
      database,
      `UPDATE hospital_services SET is_verified = 1, source_url = ?, is_demo = 1
       WHERE hospital_id = (SELECT id FROM hospitals WHERE slug = ?)
         AND service_name = ? AND is_demo = 1`,
      [source, slug, service],
      { save },
    );
  }

  for (const [key, menuText] of [
    ['HOME', [
      'EPITHYIA HEALTH DIRECTORY',
      '1. Hospital directory',
      '2. Hospital details',
      '3. Health guides on the website',
      '4. Emergency contacts',
      '5. About this guide',
      '6. Help',
      '0. End',
    ].join('\n')],
    ['HELP', '1/2: Hospitals. Choose 1-6, then 1 phone 2 address 3 services 4 hours 5 emergency. 0 Back; 00 Main; 9 End.'],
  ]) {
    run(database, 'INSERT OR REPLACE INTO ussd_menu_configs (menu_key, menu_text) VALUES (?, ?)', [key, menuText], { save });
  }
}

function persist(database) {
  const temporaryFile = `${databaseFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, Buffer.from(database.export()));
  fs.renameSync(temporaryFile, databaseFile);
}

function normalizeError(error) {
  if (/UNIQUE constraint failed/i.test(error.message)) error.code = 'ER_DUP_ENTRY';
  else if (/FOREIGN KEY constraint failed/i.test(error.message)) error.code = 'ER_ROW_IS_REFERENCED_2';
  return error;
}

function run(database, sql, parameters = [], { save = true } = {}) {
  const compatibleSql = sql.replace(/\s+FOR UPDATE\b/gi, '');
  let statement;
  try {
    statement = database.prepare(compatibleSql);
    statement.bind(parameters);
    const columns = statement.getColumnNames();
    if (columns.length > 0) {
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return [rows, []];
    }

    statement.step();
    const result = {
      insertId: Number(database.exec('SELECT last_insert_rowid()')[0].values[0][0]),
      affectedRows: database.getRowsModified(),
    };
    if (save) persist(database);
    return [result, []];
  } catch (error) {
    throw normalizeError(error);
  } finally {
    if (statement) statement.free();
  }
}

async function execute(sql, parameters = []) {
  return run(await ready, sql, parameters);
}

async function query(sql, parameters = []) {
  return execute(sql, parameters);
}

async function getConnection() {
  const database = await ready;
  return {
    async beginTransaction() {
      database.run('BEGIN IMMEDIATE');
    },
    async execute(sql, parameters = []) {
      return run(database, sql, parameters, { save: false });
    },
    async commit() {
      database.run('COMMIT');
      persist(database);
    },
    async rollback() {
      database.run('ROLLBACK');
    },
    release() {},
  };
}

async function end() {
  const database = await ready;
  persist(database);
  database.close();
}

async function clearDemoSessions() {
  const database = await ready;
  database.run('BEGIN IMMEDIATE');
  let committed = false;
  try {
    database.run('DELETE FROM ussd_session_events');
    database.run('DELETE FROM ussd_sessions');
    database.run('COMMIT');
    committed = true;
    persist(database);
  } catch (error) {
    if (!committed) database.run('ROLLBACK');
    throw error;
  }
}

async function resetDemoData() {
  const database = await ready;
  database.run('BEGIN IMMEDIATE');
  let committed = false;
  try {
    database.run('DELETE FROM ussd_session_events');
    database.run('DELETE FROM ussd_sessions');
    database.run('DELETE FROM audit_logs');
    database.run('DELETE FROM appointments WHERE is_demo = 1');
    database.run('DELETE FROM hospital_services WHERE is_demo = 1');
    database.run('DELETE FROM hospitals WHERE is_demo = 1');
    database.run('DELETE FROM health_articles WHERE is_demo = 1');
    database.run('DELETE FROM health_categories WHERE is_demo = 1');
    database.run('DELETE FROM users WHERE is_demo = 1');
    await seedDefaults(database, { save: false });
    run(
      database,
      `INSERT INTO audit_logs (user_id, action, entity, details)
       SELECT id, 'DEMO_RESET', 'demo_data', 'Demo records restored'
       FROM users WHERE email = 'admin.demo@epithyia.local' LIMIT 1`,
      [],
      { save: false },
    );
    database.run('COMMIT');
    committed = true;
    persist(database);
  } catch (error) {
    if (!committed) database.run('ROLLBACK');
    throw normalizeError(error);
  }
}

module.exports = {
  execute,
  query,
  getConnection,
  end,
  ready,
  databaseFile,
  clearDemoSessions,
  resetDemoData,
};
