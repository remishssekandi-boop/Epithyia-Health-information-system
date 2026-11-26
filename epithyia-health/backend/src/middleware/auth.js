const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /placeholder|replace|change.?me/i.test(secret)) {
    const error = new Error('Authentication is not configured. Set JWT_SECRET to a random value of at least 32 characters.');
    error.status = 503;
    throw error;
  }
  return secret;
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id) },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'epithyia-health-api',
      audience: 'epithyia-health-client',
    },
  );
}

async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Authentication required. Provide a Bearer token.' });
  }

  try {
    const decoded = jwt.verify(match[1], getJwtSecret(), {
      issuer: 'epithyia-health-api',
      audience: 'epithyia-health-client',
      algorithms: ['HS256'],
    });
    const id = Number(decoded.sub);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
    }

    const demoUserField = process.env.DATABASE_MODE === 'demo' ? ', u.is_demo' : '';
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.status${demoUserField}, r.name AS role
       FROM users AS u INNER JOIN roles AS r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'The account for this token no longer exists.' });
    }
    if (rows[0].status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'This account is inactive.' });
    }

    req.user = rows[0];
    return next();
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
    }
    console.error(`Authentication check failed: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Unable to verify authentication.' });
  }
}

function optionalAuth(req, res, next) {
  if (!req.get('Authorization')) return next();
  return requireAuth(req, res, next);
}

function requireRole(...roles) {
  const allowedRoles = new Set(roles);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!allowedRoles.has(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, signAccessToken, getJwtSecret };