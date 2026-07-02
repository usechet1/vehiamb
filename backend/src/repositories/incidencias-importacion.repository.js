const db = require("../database/query");

async function createMany(importacionId, incidencias) {
  for (const incidencia of incidencias) {
    await db.run(
      `
        INSERT INTO incidencias_importacion
          (importacion_id, fila_excel, numero_factura, placa_original, tipo_incidencia, descripcion, valor_problematico)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        importacionId,
        incidencia.filaExcel ?? null,
        incidencia.numeroFactura ?? null,
        incidencia.placaOriginal ?? null,
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
      FROM incidencias_importacion
      ${whereClause}
      ORDER BY creado_en DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM incidencias_importacion ${whereClause}`, values);

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
  return db.get("SELECT * FROM incidencias_importacion WHERE id = ?", [id]);
}

async function resolver(id, usuarioId) {
  const TRUE_VALUE = db.client === "postgres" ? true : 1;

  return db.run(
    `
      UPDATE incidencias_importacion
      SET resuelta = ?, resuelta_por = ?, resuelta_en = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [TRUE_VALUE, usuarioId, id]
  );
}

module.exports = { createMany, findByImportacion, findById, resolver };
