const db = require("../database/query");

const EXTINTOR_FIELDS = ["vehiculo_id", "codigo", "fecha_vencimiento", "usuario_id", "empresa_id"];

async function findAll(empresaId) {
  return db.all(
    `
      SELECT e.*, v.placa, v.marca, v.modelo
      FROM extintores e
      INNER JOIN vehiculos v ON v.id = e.vehiculo_id
      WHERE e.empresa_id = ?
      ORDER BY e.fecha_vencimiento ASC, e.id DESC
    `,
    [empresaId]
  );
}

async function findByVehiculo(vehiculoId, empresaId) {
  return db.all(
    `
      SELECT *
      FROM extintores
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha_vencimiento ASC, id DESC
    `,
    [vehiculoId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM extintores WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function create(extintor) {
  const placeholders = EXTINTOR_FIELDS.map(() => "?").join(", ");
  const values = EXTINTOR_FIELDS.map((field) => extintor[field] ?? null);

  return db.get(
    `INSERT INTO extintores (${EXTINTOR_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

// usuario_id no se reasigna en el update: queda quien lo registro originalmente.
const CAMPOS_EDITABLES = ["vehiculo_id", "codigo", "fecha_vencimiento"];

async function update(id, extintor, empresaId) {
  const assignments = CAMPOS_EDITABLES.map((field) => `${field} = ?`).join(", ");
  const values = CAMPOS_EDITABLES.map((field) => extintor[field] ?? null);

  return db.get(
    `UPDATE extintores SET ${assignments} WHERE id = ? AND empresa_id = ? RETURNING *`,
    [...values, id, empresaId]
  );
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM extintores WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findAll,
  findByVehiculo,
  findById,
  create,
  update,
  remove
};
