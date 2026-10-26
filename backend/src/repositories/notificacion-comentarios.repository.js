const db = require("../database/query");
const { parseAdjuntos } = require("../utils/adjuntos");
const FIELDS = ["referencia_tipo", "referencia_id", "usuario_id", "comentario", "foto_url", "foto_nombre", "foto_mime", "fotos_json", "empresa_id"];

// El hilo lo leen tres servicios (notificaciones, viajes, novedades) -- la
// lista de fotos se arma aca una sola vez. Comentarios anteriores a
// fotos_json salen con su unica foto_url como lista de una.
function conFotos(comentario) {
  if (!comentario) return comentario;
  const { fotos_json: fotosJson, ...resto } = comentario;
  return {
    ...resto,
    fotos: parseAdjuntos(fotosJson, { url: comentario.foto_url, nombre: comentario.foto_nombre, mime: comentario.foto_mime })
  };
}

async function create(comentario) {
    const placeholders = FIELDS.map(() => "?").join(", ");
    const values = FIELDS.map((field) => comentario[field] ?? null);

    const creado = await db.get(
    `INSERT INTO notificacion_comentarios (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return conFotos(creado);
}

async function findByReferencia(referenciaTipo, referenciaId, empresaId) {
  const comentarios = await db.all(
    `
      SELECT c.*, u.nombre AS usuario_nombre
      FROM notificacion_comentarios c
      LEFT JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.referencia_tipo = ? AND c.referencia_id = ? AND c.empresa_id = ?
      ORDER BY c.creado_en ASC
    `,
    [referenciaTipo, referenciaId, empresaId]
  );
  return comentarios.map(conFotos);
}

module.exports = { create, findByReferencia };
