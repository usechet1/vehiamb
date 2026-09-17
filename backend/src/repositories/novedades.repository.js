const db = require("../database/query");

const NOVEDAD_FIELDS = [
  "empresa_id",
  "vehiculo_id",
  "fecha",
  "descripcion",
  "foto_url",
  "foto_nombre",
  "foto_mime",
  "creado_por_usuario_id"
];

async function findAll(filters = {}, empresaId) {
  const conditions = ["n.empresa_id = ?"];
  const values = [empresaId];

  if (filters.vehiculoId) {
    conditions.push("n.vehiculo_id = ?");
    values.push(filters.vehiculoId);
  }

  if (filters.fechaDesde) {
    conditions.push("n.fecha >= ?");
    values.push(filters.fechaDesde);
  }

  if (filters.fechaHasta) {
    conditions.push("n.fecha <= ?");
    values.push(filters.fechaHasta);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  return db.all(
    `
      SELECT n.*, v.placa, v.codigo_interno, v.marca, v.modelo
      FROM novedades n
      INNER JOIN vehiculos v ON v.id = n.vehiculo_id
      ${whereClause}
      ORDER BY n.fecha DESC, n.id DESC
    `,
    values
  );
}

async function findByVehicle(vehiculoId, empresaId) {
  return db.all(
    `
      SELECT *
      FROM novedades
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha DESC, id DESC
    `,
    [vehiculoId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM novedades WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function create(novedad) {
  const placeholders = NOVEDAD_FIELDS.map(() => "?").join(", ");
  const values = NOVEDAD_FIELDS.map((field) => novedad[field] ?? null);

  return db.get(
    `INSERT INTO novedades (${NOVEDAD_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function remove(id, empresaId) {
  await db.run("DELETE FROM novedades WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findAll,
  findByVehicle,
  findById,
  create,
  remove
};
