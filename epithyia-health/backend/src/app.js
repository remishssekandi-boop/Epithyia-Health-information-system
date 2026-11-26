const express = require('express');
const path = require('node:path');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const healthRoutes = require('./routes/healthRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const ussdRoutes = require('./routes/ussdRoutes');
const demoRoutes = require('./routes/demoRoutes');

const app = express();

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'epithyia-health-api',
      databaseMode: process.env.DATABASE_MODE || 'mysql',
      timestamp: new Date().toISOString(),
    },
  });
});

// This separate probe checks MySQL without preventing the API server from starting.
app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        database: process.env.DATABASE_MODE === 'demo' ? 'demo' : 'connected',
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database unavailable. Check the MySQL service and database environment settings.',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/ussd', ussdRoutes);
app.use('/api/demo', demoRoutes);

app.get(/^\/(about|article|contact|dashboard|health-information|hospital|hospitals|index|login|register|ussd)\.html$/, (req, res) => {
  const page = req.path.slice(1, -5);
  return res.redirect(301, `/${page}.php${req.url.slice(req.path.length)}`);
});

// Keep PHP-extension pages static HTML so local Node serving stays as lightweight as before.
const frontendDirectory = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDirectory, {
  extensions: ['php'],
  index: 'index.php',
  setHeaders(res, filePath) {
    if (path.extname(filePath).toLowerCase() === '.php') res.type('html');
  },
}));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (process.env.NODE_ENV === 'production') {
    console.error(`Request failed (${status}): ${error.message}`);
  } else {
    console.error(error);
  }
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred.'
    : error.message;

  res.status(status).json({ success: false, message });
});

module.exports = app;
