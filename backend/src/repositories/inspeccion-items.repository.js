const db = require("../database/query");

const FIELDS = [
  "inspeccion_id",
  "vehiculo_id",
  "item_codigo",
  "item_label",
  "estado",
  "comentario",
  "foto_url",
  "foto_nombre"
];

async function bulkCreate(inspeccionId, vehiculoId, items, dbClient = db) {
  if (!items.length) return [];

  const creados = [];
  for (const item of items) {
    const row = {
      inspeccion_id: inspeccionId,
      vehiculo_id: vehiculoId,
      item_codigo: item.item_codigo,
      item_label: item.item_label,
      estado: item.estado,
      comentario: item.comentario || null,
      foto_url: item.foto_url || null,
      foto_nombre: item.foto_nombre || null
    };

    const values = FIELDS.map((field) => row[field] ?? null);
    const placeholders = FIELDS.map(() => "?").join(", ");

    const creado = await dbClient.get(
      `INSERT INTO inspeccion_items (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    creados.push(creado);
  }

  return creados;
}

async function findByInspeccion(inspeccionId) {
  return db.all("SELECT * FROM inspeccion_items WHERE inspeccion_id = ? ORDER BY id ASC", [inspeccionId]);
}

module.exports = { bulkCreate, findByInspeccion };
