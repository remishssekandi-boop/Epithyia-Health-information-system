const pool = require('../config/database');
const { withTransaction } = require('../services/database');
const { recordAudit } = require('../utils/audit');
const { normalizeEmail, normalizePhone, validateName, validateProfile } = require('../validators/auth');

const SAFE_USER_SELECT = `SELECT u.id, u.name, u.email, u.phone, u.status, r.name AS role, u.created_at, u.updated_at
  FROM users AS u INNER JOIN roles AS r ON r.id = u.role_id`;
const VALID_ROLES = new Set(['ADMIN', 'CONTENT_MANAGER', 'HEALTH_WORKER', 'USER']);

function sendUnexpectedError(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

function parseUserId(value) {
  if (!/^\d+$/.test(value || '')) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateEditableUser(body) {
  const errors = [];
  const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['A JSON object is required.'], value };
  }
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!validateName(name)) errors.push('Name must be between 2 and 150 characters.');
    else value.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const email = normalizeEmail(body.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('A valid email address is required.');
    else value.email = email;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    const phone = normalizePhone(body.phone);
    if (!phone) errors.push('A valid phone number is required.');
    else value.phone = phone;
  }
  const protectedFields = ['role', 'role_id', 'status', 'password', 'password_hash'];
  if (protectedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    errors.push('Use the dedicated status or role endpoint; passwords cannot be changed here.');
  }
  if (Object.keys(value).length === 0 && errors.length === 0) errors.push('Provide at least one profile field to update.');
  return { errors, value };
}

async function getOwnProfile(req, res) {
  return res.status(200).json({ success: true, data: { user: req.user } });
}

async function updateOwnProfile(req, res) {
  const { errors, value } = validateProfile(req.body);
  if (errors.length > 0) return res.status(400).json({ success: false, message: 'Invalid profile update.', errors });

  const fields = Object.keys(value);
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  try {
    await pool.execute(`UPDATE users SET ${assignments} WHERE id = ?`, [...fields.map((field) => value[field]), req.user.id]);
    const [rows] = await pool.execute(`${SAFE_USER_SELECT} WHERE u.id = ?`, [req.user.id]);
    await recordAudit({ userId: req.user.id, action: 'PROFILE_UPDATED', entity: 'users', entityId: req.user.id, details: { fields } });
    return res.status(200).json({ success: true, data: { user: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That phone number is already in use.' });
    return sendUnexpectedError(res, error, 'Own profile update failed');
  }
}

async function listUsers(req, res) {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  try {
    const [users] = await pool.execute(`${SAFE_USER_SELECT} ORDER BY u.id LIMIT ? OFFSET ?`, [limit, offset]);
    return res.status(200).json({ success: true, data: { users, pagination: { limit, offset } } });
  } catch (error) {
    return sendUnexpectedError(res, error, 'User list failed');
  }
}

async function getUser(req, res) {
  const id = parseUserId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'User ID must be a positive integer.' });
  try {
    const [rows] = await pool.execute(`${SAFE_USER_SELECT} WHERE u.id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: { user: rows[0] } });
  } catch (error) {
    return sendUnexpectedError(res, error, 'User lookup failed');
  }
}

async function updateUser(req, res) {
  const id = parseUserId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'User ID must be a positive integer.' });
  const { errors, value } = validateEditableUser(req.body);
  if (errors.length > 0) return res.status(400).json({ success: false, message: 'Invalid user update.', errors });

  const fields = Object.keys(value);
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  try {
    const [result] = await pool.execute(`UPDATE users SET ${assignments} WHERE id = ?`, [...fields.map((field) => value[field]), id]);
    if (result.affectedRows === 0) {
      const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const [rows] = await pool.execute(`${SAFE_USER_SELECT} WHERE u.id = ?`, [id]);
    await recordAudit({ userId: req.user.id, action: 'USER_UPDATED', entity: 'users', entityId: id, details: { fields } });
    return res.status(200).json({ success: true, data: { user: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That email or phone is already in use.' });
    return sendUnexpectedError(res, error, 'User update failed');
  }
}

async function lockUser(connection, id) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.status, r.name AS role FROM users AS u
     INNER JOIN roles AS r ON r.id = u.role_id WHERE u.id = ? FOR UPDATE`,
    [id],
  );
  return rows[0] || null;
}

async function ensureOtherActiveAdmin(connection, excludedId) {
  const [admins] = await connection.execute(
    `SELECT u.id FROM users AS u INNER JOIN roles AS r ON r.id = u.role_id
     WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE' FOR UPDATE`,
  );
  if (!admins.some((admin) => Number(admin.id) !== excludedId)) {
    const error = new Error('This action would remove the last active administrator.');
    error.status = 409;
    throw error;
  }
}

async function updateUserStatus(req, res, forcedStatus = null) {
  const id = parseUserId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'User ID must be a positive integer.' });
  const status = forcedStatus || req.body?.status;
  if (status !== 'ACTIVE' && status !== 'INACTIVE') {
    return res.status(400).json({ success: false, message: 'Status must be ACTIVE or INACTIVE.' });
  }

  try {
    const previous = await withTransaction(async (connection) => {
      const user = await lockUser(connection, id);
      if (!user) {
        const error = new Error('User not found.');
        error.status = 404;
        throw error;
      }
      if (user.role === 'ADMIN' && user.status === 'ACTIVE' && status === 'INACTIVE') {
        await ensureOtherActiveAdmin(connection, id);
      }
      await connection.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
      return user;
    });
    const action = status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
    await recordAudit({ userId: req.user.id, action, entity: 'users', entityId: id, details: { previous_status: previous.status, status } });
    const [rows] = await pool.execute(`${SAFE_USER_SELECT} WHERE u.id = ?`, [id]);
    return res.status(200).json({ success: true, data: { user: rows[0] } });
  } catch (error) {
    if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ success: false, message: error.message });
    return sendUnexpectedError(res, error, 'User status update failed');
  }
}

async function setUserStatus(req, res) {
  return updateUserStatus(req, res);
}

async function changeUserRole(req, res) {
  const id = parseUserId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'User ID must be a positive integer.' });
  const roleName = req.body?.role;
  if (!VALID_ROLES.has(roleName)) {
    return res.status(400).json({ success: false, message: 'Role must be ADMIN, CONTENT_MANAGER, HEALTH_WORKER, or USER.' });
  }

  try {
    const previous = await withTransaction(async (connection) => {
      const user = await lockUser(connection, id);
      if (!user) {
        const error = new Error('User not found.');
        error.status = 404;
        throw error;
      }
      if (user.role === 'ADMIN' && user.status === 'ACTIVE' && roleName !== 'ADMIN') {
        await ensureOtherActiveAdmin(connection, id);
      }
      const [roles] = await connection.execute('SELECT id FROM roles WHERE name = ? LIMIT 1', [roleName]);
      if (roles.length === 0) {
        const error = new Error('Requested role is not configured.');
        error.status = 400;
        throw error;
      }
      await connection.execute('UPDATE users SET role_id = ? WHERE id = ?', [roles[0].id, id]);
      return user;
    });
    await recordAudit({ userId: req.user.id, action: 'ROLE_CHANGED', entity: 'users', entityId: id, details: { previous_role: previous.role, role: roleName } });
    const [rows] = await pool.execute(`${SAFE_USER_SELECT} WHERE u.id = ?`, [id]);
    return res.status(200).json({ success: true, data: { user: rows[0] } });
  } catch (error) {
    if ([400, 404, 409].includes(error.status)) return res.status(error.status).json({ success: false, message: error.message });
    return sendUnexpectedError(res, error, 'User role update failed');
  }
}

async function deactivateUser(req, res) {
  return updateUserStatus(req, res, 'INACTIVE');
}

module.exports = {
  getOwnProfile,
  updateOwnProfile,
  listUsers,
  getUser,
  updateUser,
  setUserStatus,
  changeUserRole,
  deactivateUser,
};