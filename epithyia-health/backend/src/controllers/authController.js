const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { recordAudit } = require('../utils/audit');
const { signAccessToken } = require('../middleware/auth');
const {
  normalizeEmail,
  validatePassword,
  validateRegistration,
} = require('../validators/auth');

const BCRYPT_ROUNDS = 12;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

function sendUnexpectedError(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

async function register(req, res) {
  const { errors, value } = validateRegistration(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Invalid registration details.', errors });
  }

  try {
    const passwordHash = await bcrypt.hash(value.password, BCRYPT_ROUNDS);
    const [roles] = await pool.execute('SELECT id FROM roles WHERE name = ? LIMIT 1', ['USER']);
    if (roles.length === 0) {
      return res.status(500).json({ success: false, message: 'User registration is not configured.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, phone, password_hash, role_id, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [value.name, value.email, value.phone, passwordHash, roles[0].id],
    );
    const user = {
      id: result.insertId,
      name: value.name,
      email: value.email,
      phone: value.phone,
      role: 'USER',
    };
    await recordAudit({ userId: user.id, action: 'REGISTER', entity: 'users', entityId: user.id, details: { role: 'USER' } });
    return res.status(201).json({ success: true, data: { user } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'An account with that email or phone already exists.' });
    }
    return sendUnexpectedError(res, error, 'Registration failed');
  }
}

async function login(req, res) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ success: false, message: 'A valid email and password are required.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, r.name AS role
       FROM users AS u INNER JOIN roles AS r ON r.id = u.role_id
       WHERE u.email = ? LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      await bcrypt.compare(password, '$2b$12$kKQXYv.VwcB.acSqURxwoOqXaWybZoSX68hMxXqQoPcMr6CgPjcQW');
      await recordAudit({ action: 'LOGIN_FAILED', entity: 'users', details: { email } });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await recordAudit({ userId: user.id, action: 'LOGIN_FAILED', entity: 'users', entityId: user.id, details: { reason: 'invalid_credentials' } });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (user.status !== 'ACTIVE') {
      await recordAudit({ userId: user.id, action: 'LOGIN_FAILED', entity: 'users', entityId: user.id, details: { reason: 'inactive_account' } });
      return res.status(403).json({ success: false, message: 'This account is inactive.' });
    }

    const token = signAccessToken(user);
    await recordAudit({ userId: user.id, action: 'LOGIN_SUCCESS', entity: 'users', entityId: user.id });
    return res.status(200).json({ success: true, data: { token, user: publicUser(user) } });
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    return sendUnexpectedError(res, error, 'Login failed');
  }
}

async function logout(req, res) {
  await recordAudit({ userId: req.user.id, action: 'LOGOUT', entity: 'users', entityId: req.user.id });
  return res.status(200).json({
    success: true,
    data: { message: 'Logged out. Remove the Bearer token from the client; this stateless token remains valid until it expires.' },
  });
}

function me(req, res) {
  return res.status(200).json({ success: true, data: { user: req.user } });
}

async function changePassword(req, res) {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  if (typeof currentPassword !== 'string' || currentPassword.length === 0 || !validatePassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: 'Current password is required; new password must be 12–72 UTF-8 bytes and include lowercase, uppercase, numeric, and symbol characters.',
    });
  }

  try {
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    }
    if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    await recordAudit({ userId: req.user.id, action: 'PASSWORD_CHANGED', entity: 'users', entityId: req.user.id });
    return res.status(200).json({ success: true, data: { message: 'Password changed. Sign in again after removing the current token from your client.' } });
  } catch (error) {
    return sendUnexpectedError(res, error, 'Password change failed');
  }
}

module.exports = { register, login, logout, me, changePassword };