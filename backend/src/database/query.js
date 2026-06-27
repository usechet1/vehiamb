const env = require("../config/env");

if (env.dbClient !== "postgres") {
  throw new Error("DB_CLIENT debe ser postgres. SQLite solo queda disponible para scripts de migracion.");
}

const database = require("./postgres");

module.exports = database;
