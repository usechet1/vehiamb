const db = require("../database/query");

async function createMany(importacionId, incidencias) {
  for (const incidencia of incidencias) {
    await db.run(
      `
        INSERT INTO incidencias_importacion_stock
          (importacion_id, fila_excel, codigo_interno, tipo_incidencia, descripcion, valor_problematico)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        importacionId,
        incidencia.filaExcel ?? null,
        incidencia.codigoInterno ?? null,
        incidencia.tipoIncidencia,
        incidencia.descripcion,
        incidencia.valorProblematico ?? null
      ]
    );
  }
}

async function findByImportacion(importacionId, { page = 1, limit = 50, resuelta } = {}) {
  const conditions = ["importacion_id = ?"];
  const values = [importacionId];

  if (resuelta !== undefined) {
    conditions.push("resuelta = ?");
    values.push(resuelta);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT *
      FROM incidencias_importacion_stock
      ${whereClause}
      ORDER BY creado_en DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM incidencias_importacion_stock ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

async function findById(id) {
  return db.get("SELECT * FROM incidencias_importacion_stock WHERE id = ?", [id]);
}

async function resolver(id, usuarioId) {
  return db.run(
    `
      UPDATE incidencias_importacion_stock
      SET resuelta = true, resuelta_por = ?, resuelta_en = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [usuarioId, id]
  );
}

module.exports = { createMany, findByImportacion, findById, resolver };
