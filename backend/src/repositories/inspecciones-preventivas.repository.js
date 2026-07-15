const db = require("../database/query");

const CREATE_FIELDS = ["vehiculo_id", "usuario_id", "observaciones", "empresa_id"];

async function create(inspeccion, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => inspeccion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO inspecciones_preventivas (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM inspecciones_preventivas WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// Historial de un vehiculo, mas reciente primero, con el conteo de items en
// mal estado para pintar un badge rapido en el historial sin tener que
// cargar el detalle completo de cada inspeccion.
async function findByVehiculo(vehiculoId, empresaId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT
        ip.*,
        u.nombre AS usuario_nombre,
        COUNT(*) FILTER (WHERE ii.estado = 'mal') AS total_items_mal,
        COUNT(ii.id) AS total_items
      FROM inspecciones_preventivas ip
      LEFT JOIN usuarios u ON u.id = ip.usuario_id
      LEFT JOIN inspeccion_items ii ON ii.inspeccion_id = ip.id
      WHERE ip.vehiculo_id = ? AND ip.empresa_id = ?
      GROUP BY ip.id, u.nombre
      ORDER BY ip.fecha DESC, ip.id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

module.exports = { create, findById, findByVehiculo };
