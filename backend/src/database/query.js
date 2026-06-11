const env = require("../config/env");

const database = env.dbClient === "postgres"
  ? require("./postgres")
  : require("./sqlite");

module.exports = database;
