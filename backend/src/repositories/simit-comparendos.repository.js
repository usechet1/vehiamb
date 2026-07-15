const db = require("../database/query");

const FIELDS = [
  "consulta_id",
  "vehiculo_id",
  "numero_comparendo",
  "fecha_infraccion",
  "descripcion",
  "valor",
  "estado",
  "detalle_json",
  "empresa_id"
];

async function bulkCreate(consultaId, vehiculoId, comparendos, empresaId, dbClient = db) {
  if (!comparendos.length) return [];

  const creados = [];
  for (const comparendo of comparendos) {
    const row = {
      consulta_id: consultaId,
      vehiculo_id: vehiculoId,
      numero_comparendo: comparendo.numero_comparendo,
      fecha_infraccion: comparendo.fecha_infraccion,
      descripcion: comparendo.descripcion,
      valor: comparendo.valor,
      estado: comparendo.estado,
      detalle_json: comparendo.detalle ? JSON.stringify(comparendo.detalle) : null,
      empresa_id: empresaId
    };

    const values = FIELDS.map((field) => row[field] ?? null);
    const placeholders = FIELDS.map(() => "?").join(", ");

    const creado = await dbClient.get(
      `INSERT INTO simit_comparendos (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    creados.push(creado);
  }

  return creados;
}

async function findByConsulta(consultaId, empresaId) {
  return db.all(
    "SELECT * FROM simit_comparendos WHERE consulta_id = ? AND empresa_id = ? ORDER BY fecha_infraccion DESC NULLS LAST, id ASC",
    [consultaId, empresaId]
  );
}

module.exports = {
  bulkCreate,
  findByConsulta
};
