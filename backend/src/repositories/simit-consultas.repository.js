const db = require("../database/query");

const CREATE_FIELDS = [
  "vehiculo_id",
  "placa",
  "origen",
  "estado_consulta",
  "estado_cartera",
  "total_comparendos",
  "valor_total",
  "mensaje_error",
  "resultado_raw",
  "empresa_id"
];

async function create(consulta, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => consulta[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO simit_consultas (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM simit_consultas WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// Historial de un vehiculo, mas reciente primero.
async function findByVehiculo(vehiculoId, empresaId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT *
      FROM simit_consultas
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha_consulta DESC, id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

// Segunda consulta mas reciente de un vehiculo (la anterior a la que se acaba
// de insertar), usada para comparar y detectar novedades.
async function findAnteriorByVehiculo(vehiculoId, consultaActualId, empresaId) {
  return db.get(
    `
      SELECT *
      FROM simit_consultas
      WHERE vehiculo_id = ? AND id <> ? AND empresa_id = ?
      ORDER BY fecha_consulta DESC, id DESC
      LIMIT 1
    `,
    [vehiculoId, consultaActualId, empresaId]
  );
}

// Ultimo estado por vehiculo para el tablero de tarjetas. Parte de "vehiculos"
// con LEFT JOIN para que los que nunca se han consultado tambien aparezcan
// (con estado_consulta/estado_cartera en NULL, que el service interpreta como
// "nunca consultado"). Filtros de estado de cartera y busqueda por placa.
// Usa DISTINCT ON, disponible en Postgres (unico motor soportado por este modulo).
async function findUltimoEstadoPorFlota(filters = {}, empresaId) {
  const conditions = ["v.empresa_id = ?"];
  const values = [empresaId];

  if (filters.estado_cartera === "nunca_consultado") {
    conditions.push("ultimas.id IS NULL");
  } else if (filters.estado_cartera) {
    conditions.push("ultimas.estado_cartera = ?");
    values.push(filters.estado_cartera);
  }

  if (filters.placa) {
    conditions.push("v.placa ILIKE ?");
    values.push(`%${filters.placa}%`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  return db.all(
    `
      SELECT
        v.id AS vehiculo_id,
        v.placa,
        v.marca,
        v.modelo,
        v.codigo_interno,
        ultimas.id,
        ultimas.fecha_consulta,
        ultimas.origen,
        ultimas.estado_consulta,
        ultimas.estado_cartera,
        ultimas.total_comparendos,
        ultimas.valor_total,
        ultimas.mensaje_error,
        COALESCE(conductores_ultima.conductores, '[]'::jsonb) AS conductores
      FROM vehiculos v
      LEFT JOIN (
        SELECT DISTINCT ON (sc.vehiculo_id) sc.*
        FROM simit_consultas sc
        ORDER BY sc.vehiculo_id, sc.fecha_consulta DESC, sc.id DESC
      ) ultimas ON ultimas.vehiculo_id = v.id
      LEFT JOIN LATERAL (
        SELECT JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('id', comp.conductor_id, 'nombre', c.nombres || ' ' || c.apellidos)) AS conductores
        FROM simit_comparendos comp
        LEFT JOIN conductores c ON c.id = comp.conductor_id
        WHERE comp.consulta_id = ultimas.id AND comp.conductor_id IS NOT NULL
      ) conductores_ultima ON true
      ${whereClause}
      ORDER BY ultimas.fecha_consulta DESC NULLS LAST, v.placa ASC
    `,
    values
  );
}

// Suma, para toda la flota de la empresa, el valor_total de la consulta mas
// reciente de cada vehiculo que sea de al menos "dias" de antiguedad (la
// consulta previa mas cercana a ese punto en el tiempo, no exactamente esa
// fecha). Sirve para comparar el valor total de hoy contra el de hace N dias
// y mostrar una tendencia en el KPI. Vehiculos sin ninguna consulta tan
// antigua simplemente no aportan al total (se tratan como 0, igual que
// "nunca consultado" en el resto del modulo).
async function sumValorTotalHaceDias(dias, empresaId) {
  const row = await db.get(
    `
      SELECT COALESCE(SUM(anterior.valor_total), 0) AS valor_total
      FROM vehiculos v
      LEFT JOIN LATERAL (
        SELECT sc.valor_total
        FROM simit_consultas sc
        WHERE sc.vehiculo_id = v.id
          AND sc.estado_consulta = 'ok'
          AND sc.fecha_consulta <= NOW() - (? || ' days')::interval
        ORDER BY sc.fecha_consulta DESC
        LIMIT 1
      ) anterior ON true
      WHERE v.empresa_id = ?
    `,
    [dias, empresaId]
  );

  return Number(row?.valor_total || 0);
}

module.exports = {
  create,
  findById,
  findByVehiculo,
  findAnteriorByVehiculo,
  findUltimoEstadoPorFlota,
  sumValorTotalHaceDias
};
