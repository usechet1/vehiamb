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
  "referencia_id",
  "empresa_id"
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

// El destinatario (usuario_id) ya acota implicitamente a una sola empresa (un
// usuario pertenece a una unica empresa), pero se agrega empresa_id de forma
// explicita para mantener el mismo patron mecanico que el resto del
// catalogo y evitar depender solo de esa inferencia.
function buildWhereClause(usuarioId, empresaId, filters) {
  const conditions = ["n.usuario_id = ?", "n.empresa_id = ?"];
  const values = [usuarioId, empresaId];

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

async function findById(id, empresaId) {
  return db.get("SELECT * FROM notificaciones WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function findByUsuario(usuarioId, empresaId, filters = {}) {
  const { whereClause, values } = buildWhereClause(usuarioId, empresaId, filters);

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

  return db.get("SELECT * FROM notificaciones WHERE id = ?", [result.lastID]);
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

async function removeTodas(usuarioId) {
  return db.run("DELETE FROM notificaciones WHERE usuario_id = ?", [usuarioId]);
}

async function countPendientes(usuarioId) {
  const row = await db.get(
    "SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND estado = 'no_leida'",
    [usuarioId]
  );

  return Number(row?.total || 0);
}

// Todas las notificaciones de la empresa sin importar el destinatario, para
// el panel admin (admin-logs.html > Notificaciones) -- "a quien se le
// notifica" de un vistazo, distinto de findByUsuario que solo trae las
// propias del usuario logueado (centro de notificaciones normal).
async function findAllEmpresa({ page = 1, limit = 20, categoria, prioridad, estado, desde, hasta, search } = {}, empresaId) {
  const conditions = ["n.empresa_id = ?"];
  const values = [empresaId];

  if (categoria) {
    conditions.push("n.categoria = ?");
    values.push(categoria);
  }

  if (prioridad) {
    conditions.push("n.prioridad = ?");
    values.push(prioridad);
  }

  if (estado) {
    conditions.push("n.estado = ?");
    values.push(estado);
  }

  if (desde) {
    conditions.push("n.fecha_creacion >= ?");
    values.push(desde);
  }

  if (hasta) {
    conditions.push("n.fecha_creacion < (?::date + INTERVAL '1 day')");
    values.push(hasta);
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push("(n.titulo ILIKE ? OR n.mensaje ILIKE ? OR u.nombre ILIKE ? OR v.placa ILIKE ?)");
    values.push(term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;
  const joinClause = `
    FROM notificaciones n
    LEFT JOIN usuarios u ON u.id = n.usuario_id
    LEFT JOIN vehiculos v ON v.id = n.vehiculo_id
  `;

  const rowsPromise = db.all(
    `
      SELECT n.*, u.nombre AS usuario_nombre, u.email AS usuario_email, v.placa AS vehiculo_placa
      ${joinClause}
      ${whereClause}
      ORDER BY n.fecha_creacion DESC, n.id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total ${joinClause} ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

async function existsRecentByReferencia(referenciaTipo, referenciaId, sinceHours, empresaId) {
  const row = await db.get(
    `
      SELECT 1
      FROM notificaciones
      WHERE referencia_tipo = ?
        AND referencia_id = ?
        AND empresa_id = ?
        AND fecha_creacion >= NOW() - (? || ' hours')::interval
      LIMIT 1
    `,
    [referenciaTipo, referenciaId, empresaId, sinceHours]
  );

  return Boolean(row);
}

module.exports = {
  findById,
  findByUsuario,
  findAllEmpresa,
  create,
  markAsRead,
  markAllAsRead,
  archive,
  remove,
  removeLeidas,
  removeTodas,
  countPendientes,
  existsRecentByReferencia
};
