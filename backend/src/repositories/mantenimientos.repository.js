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

// "dbClient" es opcional: por defecto usa el modulo de BD normal, pero
// createMantenimiento en el service lo invoca dentro de una transaccion
// (withTransaction) cuando hay repuestos que descontar de stock, para que la
// creacion del mantenimiento y el movimiento de stock sean atomicos.
async function create(mantenimiento, dbClient = db) {
  const placeholders = MANTENIMIENTO_FIELDS.map(() => "?").join(", ");
  const values = MANTENIMIENTO_FIELDS.map((field) => mantenimiento[field] ?? null);

  return dbClient.get(
    `INSERT INTO mantenimientos (${MANTENIMIENTO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function createRepuestoDetalle(mantenimientoId, detalle, dbClient = db) {
  return dbClient.run(
    `
      INSERT INTO mantenimiento_repuestos
        (mantenimiento_id, repuesto_id, repuesto_sugerido_id, motivo_sustitucion, cantidad, valor_unitario, valor_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      mantenimientoId,
      detalle.repuesto_id,
      detalle.repuesto_sugerido_id ?? null,
      detalle.motivo_sustitucion ?? null,
      detalle.cantidad,
      detalle.valor_unitario,
      detalle.valor_total
    ]
  );
}

async function findRepuestosEstructurados(mantenimientoId) {
  return db.all(
    `
      SELECT mr.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida,
             rs.codigo_interno AS sugerido_codigo_interno, rs.nombre AS sugerido_nombre
      FROM mantenimiento_repuestos mr
      INNER JOIN repuestos r ON r.id = mr.repuesto_id
      LEFT JOIN repuestos rs ON rs.id = mr.repuesto_sugerido_id
      WHERE mr.mantenimiento_id = ?
      ORDER BY mr.id ASC
    `,
    [mantenimientoId]
  );
}

module.exports = {
  findAll,
  findByVehicle,
  findById,
  findByIdWithVehiculo,
  create,
  createRepuestoDetalle,
  findRepuestosEstructurados,
  updateEstado
};
