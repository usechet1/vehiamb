const db = require("../database/query");

async function crear({ usuario_id, token_hash, expira_en }) {
  return db.get(
    `
      INSERT INTO password_reset_tokens (usuario_id, token_hash, expira_en)
      VALUES (?, ?, ?)
      RETURNING *
    `,
    [usuario_id, token_hash, expira_en]
  );
}

async function findVigentePorHash(tokenHash) {
  return db.get(
    `
      SELECT *
      FROM password_reset_tokens
      WHERE token_hash = ? AND usado_en IS NULL AND expira_en > NOW()
      ORDER BY id DESC
      LIMIT 1
    `,
    [tokenHash]
  );
}

async function marcarUsado(id) {
  await db.run("UPDATE password_reset_tokens SET usado_en = NOW() WHERE id = ?", [id]);
}

// Al pedir un nuevo enlace, los pendientes anteriores del mismo usuario dejan
// de servir -- evita que queden varios tokens validos circulando (por correo
// reenviado, o un enlace viejo que alguien mas todavia tenga a mano).
async function invalidarPendientesDeUsuario(usuarioId) {
  await db.run(
    "UPDATE password_reset_tokens SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL",
    [usuarioId]
  );
}

module.exports = { crear, findVigentePorHash, marcarUsado, invalidarPendientesDeUsuario };
