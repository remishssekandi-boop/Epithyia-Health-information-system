const pool = require('../config/database');

/** Run a parameterized query through the shared MySQL connection pool. */
function query(sql, parameters = []) {
  return pool.execute(sql, parameters);
}

/**
 * Run an async callback in a transaction. The callback receives a dedicated
 * connection and should use connection.execute(sql, parameters) for queries.
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { query, withTransaction };