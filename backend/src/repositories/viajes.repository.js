const db = require("../database/query");

async function create({ vehiculo_id, usuario_id, destino, empresa_id }) {
  return db.get(
    `INSERT INTO viajes (vehiculo_id, usuario_id, destino, empresa_id) VALUES (?, ?, ?, ?) RETURNING *`,
    [vehiculo_id, usuario_id, destino, empresa_id]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM viajes WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// Ultimos viajes de un conductor, con los datos del vehiculo ya resueltos
// para no tener que pedirlos aparte al pintar "Tus ultimos viajes". Ya viene
// implicitamente acotado a una sola empresa via usuario_id (un usuario
// pertenece a una unica empresa).
async function findRecientesPorUsuario(usuarioId, { limit = 10 } = {}) {
  return db.all(
    `
      SELECT
        v.*,
        veh.placa AS vehiculo_placa,
        veh.marca AS vehiculo_marca,
        veh.modelo AS vehiculo_modelo
      FROM viajes v
      LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id
      WHERE v.usuario_id = ?
      ORDER BY v.creado_en DESC
      LIMIT ?
    `,
    [usuarioId, limit]
  );
}

// Historial de viajes de un vehiculo especifico (de cualquier conductor que
// lo haya usado), para la seccion "Ultimos viajes" en la hoja de vida del
// vehiculo. Ya acotado a la empresa via el propio vehiculo.
async function findRecientesPorVehiculo(vehiculoId, empresaId, { limit = 10 } = {}) {
  return db.all(
    `
      SELECT
        v.*,
        u.nombre AS usuario_nombre
      FROM viajes v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.vehiculo_id = ? AND v.empresa_id = ?
      ORDER BY v.creado_en DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

module.exports = { create, findById, findRecientesPorUsuario, findRecientesPorVehiculo };
