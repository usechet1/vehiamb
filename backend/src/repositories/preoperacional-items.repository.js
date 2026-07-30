const db = require("../database/query");

const FIELDS = [
  "preoperacional_id",
  "vehiculo_id",
  "item_codigo",
  "item_label",
  "respuesta",
  "observacion",
  "empresa_id"
];

async function bulkCreate(preoperacionalId, vehiculoId, items, empresaId, dbClient = db) {
  if (!items.length) return [];

  const creados = [];
  for (const item of items) {
    const row = {
      preoperacional_id: preoperacionalId,
      vehiculo_id: vehiculoId,
      item_codigo: item.item_codigo,
      item_label: item.item_label,
      respuesta: item.respuesta,
      observacion: item.observacion || null,
      empresa_id: empresaId
    };

    const values = FIELDS.map((field) => row[field] ?? null);
    const placeholders = FIELDS.map(() => "?").join(", ");

    const creado = await dbClient.get(
      `INSERT INTO preoperacional_items (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    creados.push(creado);
  }

  return creados;
}

async function findByPreoperacional(preoperacionalId, empresaId) {
  return db.all(
    "SELECT * FROM preoperacional_items WHERE preoperacional_id = ? AND empresa_id = ? ORDER BY id ASC",
    [preoperacionalId, empresaId]
  );
}

module.exports = { bulkCreate, findByPreoperacional };
