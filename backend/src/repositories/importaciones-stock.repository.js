const db = require("../database/query");

const CREATE_FIELDS = ["nombre_archivo", "hash_archivo", "usuario_id", "estado", "empresa_id"];

async function findById(id, empresaId) {
  return db.get(
    `
      SELECT i.*, u.nombre AS usuario_nombre
      FROM importaciones_stock i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.id = ? AND i.empresa_id = ?
    `,
    [id, empresaId]
  );
}

async function create(importacion) {
  const values = CREATE_FIELDS.map((field) => importacion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return db.get(
    `INSERT INTO importaciones_stock (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function actualizarResultado(id, resultado) {
  return db.run(
    `
      UPDATE importaciones_stock
      SET estado = ?,
          total_leidos = ?,
          total_nuevos = ?,
          total_actualizados = ?,
          total_omitidos = ?,
          total_errores = ?,
          duracion_ms = ?,
          observaciones = ?
      WHERE id = ?
    `,
    [
      resultado.estado,
      resultado.totalLeidos ?? 0,
      resultado.totalNuevos ?? 0,
      resultado.totalActualizados ?? 0,
      resultado.totalOmitidos ?? 0,
      resultado.totalErrores ?? 0,
      resultado.duracionMs ?? null,
      resultado.observaciones ?? null,
      id
    ]
  );
}

async function findAll({ page = 1, limit = 20, estado } = {}, empresaId) {
  const conditions = ["i.empresa_id = ?"];
  const values = [empresaId];

  if (estado) {
    conditions.push("i.estado = ?");
    values.push(estado);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT i.*, u.nombre AS usuario_nombre
      FROM importaciones_stock i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      ${whereClause}
      ORDER BY i.creado_en DESC, i.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM importaciones_stock i ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

async function findUltimaAutomatica(empresaId) {
  return db.get(
    `
      SELECT *
      FROM importaciones_stock
      WHERE usuario_id IS NULL AND empresa_id = ?
      ORDER BY creado_en DESC, id DESC
      LIMIT 1
    `,
    [empresaId]
  );
}

module.exports = { findById, create, actualizarResultado, findAll, findUltimaAutomatica };
