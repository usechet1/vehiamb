const db = require("../database/query");

const FIELDS = ["conductor_id", "categoria", "fecha_vencimiento", "archivo_url", "archivo_nombre", "archivo_mime", "empresa_id"];

async function findByConductor(conductorId, empresaId) {
  return db.all(
    "SELECT * FROM conductor_licencias WHERE conductor_id = ? AND empresa_id = ? ORDER BY categoria ASC",
    [conductorId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM conductor_licencias WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function create(licencia) {
  const placeholders = FIELDS.map(() => "?").join(", ");
  const values = FIELDS.map((field) => licencia[field] ?? null);

  return db.get(`INSERT INTO conductor_licencias (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`, values);
}

async function update(id, licencia, empresaId) {
  const assignments = FIELDS.map((field) => `${field} = ?`).join(", ");
  const values = FIELDS.map((field) => licencia[field] ?? null);

  return db.get(
    `UPDATE conductor_licencias SET ${assignments} WHERE id = ? AND empresa_id = ? RETURNING *`,
    [...values, id, empresaId]
  );
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM conductor_licencias WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findByConductor,
  findById,
  create,
  update,
  remove
};
