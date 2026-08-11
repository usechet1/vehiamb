const db = require("../database/query");
const FIELDS = ["referencia_tipo", "referencia_id", "usuario_id", "comentario", "foto_url", "foto_nombre", "foto_mime", "empresa_id"];
async function create(comentario) {
    const placeholders = FIELDS.map(() => "?").join(", ");
    const values = FIELDS.map((field) => comentario[field] ?? null);

    return db.get(
    `INSERT INTO notificacion_comentarios (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function findByReferencia(referenciaTipo, referenciaId, empresaId) {
  return db.all(
    `
      SELECT c.*, u.nombre AS usuario_nombre
      FROM notificacion_comentarios c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.referencia_tipo = ? AND c.referencia_id = ? AND c.empresa_id = ?
      ORDER BY c.creado_en ASC
    `,
    [referenciaTipo, referenciaId, empresaId]
  );
}

module.exports = { create, findByReferencia };

