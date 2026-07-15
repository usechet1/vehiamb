const db = require("../database/query");

async function create(registro) {
  return db.get(
    `
      INSERT INTO importaciones_config_vehiculos
        (nombre_archivo, hash_archivo, usuario_id, estado, total_sugeridos_creados, total_equivalencias_creadas,
         total_omitidos, total_incidencias, detalle_incidencias, duracion_ms, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `,
    [
      registro.nombre_archivo,
      registro.hash_archivo ?? null,
      registro.usuario_id ?? null,
      registro.estado,
      registro.total_sugeridos_creados ?? 0,
      registro.total_equivalencias_creadas ?? 0,
      registro.total_omitidos ?? 0,
      registro.total_incidencias ?? 0,
      registro.detalle_incidencias ? JSON.stringify(registro.detalle_incidencias) : null,
      registro.duracion_ms ?? null,
      registro.empresa_id
    ]
  );
}

async function findUltimaAutomatica(empresaId) {
  return db.get(
    `
      SELECT *
      FROM importaciones_config_vehiculos
      WHERE usuario_id IS NULL AND empresa_id = ?
      ORDER BY creado_en DESC, id DESC
      LIMIT 1
    `,
    [empresaId]
  );
}

async function findAll({ page = 1, limit = 20 } = {}, empresaId) {
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT i.*, u.nombre AS usuario_nombre
      FROM importaciones_config_vehiculos i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.empresa_id = ?
      ORDER BY i.creado_en DESC, i.id DESC
      LIMIT ? OFFSET ?
    `,
    [empresaId, limit, offset]
  );

  const totalPromise = db.get(
    "SELECT COUNT(*) AS total FROM importaciones_config_vehiculos WHERE empresa_id = ?",
    [empresaId]
  );
  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

module.exports = { create, findAll, findUltimaAutomatica };
