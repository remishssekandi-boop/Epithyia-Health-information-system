const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = require('../src/config/database');
const requiredTables = [
  'roles',
  'users',
  'health_categories',
  'health_articles',
  'sms_messages',
  'ussd_sessions',
  'ussd_session_events',
  'ussd_menu_configs',
  'hospitals',
  'hospital_services',
  'appointments',
  'notifications',
  'audit_logs',
  'system_settings',
];

async function main() {
  try {
    await pool.query('SELECT 1');
    console.log('DATABASE CONNECTION: OK');

    const [tableRows] = await pool.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [process.env.DB_NAME || 'epithyia_health'],
    );
    const actualTables = new Set(tableRows.map((row) => row.TABLE_NAME));
    const missingTables = requiredTables.filter((table) => !actualTables.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
    console.log(`TABLES: OK (${requiredTables.length} required tables)`);

    const [roleRows] = await pool.execute(
      'SELECT name FROM roles WHERE name IN (?, ?, ?, ?)',
      ['ADMIN', 'CONTENT_MANAGER', 'HEALTH_WORKER', 'USER'],
    );
    if (roleRows.length !== 4) {
      throw new Error(`Expected 4 required roles; found ${roleRows.length}. Run npm run db:seed.`);
    }
    console.log('ROLES: OK (ADMIN, CONTENT_MANAGER, HEALTH_WORKER, USER)');

    const [[sampleCounts]] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM health_categories) AS categories,
         (SELECT COUNT(*) FROM health_articles WHERE title LIKE '[DEMO ONLY]%' AND status = 'DRAFT') AS articles,
         (SELECT COUNT(*) FROM users WHERE email IN (?, ?, ?, ?) AND password_hash LIKE '$2%') AS hashed_demo_users`,
      [
        'admin.demo@epithyia.local',
        'content.demo@epithyia.local',
        'worker.demo@epithyia.local',
        'user.demo@epithyia.local',
      ],
    );
    if (Number(sampleCounts.categories) < 9 || Number(sampleCounts.articles) < 9) {
      throw new Error(`Expected at least 9 sample categories/articles; found ${sampleCounts.categories} categories and ${sampleCounts.articles} articles. Run npm run db:seed.`);
    }
    if (Number(sampleCounts.hashed_demo_users) !== 4) {
      throw new Error('Expected four demonstration users with bcrypt hashes. Run npm run db:seed.');
    }
    console.log(`SAMPLE DATA: OK (${sampleCounts.categories} categories, ${sampleCounts.articles} draft articles, bcrypt demo accounts)`);

    const [hospitals] = await pool.execute(
      `SELECT slug FROM hospitals
       WHERE slug IN (?, ?, ?, ?, ?, ?)
       ORDER BY FIELD(slug, ?, ?, ?, ?, ?, ?)`,
      [
        'mengo-hospital',
        'rubaga-hospital',
        'old-kampala-hospital',
        'kibuli-hospital',
        'mulago-hospital',
        'nakasero-hospital',
        'mengo-hospital',
        'rubaga-hospital',
        'old-kampala-hospital',
        'kibuli-hospital',
        'mulago-hospital',
        'nakasero-hospital',
      ],
    );
    if (hospitals.length !== 6) {
      throw new Error(`Expected exactly six seeded hospitals; found ${hospitals.length}. Run npm run db:seed.`);
    }
    console.log('HOSPITALS: OK (six seeded directory entries)');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`DATABASE VERIFICATION: FAILED — ${error.message}`);
  process.exitCode = 1;
});