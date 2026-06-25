const db = require("../database/query");

async function findByEmail(email) {
  return db.get("SELECT * FROM usuarios WHERE email = ?", [email.toLowerCase()]);
}

async function findById(id) {
  return db.get("SELECT * FROM usuarios WHERE id = ?", [id]);
}

module.exports = {
  findByEmail,
  findById
};
