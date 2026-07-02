const db = require("../database/query");

const TRUE_VALUE = db.client === "postgres" ? true : 1;

const CREATE_FIELDS = [
  "usuario_id",
  "tipo",
  "categoria",
  "prioridad",
  "titulo",
  "mensaje",
  "vehiculo_id",
  "accion_tipo",
  "accion_payload",
  "referencia_tipo",
  "referencia_id"
];

// Filtros de igualdad exacta soportados por el listado. Agregar un filtro nuevo
// solo requiere una entrada aqui, sin tocar el resto del flujo (mismo patron
// usado en vehiculos.repository.js). Las columnas ya llevan el alias "n."
// porque el listado hace JOIN con vehiculos para exponer la placa.
const EXACT_FILTERS = [
  { param: "estado", column: "n.estado" },
  { param: "prioridad", column: "n.prioridad" },
  { param: "categoria", column: "n.categoria" },
  { param: "vehiculo_id", column: "n.vehiculo_id" }
];

const SEARCH_COLUMNS = ["n.titulo", "n.mensaje", "n.tipo"];

function buildWhereClause(usuarioId, filters) {
  const conditions = ["n.usuario_id = ?"];
  const values = [usuarioId];

  EXACT_FILTERS.forEach(({ param, column }) => {
    if (filters[param]) {
      conditions.push(`${column} = ?`);
      values.push(filters[param]);
    }
  });

  if (filters.fecha_desde) {
    conditions.push("n.fecha_creacion >= ?");
    values.push(filters.fecha_desde);
  }

  if (filters.fecha_hasta) {
    conditions.push("n.fecha_creacion <= ?");
    values.push(`${filters.fecha_hasta} 23:59:59`);
  }

  if (filters.search) {
    const term = `%${filters.search}%`;
    // Busca por titulo/mensaje/tipo de la notificacion o por placa del vehiculo asociado.
    const searchConditions = [
      ...SEARCH_COLUMNS.map((column) => `${column} ILIKE ?`),
      "v.placa ILIKE ?"
    ];
    conditions.push(`(${searchConditions.join(" OR ")})`);
    SEARCH_COLUMNS.forEach(() => values.push(term));
    values.push(term);
  }

  return { whereClause: `WHERE ${conditions.join(" AND ")}`, values };
}

async function findById(id) {
  return db.get("SELECT * FROM notificaciones WHERE id = ?", [id]);
}

async function findByUsuario(usuarioId, filters = {}) {
  const { whereClause, values } = buildWhereClause(usuarioId, filters);

  return db.all(
    `
      SELECT n.*, v.placa AS vehiculo_placa, v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo
      FROM notificaciones n
      LEFT JOIN vehiculos v ON v.id = n.vehiculo_id
      ${whereClause}
      ORDER BY n.fecha_creacion DESC
    `,
    values
  );
}

async function create(notificacion) {
  const values = CREATE_FIELDS.map((field) => notificacion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO notificaciones (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO notificaciones (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return findById(result.lastID);
}

async function markAsRead(id, usuarioId) {
  return db.run(
    "UPDATE notificaciones SET leido = ?, estado = 'leida', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND usuario_id = ? AND estado = 'no_leida'",
    [TRUE_VALUE, id, usuarioId]
  );
}

async function markAllAsRead(usuarioId) {
  return db.run(
    "UPDATE notificaciones SET leido = ?, estado = 'leida', updated_at = CURRENT_TIMESTAMP WHERE usuario_id = ? AND estado = 'no_leida'",
    [TRUE_VALUE, usuarioId]
  );
}

async function archive(id, usuarioId) {
  return db.run(
    "UPDATE notificaciones SET estado = 'archivada', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND usuario_id = ?",
    [id, usuarioId]
  );
}

async function remove(id, usuarioId) {
  return db.run("DELETE FROM notificaciones WHERE id = ? AND usuario_id = ?", [id, usuarioId]);
}

async function removeLeidas(usuarioId) {
  return db.run("DELETE FROM notificaciones WHERE usuario_id = ? AND estado = 'leida'", [usuarioId]);
}

async function countPendientes(usuarioId) {
  const row = await db.get(
    "SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND estado = 'no_leida'",
    [usuarioId]
  );

  return Number(row?.total || 0);
}

async function existsRecentByReferencia(referenciaTipo, referenciaId, sinceHours) {
  const row = await db.get(
    `
      SELECT 1
      FROM notificaciones
      WHERE referencia_tipo = ?
        AND referencia_id = ?
        AND fecha_creacion >= NOW() - (? || ' hours')::interval
      LIMIT 1
    `,
    [referenciaTipo, referenciaId, sinceHours]
  );

  return Boolean(row);
}

module.exports = {
  findById,
  findByUsuario,
  create,
  markAsRead,
  markAllAsRead,
  archive,
  remove,
  removeLeidas,
  countPendientes,
  existsRecentByReferencia
};
