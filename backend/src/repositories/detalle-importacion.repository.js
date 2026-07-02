const db = require("../database/query");

async function createMany(importacionId, detalles) {
  for (const detalle of detalles) {
    await db.run(
      `
        INSERT INTO detalle_importacion (importacion_id, factura_id, numero_factura, accion, hash_anterior, hash_nuevo)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        importacionId,
        detalle.facturaId ?? null,
        detalle.numeroFactura,
        detalle.accion,
        detalle.hashAnterior ?? null,
        detalle.hashNuevo ?? null
      ]
    );
  }
}

async function findByImportacion(importacionId, { page = 1, limit = 50, accion } = {}) {
  const conditions = ["importacion_id = ?"];
  const values = [importacionId];

  if (accion) {
    conditions.push("accion = ?");
    values.push(accion);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const offset = (Math.max(1, page) - 1) * limit;

  const rowsPromise = db.all(
    `
      SELECT *
      FROM detalle_importacion
      ${whereClause}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM detalle_importacion ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    items: rows,
    page,
    limit,
    total: Number(totalRow?.total || 0),
    totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit))
  };
}

module.exports = { createMany, findByImportacion };
