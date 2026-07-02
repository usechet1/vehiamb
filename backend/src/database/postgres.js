const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool({
  connectionString: env.databaseUrl
});

function toPostgresParams(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function all(sql, params = []) {
  const result = await pool.query(toPostgresParams(sql), params);
  return result.rows;
}

async function get(sql, params = []) {
  const result = await pool.query(toPostgresParams(sql), params);
  return result.rows[0] || null;
}

async function run(sql, params = []) {
  const result = await pool.query(toPostgresParams(sql), params);
  return {
    changes: result.rowCount,
    lastID: result.rows[0]?.id || null
  };
}

async function close(callback) {
  await pool.end();
  if (callback) callback();
}

/**
 * Ejecuta "fn" dentro de una transaccion (BEGIN/COMMIT/ROLLBACK) sobre un
 * unico cliente del pool. "fn" recibe un objeto {all,get,run} con la misma
 * firma que el modulo normal, para que el codigo que corre dentro de la
 * transaccion se escriba igual que el resto de los repositorios -- solo hay
 * que inyectarlo en vez de usar el "db" importado a nivel de modulo.
 */
async function withTransaction(fn) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const scoped = {
      client: "postgres",
      all: (sql, params = []) => client.query(toPostgresParams(sql), params).then((r) => r.rows),
      get: (sql, params = []) => client.query(toPostgresParams(sql), params).then((r) => r.rows[0] || null),
      run: (sql, params = []) =>
        client.query(toPostgresParams(sql), params).then((r) => ({ changes: r.rowCount, lastID: r.rows[0]?.id || null }))
    };

    const result = await fn(scoped);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  client: "postgres",
  all,
  get,
  run,
  close,
  withTransaction
};
