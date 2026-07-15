const db = require("../database/query");

async function create({ vehiculo_id, usuario_id, destino, empresa_id }) {
  return db.get(
    `INSERT INTO viajes (vehiculo_id, usuario_id, destino, empresa_id) VALUES (?, ?, ?, ?) RETURNING *`,
    [vehiculo_id, usuario_id, destino, empresa_id]
  );
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

module.exports = { create, findRecientesPorUsuario };
