const db = require("../database/query");

async function findByInspeccion(inspeccionId, empresaId) {
  return db.all(
    "SELECT * FROM inspeccion_botiquin_archivos WHERE inspeccion_id = ? AND empresa_id = ? ORDER BY id ASC",
    [inspeccionId, empresaId]
  );
}

async function bulkCreate(inspeccionId, archivos, empresaId) {
  const creados = [];
  for (const archivo of archivos) {
    const creado = await db.get(
      `
        INSERT INTO inspeccion_botiquin_archivos (inspeccion_id, archivo_url, archivo_nombre, archivo_mime, empresa_id)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `,
      [inspeccionId, archivo.archivo_url, archivo.archivo_nombre, archivo.archivo_mime, empresaId]
    );
    creados.push(creado);
  }
  return creados;
}

async function removeById(id, inspeccionId, empresaId) {
  return db.get(
    "DELETE FROM inspeccion_botiquin_archivos WHERE id = ? AND inspeccion_id = ? AND empresa_id = ? RETURNING *",
    [id, inspeccionId, empresaId]
  );
}

module.exports = { findByInspeccion, bulkCreate, removeById };
