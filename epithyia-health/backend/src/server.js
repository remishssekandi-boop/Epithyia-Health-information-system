const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('./app');
const pool = require('./config/database');

const port = Number(process.env.PORT || 3000);
let server;

async function start() {
  if (process.env.DATABASE_MODE === 'demo' && pool.ready) await pool.ready;

  server = app.listen(port, () => {
    console.log(`Epithyia Health API listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
  });
}

function shutDown(signal) {
  console.log(`${signal} received; closing the HTTP server.`);
  if (!server) {
    pool.end()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`Error closing the database pool: ${error.message}`);
        process.exit(1);
      });
    return;
  }
  server.close(() => {
    pool.end()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`Error closing the database pool: ${error.message}`);
        process.exit(1);
      });
  });
}

process.on('SIGINT', () => shutDown('SIGINT'));
process.on('SIGTERM', () => shutDown('SIGTERM'));

start().catch((error) => {
  console.error(`Application startup failed: ${error.message}`);
  process.exitCode = 1;
});
