const db = require("../database/query");

const TRUE_VALUE = db.client === "postgres" ? true : 1;

async function findById(id) {
  return db.get("SELECT * FROM notificaciones WHERE id = ?", [id]);
}

async function findByUsuario(usuarioId) {
  return db.all(
    `
      SELECT *
      FROM notificaciones
      WHERE usuario_id = ?
      ORDER BY leido ASC, fecha_creacion DESC
    `,
    [usuarioId]
  );
}

async function create(notificacion) {
  const fields = ["usuario_id", "tipo", "prioridad", "mensaje", "referencia_tipo", "referencia_id"];
  const placeholders = fields.map(() => "?").join(", ");
  const values = fields.map((field) => notificacion[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO notificaciones (${fields.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO notificaciones (${fields.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return findById(result.lastID);
}

async function markAsRead(id, usuarioId) {
  return db.run(
    "UPDATE notificaciones SET leido = ? WHERE id = ? AND usuario_id = ?",
    [TRUE_VALUE, id, usuarioId]
  );
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
  existsRecentByReferencia
};
