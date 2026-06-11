const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "parque_automotor.db");

const connection = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error conectando a SQLite", err.message);
  } else {
    console.log("Conectado a SQLite");
  }
});

connection.run("PRAGMA foreign_keys = ON");

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function close(callback) {
  connection.close(callback);
}

function serialize(callback) {
  connection.serialize(callback);
}

module.exports = {
  client: "sqlite",
  all,
  get,
  run,
  close,
  serialize
};
