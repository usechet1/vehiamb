const db = require("../database/query");

const MANTENIMIENTO_FIELDS = [
  "vehiculo_id",
  "fecha",
  "tipo",
  "descripcion",
  "autorizado_por",
  "hecho_por",
  "repuestos",
  "soporte_url",
  "soporte_nombre",
  "soporte_mime",
  "valor",
  "kilometraje"
];

async function findAll() {
  return db.all(`
    SELECT
      m.*,
      v.placa,
      v.marca,
      v.modelo
    FROM mantenimientos m
    INNER JOIN vehiculos v ON v.id = m.vehiculo_id
    ORDER BY m.fecha DESC, m.id DESC
  `);
}

async function findByVehicle(vehiculoId) {
  return db.all(
    `
      SELECT *
      FROM mantenimientos
      WHERE vehiculo_id = ?
      ORDER BY fecha DESC, id DESC
    `,
    [vehiculoId]
  );
}

async function findById(id) {
  return db.get("SELECT * FROM mantenimientos WHERE id = ?", [id]);
}

async function create(mantenimiento) {
  const placeholders = MANTENIMIENTO_FIELDS.map(() => "?").join(", ");
  const values = MANTENIMIENTO_FIELDS.map((field) => mantenimiento[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO mantenimientos (${MANTENIMIENTO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO mantenimientos (${MANTENIMIENTO_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return findById(result.lastID);
}

module.exports = {
  findAll,
  findByVehicle,
  findById,
  create
};
