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
  "resultado_raw"
];

async function create(consulta, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => consulta[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO simit_consultas (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function findById(id) {
  return db.get("SELECT * FROM simit_consultas WHERE id = ?", [id]);
}

// Historial de un vehiculo, mas reciente primero.
async function findByVehiculo(vehiculoId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT *
      FROM simit_consultas
      WHERE vehiculo_id = ?
      ORDER BY fecha_consulta DESC, id DESC
      LIMIT ?
    `,
    [vehiculoId, limit]
  );
}

// Segunda consulta mas reciente de un vehiculo (la anterior a la que se acaba
// de insertar), usada para comparar y detectar novedades.
async function findAnteriorByVehiculo(vehiculoId, consultaActualId) {
  return db.get(
    `
      SELECT *
      FROM simit_consultas
      WHERE vehiculo_id = ? AND id <> ?
      ORDER BY fecha_consulta DESC, id DESC
      LIMIT 1
    `,
    [vehiculoId, consultaActualId]
  );
}

// Ultimo estado por vehiculo para el tablero de tarjetas. Parte de "vehiculos"
// con LEFT JOIN para que los que nunca se han consultado tambien aparezcan
// (con estado_consulta/estado_cartera en NULL, que el service interpreta como
// "nunca consultado"). Filtros de estado de cartera y busqueda por placa.
// Usa DISTINCT ON, disponible en Postgres (unico motor soportado por este modulo).
async function findUltimoEstadoPorFlota(filters = {}) {
  const conditions = [];
  const values = [];

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

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

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
        ultimas.mensaje_error
      FROM vehiculos v
      LEFT JOIN (
        SELECT DISTINCT ON (sc.vehiculo_id) sc.*
        FROM simit_consultas sc
        ORDER BY sc.vehiculo_id, sc.fecha_consulta DESC, sc.id DESC
      ) ultimas ON ultimas.vehiculo_id = v.id
      ${whereClause}
      ORDER BY ultimas.fecha_consulta DESC NULLS LAST, v.placa ASC
    `,
    values
  );
}

module.exports = {
  create,
  findById,
  findByVehiculo,
  findAnteriorByVehiculo,
  findUltimoEstadoPorFlota
};
