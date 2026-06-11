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

module.exports = {
  client: "postgres",
  all,
  get,
  run,
  close
};
