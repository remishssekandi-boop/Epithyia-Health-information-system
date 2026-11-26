const pool = require('../config/database');

function requireDemoMode(res) {
  if (process.env.DATABASE_MODE === 'demo' && typeof pool.resetDemoData === 'function') return true;
  res.status(404).json({ success: false, message: 'Demo controls are available only in SQLite demo mode.' });
  return false;
}

function sendError(res, error, context) {
  if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(409).json({
      success: false,
      message: 'Demo data is referenced by a non-demo record and was not reset. No data was removed.',
    });
  }
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'The workspace operation could not be completed.' });
}

async function activity(req, res) {
  if (!requireDemoMode(res)) return;
  try {
    const [audit] = await pool.execute(
      `SELECT action, entity, entity_id, created_at
       FROM audit_logs ORDER BY id DESC LIMIT 50`,
    );
    const [ussd] = await pool.execute(
      `SELECT menu, selection, created_at
       FROM ussd_session_events ORDER BY id DESC LIMIT 50`,
    );
    return res.status(200).json({ success: true, data: { audit, ussd } });
  } catch (error) {
    return sendError(res, error, 'Loading demo activity failed');
  }
}

async function clearSessions(req, res) {
  if (!requireDemoMode(res)) return;
  try {
    await pool.clearDemoSessions();
    return res.status(200).json({ success: true, data: { message: 'USSD sessions and history cleared.' } });
  } catch (error) {
    return sendError(res, error, 'Clearing demo sessions failed');
  }
}

async function reset(req, res) {
  if (!requireDemoMode(res)) return;
  try {
    await pool.resetDemoData();
    return res.status(200).json({
      success: true,
      data: { message: 'Starter records restored. Sign in again to continue.' },
    });
  } catch (error) {
    return sendError(res, error, 'Resetting demo data failed');
  }
}

module.exports = { activity, clearSessions, reset };
