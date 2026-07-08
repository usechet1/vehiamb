const db = require("../database/query");

const CREATE_FIELDS = ["nombre_archivo", "hash_archivo", "periodo", "usuario_id", "estado"];

async function findById(id) {
  return db.get(
    `
      SELECT i.*, u.nombre AS usuario_nombre
      FROM importaciones i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.id = ?
    `,
    [id]
  );
}

async function create(importacion) {
  const values = CREATE_FIELDS.map((field) => importacion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO importaciones (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO importaciones (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );
  return findById(result.lastID);
}

async function actualizarResultado(id, resultado) {
  return db.run(
    `
      UPDATE importaciones
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

async function findAll({ page = 1, limit = 20, estado, periodo } = {}) {
  const conditions = [];
  const values = [];

  if (estado) {
    conditions.push("i.estado = ?");
    values.push(estado);
  }

  if (periodo) {
    conditions.push("i.periodo = ?");
    values.push(periodo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT i.*, u.nombre AS usuario_nombre
      FROM importaciones i
      LEFT JOIN usuarios u ON u.id = i.usuario_id
      ${whereClause}
      ORDER BY i.creado_en DESC, i.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM importaciones i ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

async function findUltimaAutomatica() {
  return db.get(
    `
      SELECT *
      FROM importaciones
      WHERE usuario_id IS NULL
      ORDER BY creado_en DESC, id DESC
      LIMIT 1
    `
  );
}

async function findUltimaPorPeriodo(periodo) {
  return db.get(
    `
      SELECT *
      FROM importaciones
      WHERE periodo = ?
      ORDER BY creado_en DESC, id DESC
      LIMIT 1
    `,
    [periodo]
  );
}

module.exports = { findById, create, actualizarResultado, findAll, findUltimaAutomatica, findUltimaPorPeriodo };
