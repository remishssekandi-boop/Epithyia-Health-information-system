const fs = require('node:fs/promises');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseName = process.env.DB_NAME || 'epithyia_health';
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

const schemaOnly = process.argv.includes('--schema-only');
const seedOnly = process.argv.includes('--seed-only');
if (schemaOnly && seedOnly) {
  throw new Error('Choose either --schema-only or --seed-only, not both.');
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    if (!seedOnly) {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await connection.changeUser({ database: databaseName });
      const schema = await fs.readFile(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
      await connection.query(schema);
      const migrationsDirectory = path.resolve(__dirname, '../database/migrations');
      try {
        const migrations = (await fs.readdir(migrationsDirectory))
          .filter((name) => name.endsWith('.sql'))
          .sort();
        for (const migrationName of migrations) {
          const migration = await fs.readFile(path.join(migrationsDirectory, migrationName), 'utf8');
          await connection.query(migration);
          console.log(`MIGRATION: OK (${migrationName})`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      console.log(`SCHEMA: OK (${databaseName})`);
    } else {
      await connection.changeUser({ database: databaseName });
    }

    if (!schemaOnly) {
      const seed = await fs.readFile(path.resolve(__dirname, '../database/seed.sql'), 'utf8');
      await connection.query(seed);
      console.log(`SEED DATA: OK (${databaseName})`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`DATABASE SETUP: FAILED — ${error.message}`);
  process.exitCode = 1;
});