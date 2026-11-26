const pool = require('../config/database');

async function recordAudit({ userId = null, action, entity, entityId = null, details = {} }) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entity, entityId, JSON.stringify(details)],
    );
  } catch (error) {
    // Audit trouble must not expose secrets or turn an otherwise safe response into a failure.
    console.error(`Audit log write failed for ${action}: ${error.message}`);
  }
}

module.exports = { recordAudit };