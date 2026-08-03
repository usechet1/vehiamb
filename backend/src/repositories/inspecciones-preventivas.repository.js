const db = require("../database/query");

const CREATE_FIELDS = ["vehiculo_id", "usuario_id", "viaje_id", "observaciones", "latitud", "longitud", "ubicacion_precision", "firma_url", "empresa_id"];

async function create(inspeccion, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => inspeccion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO inspecciones_preventivas (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

// El "punto de llegada" no es propio de la inspeccion: viene del viaje que el
// conductor inicio en Inicio (tabla viajes, campo destino) justo antes de
// entrar al wizard. Se relaciona via viaje_id (ver vehicle-inspeccion.js,
// que lo recibe como query param al llegar desde home.js).
async function findById(id, empresaId) {
  return db.get(
    `
      SELECT ip.*, u.nombre AS usuario_nombre, v.destino AS viaje_destino
      FROM inspecciones_preventivas ip
      LEFT JOIN usuarios u ON u.id = ip.usuario_id
      LEFT JOIN viajes v ON v.id = ip.viaje_id
      WHERE ip.id = ? AND ip.empresa_id = ?
    `,
    [id, empresaId]
  );
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
        v.destino AS viaje_destino,
        COUNT(*) FILTER (WHERE ii.estado = 'mal') AS total_items_mal,
        COUNT(ii.id) AS total_items
      FROM inspecciones_preventivas ip
      LEFT JOIN usuarios u ON u.id = ip.usuario_id
      LEFT JOIN viajes v ON v.id = ip.viaje_id
      LEFT JOIN inspeccion_items ii ON ii.inspeccion_id = ip.id
      WHERE ip.vehiculo_id = ? AND ip.empresa_id = ?
      GROUP BY ip.id, u.nombre, v.destino
      ORDER BY ip.fecha DESC, ip.id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

// Inspeccion ligada a un viaje puntual (la que el conductor llena en el paso
// 3 del wizard al iniciarlo) -- usada por el resumen de "Viajes recientes"
// para Administrador/Operador (ver viajes.service.js -> obtenerResumen).
async function findByViajeId(viajeId, empresaId) {
  return db.get(
    `
      SELECT ip.*, u.nombre AS usuario_nombre, v.destino AS viaje_destino
      FROM inspecciones_preventivas ip
      LEFT JOIN usuarios u ON u.id = ip.usuario_id
      LEFT JOIN viajes v ON v.id = ip.viaje_id
      WHERE ip.viaje_id = ? AND ip.empresa_id = ?
      ORDER BY ip.id DESC
      LIMIT 1
    `,
    [viajeId, empresaId]
  );
}

module.exports = { create, findById, findByVehiculo, findByViajeId };
