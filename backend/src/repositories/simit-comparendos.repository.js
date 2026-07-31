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
  "cedula_infractor",
  "nombre_infractor",
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
      cedula_infractor: comparendo.cedula_infractor || null,
      nombre_infractor: comparendo.nombre_infractor || null,
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

// Persona (por cedula_infractor) con mas comparendos distintos en toda la
// flota. Se cuenta DISTINCT numero_comparendo porque cada consulta SIMIT
// reinserta su propia muestra de filas (ver bulkCreate) -- el mismo
// comparendo puede quedar duplicado entre varias consultas del mismo
// vehiculo si no cambio, y contar filas crudas lo sobrestimaria.
async function findInfractorConMasComparendos(empresaId) {
  return db.get(
    `
      SELECT cedula_infractor, nombre_infractor, COUNT(DISTINCT numero_comparendo) AS total_comparendos
      FROM simit_comparendos
      WHERE empresa_id = ? AND cedula_infractor IS NOT NULL
      GROUP BY cedula_infractor, nombre_infractor
      ORDER BY total_comparendos DESC
      LIMIT 1
    `,
    [empresaId]
  );
}

module.exports = {
  bulkCreate,
  findByConsulta,
  findInfractorConMasComparendos
};
