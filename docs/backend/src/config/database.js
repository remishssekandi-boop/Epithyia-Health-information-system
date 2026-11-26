const mode = process.env.DATABASE_MODE || 'mysql';

if (mode === 'demo') {
  module.exports = require('./demoDatabase');
} else if (mode === 'mysql') {
  const mysql = require('mysql2/promise');

  module.exports = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'epithyia_health',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
} else {
  throw new Error('DATABASE_MODE must be either "mysql" or "demo".');
}
