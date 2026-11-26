const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const UGANDA_LOCAL_PATTERN = /^0(?:7|3)\d{8}$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (UGANDA_LOCAL_PATTERN.test(compact)) return `+256${compact.slice(1)}`;
  if (/^256[1-9]\d{7,11}$/.test(compact)) return `+${compact}`;
  if (E164_PATTERN.test(compact)) return compact;
  return null;
}

function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 150;
}

function validatePassword(password) {
  if (typeof password !== 'string') return false;
  const byteLength = Buffer.byteLength(password, 'utf8');
  return password.length >= 12
    && byteLength <= 72
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function validateRegistration(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body?.email);
  const phone = normalizePhone(body?.phone);

  if (!validateName(name)) errors.push('Name must be between 2 and 150 characters.');
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) errors.push('A valid email address is required.');
  if (!phone) errors.push('A valid phone number is required (use international format or a Ugandan local number).');
  if (!validatePassword(body?.password)) {
    errors.push('Password must be 12–72 UTF-8 bytes and include lowercase, uppercase, numeric, and symbol characters.');
  }
  if (['role', 'role_id', 'status', 'password_hash'].some((field) => Object.prototype.hasOwnProperty.call(body || {}, field))) {
    errors.push('Role and account status are assigned by the system during public registration.');
  }

  return { errors, value: { name, email, phone, password: body?.password } };
}

function validateProfile(body) {
  const errors = [];
  const value = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!validateName(name)) errors.push('Name must be between 2 and 150 characters.');
    else value.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'phone')) {
    const phone = normalizePhone(body.phone);
    if (!phone) errors.push('A valid phone number is required.');
    else value.phone = phone;
  }
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push('Provide at least one editable profile field: name or phone.');
  }
  const forbidden = ['role', 'role_id', 'status', 'password', 'password_hash', 'email'];
  if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(body || {}, key))) {
    errors.push('Role, status, email, and password cannot be changed through profile updates.');
  }
  return { errors, value };
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  validatePassword,
  validateRegistration,
  validateProfile,
};