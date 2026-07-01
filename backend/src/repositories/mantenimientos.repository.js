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
  "valor_mano_obra",
  "kilometraje",
  "proximo_cambio_km",
  "proximo_cambio_fecha",
  "creado_por_usuario_id",
  "estado",
  "vehiculo_varado"
];

async function findAll(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.tipo) {
    conditions.push("m.tipo = ?");
    values.push(filters.tipo);
  }

  if (filters.placa) {
    conditions.push("v.placa = ?");
    values.push(filters.placa);
  }

  if (filters.fechaDesde) {
    conditions.push("m.fecha >= ?");
    values.push(filters.fechaDesde);
  }

  if (filters.fechaHasta) {
    conditions.push("m.fecha <= ?");
    values.push(filters.fechaHasta);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return db.all(
    `
      SELECT
        m.*,
        v.placa,
        v.marca,
        v.modelo
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      ${whereClause}
      ORDER BY m.fecha DESC, m.id DESC
    `,
    values
  );
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

async function findByIdWithVehiculo(id) {
  return db.get(
    `
      SELECT
        m.*,
        v.placa,
        v.marca,
        v.modelo
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      WHERE m.id = ?
    `,
    [id]
  );
}

async function updateEstado(id, estado) {
  await db.run("UPDATE mantenimientos SET estado = ? WHERE id = ?", [estado, id]);
  return findByIdWithVehiculo(id);
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
  findByIdWithVehiculo,
  create,
  updateEstado
};
