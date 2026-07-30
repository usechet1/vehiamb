const db = require("../database/query");

const CREATE_FIELDS = ["vehiculo_id", "usuario_id", "viaje_id", "empresa_id"];

async function create(preoperacional, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => preoperacional[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO preoperacionales (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function findById(id, empresaId) {
  return db.get(
    `
      SELECT pp.*, u.nombre AS usuario_nombre, v.destino AS viaje_destino
      FROM preoperacionales pp
      LEFT JOIN usuarios u ON u.id = pp.usuario_id
      LEFT JOIN viajes v ON v.id = pp.viaje_id
      WHERE pp.id = ? AND pp.empresa_id = ?
    `,
    [id, empresaId]
  );
}

async function findByVehiculo(vehiculoId, empresaId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT
        pp.*,
        u.nombre AS usuario_nombre,
        v.destino AS viaje_destino,
        COUNT(*) FILTER (WHERE pi.respuesta = 'no') AS total_items_no,
        COUNT(pi.id) AS total_items
      FROM preoperacionales pp
      LEFT JOIN usuarios u ON u.id = pp.usuario_id
      LEFT JOIN viajes v ON v.id = pp.viaje_id
      LEFT JOIN preoperacional_items pi ON pi.preoperacional_id = pp.id
      WHERE pp.vehiculo_id = ? AND pp.empresa_id = ?
      GROUP BY pp.id, u.nombre, v.destino
      ORDER BY pp.fecha DESC, pp.id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

async function findByViajeId(viajeId, empresaId) {
  return db.get(
    `
      SELECT pp.*, u.nombre AS usuario_nombre, v.destino AS viaje_destino
      FROM preoperacionales pp
      LEFT JOIN usuarios u ON u.id = pp.usuario_id
      LEFT JOIN viajes v ON v.id = pp.viaje_id
      WHERE pp.viaje_id = ? AND pp.empresa_id = ?
      ORDER BY pp.id DESC
      LIMIT 1
    `,
    [viajeId, empresaId]
  );
}

module.exports = { create, findById, findByVehiculo, findByViajeId };
