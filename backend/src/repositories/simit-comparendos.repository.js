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
  "conductor_id",
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
      conductor_id: comparendo.conductor_id || null,
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
    `
      SELECT sc.*, c.nombres AS conductor_nombres, c.apellidos AS conductor_apellidos
      FROM simit_comparendos sc
      LEFT JOIN conductores c ON c.id = sc.conductor_id
      WHERE sc.consulta_id = ? AND sc.empresa_id = ?
      ORDER BY sc.fecha_infraccion DESC NULLS LAST, sc.id ASC
    `,
    [consultaId, empresaId]
  );
}

// Comparendos sin conductor vinculado todavia pero con datos suficientes
// para intentarlo (usado por el backfill puntual, ver
// scripts/matchear-comparendos.js) -- no se re-intenta en cada consulta de
// aqui en adelante, solo al registrar comparendos nuevos (ver
// simit.service.js consultarVehiculo).
async function findSinConductorVinculado(empresaId) {
  return db.all(
    "SELECT * FROM simit_comparendos WHERE empresa_id = ? AND conductor_id IS NULL AND cedula_infractor IS NOT NULL",
    [empresaId]
  );
}

async function actualizarConductor(id, conductorId, empresaId) {
  return db.run(
    "UPDATE simit_comparendos SET conductor_id = ? WHERE id = ? AND empresa_id = ?",
    [conductorId, id, empresaId]
  );
}

// Conteos crudos por cedula_infractor + nombre_infractor exactos, SIN
// colapsar por cedula sola: SIMIT enmascara siempre la misma cantidad de
// digitos finales de la cedula, asi que personas reales distintas pueden
// compartir el mismo cedula_infractor visible (mismo prefijo) -- agrupar
// solo por cedula mezclaria infracciones de gente distinta bajo un mismo
// nombre. El agrupamiento tolerante a variantes de nombre (para el mismo
// cedula_infractor) se hace en el service, comparando los nombres entre si
// con coincidencia de mascara (ver comparendo-conductor-matcher.js
// nombresCompatibles) antes de decidir si dos filas son la misma persona.
// Se cuenta DISTINCT numero_comparendo porque cada consulta SIMIT reinserta
// su propia muestra de filas (ver bulkCreate).
async function findConteosInfractores(empresaId) {
  return db.all(
    `
      SELECT cedula_infractor, nombre_infractor, COUNT(DISTINCT numero_comparendo) AS total_comparendos
      FROM simit_comparendos
      WHERE empresa_id = ? AND cedula_infractor IS NOT NULL
      GROUP BY cedula_infractor, nombre_infractor
    `,
    [empresaId]
  );
}

module.exports = {
  bulkCreate,
  findByConsulta,
  findConteosInfractores,
  findSinConductorVinculado,
  actualizarConductor
};
