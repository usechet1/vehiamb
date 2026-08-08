const db = require("../database/query");

const FIELDS = ["inspeccion_id", "item_codigo", "item_label", "estado", "cantidad", "fecha_vencimiento", "empresa_id"];

async function bulkCreate(inspeccionId, items, empresaId, dbClient = db) {
  if (!items.length) return [];

  const creados = [];
  for (const item of items) {
    const row = {
      inspeccion_id: inspeccionId,
      item_codigo: item.item_codigo,
      item_label: item.item_label,
      estado: item.estado,
      cantidad: item.cantidad ?? null,
      fecha_vencimiento: item.fecha_vencimiento || null,
      empresa_id: empresaId
    };

    const values = FIELDS.map((field) => row[field] ?? null);
    const placeholders = FIELDS.map(() => "?").join(", ");

    const creado = await dbClient.get(
      `INSERT INTO botiquin_items (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    creados.push(creado);
  }

  return creados;
}

async function findByInspeccion(inspeccionId, empresaId) {
  return db.all(
    "SELECT * FROM botiquin_items WHERE inspeccion_id = ? AND empresa_id = ? ORDER BY id ASC",
    [inspeccionId, empresaId]
  );
}

module.exports = { bulkCreate, findByInspeccion };
