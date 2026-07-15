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
  "vehiculo_varado",
  "empresa_id"
];

async function findAll(filters = {}, empresaId) {
  const conditions = ["m.empresa_id = ?"];
  const values = [empresaId];

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

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

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

async function findByVehicle(vehiculoId, empresaId) {
  return db.all(
    `
      SELECT *
      FROM mantenimientos
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha DESC, id DESC
    `,
    [vehiculoId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM mantenimientos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function findByIdWithVehiculo(id, empresaId) {
  return db.get(
    `
      SELECT
        m.*,
        v.placa,
        v.marca,
        v.modelo
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      WHERE m.id = ? AND m.empresa_id = ?
    `,
    [id, empresaId]
  );
}

async function updateEstado(id, estado, empresaId) {
  await db.run("UPDATE mantenimientos SET estado = ? WHERE id = ? AND empresa_id = ?", [estado, id, empresaId]);
  return findByIdWithVehiculo(id, empresaId);
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

async function createRepuestoDetalle(mantenimientoId, detalle, empresaId, dbClient = db) {
  return dbClient.run(
    `
      INSERT INTO mantenimiento_repuestos
        (mantenimiento_id, repuesto_id, repuesto_sugerido_id, motivo_sustitucion, cantidad, valor_unitario, valor_total, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      mantenimientoId,
      detalle.repuesto_id,
      detalle.repuesto_sugerido_id ?? null,
      detalle.motivo_sustitucion ?? null,
      detalle.cantidad,
      detalle.valor_unitario,
      detalle.valor_total,
      empresaId
    ]
  );
}

async function findRepuestosEstructurados(mantenimientoId, empresaId) {
  return db.all(
    `
      SELECT mr.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida,
             rs.codigo_interno AS sugerido_codigo_interno, rs.nombre AS sugerido_nombre
      FROM mantenimiento_repuestos mr
      INNER JOIN repuestos r ON r.id = mr.repuesto_id
      LEFT JOIN repuestos rs ON rs.id = mr.repuesto_sugerido_id
      WHERE mr.mantenimiento_id = ? AND mr.empresa_id = ?
      ORDER BY mr.id ASC
    `,
    [mantenimientoId, empresaId]
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
