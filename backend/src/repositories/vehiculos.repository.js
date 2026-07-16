const db = require("../database/query");

const VEHICULO_FIELDS = [
  "codigo_interno",
  "marca",
  "modelo",
  "anio",
  "color",
  "combustible",
  "cilindraje",
  "capacidad_carga",
  "placa",
  "kilometraje_actual",
  "tipo_vehiculo",
  "tipo_carroceria",
  "numero_chasis",
  "numero_motor"
];

// Campos editables desde la ficha de edicion (incluye estado e imagen, no editables en creacion).
const UPDATE_FIELDS = [...VEHICULO_FIELDS, "estado", "imagen_url"];

// Campos insertables en creacion (VEHICULO_FIELDS mas la imagen, si se subio una, mas empresa_id).
const CREATE_FIELDS = [...VEHICULO_FIELDS, "imagen_url", "empresa_id"];

// Filtros de igualdad exacta soportados por el listado. Agregar un filtro nuevo
// (anio, combustible, etc.) solo requiere una entrada aqui, sin tocar el resto del flujo.
const EXACT_FILTERS = [
  { param: "estado", column: "v.estado" },
  { param: "tipo", column: "v.tipo_vehiculo" },
  { param: "marca", column: "v.marca" }
];

const SEARCH_COLUMNS = [
  "v.placa",
  "v.codigo_interno",
  "v.marca",
  "v.modelo",
  "v.numero_chasis",
  "v.numero_motor"
];

const SORT_OPTIONS = {
  recientes: "v.id DESC",
  antiguos: "v.id ASC",
  placa_asc: "v.placa ASC",
  placa_desc: "v.placa DESC",
  km_mayor: "v.kilometraje_actual DESC",
  km_menor: "v.kilometraje_actual ASC",
  proximo_mantenimiento: "proximo_mantenimiento ASC NULLS LAST"
};

const DEFAULT_SORT = "recientes";

// Subquery correlacionada: la fecha futura mas cercana entre el proximo cambio de
// aceite programado y cualquier mantenimiento con fecha futura ya registrado.
const PROXIMO_MANTENIMIENTO_SUBQUERY = `
  (
    SELECT MIN(fecha_candidata)
    FROM (
      SELECT proximo_cambio_fecha AS fecha_candidata
      FROM mantenimientos
      WHERE vehiculo_id = v.id
        AND proximo_cambio_fecha IS NOT NULL
        AND proximo_cambio_fecha >= CURRENT_DATE
      UNION ALL
      SELECT fecha AS fecha_candidata
      FROM mantenimientos
      WHERE vehiculo_id = v.id
        AND fecha >= CURRENT_DATE
    ) proximas
  )
`;

// empresaId siempre va primero y nunca viene del cliente (query params), solo
// de req.empresaId resuelto en requireAuth -- asi ningun filtro adicional
// puede "desactivar" el aislamiento entre empresas.
function buildWhereClause(filters, empresaId) {
  const conditions = ["v.empresa_id = ?"];
  const values = [empresaId];

  EXACT_FILTERS.forEach(({ param, column }) => {
    if (filters[param]) {
      conditions.push(`${column} = ?`);
      values.push(filters[param]);
    }
  });

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(`(${SEARCH_COLUMNS.map((column) => `${column} ILIKE ?`).join(" OR ")})`);
    SEARCH_COLUMNS.forEach(() => values.push(term));
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

async function findAll(filters = {}, empresaId) {
  const { whereClause, values } = buildWhereClause(filters, empresaId);
  const sortKey = SORT_OPTIONS[filters.sort] ? filters.sort : DEFAULT_SORT;
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const rowsPromise = db.all(
    `
      SELECT v.*, ${PROXIMO_MANTENIMIENTO_SUBQUERY} AS proximo_mantenimiento
      FROM vehiculos v
      ${whereClause}
      ORDER BY ${SORT_OPTIONS[sortKey]}
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(
    `SELECT COUNT(*) AS total FROM vehiculos v ${whereClause}`,
    values
  );

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return {
    rows,
    total: Number(totalRow?.total || 0)
  };
}

// Listado simple sin paginar, usado por selectores de otros modulos (mantenimientos,
// documentos, SIMIT, inicio) que necesitan la lista completa de vehiculos.
async function findAllSimple(empresaId) {
  return db.all("SELECT * FROM vehiculos WHERE empresa_id = ? ORDER BY id DESC", [empresaId]);
}

// SOLO para jobs de cron que recorren TODAS las empresas (ej. actualizarFlota
// de SIMIT): a diferencia de findAllSimple, no se scopea a una empresa porque
// el propio cron necesita procesar la flota de cada empresa por igual. Cada
// fila trae su propio empresa_id para que el caller notifique/guarde en el
// tenant correcto.
async function findAllParaCron() {
  return db.all("SELECT * FROM vehiculos ORDER BY id DESC");
}

async function findDistinctMarcas(empresaId) {
  const rows = await db.all(
    "SELECT DISTINCT marca FROM vehiculos WHERE marca IS NOT NULL AND marca <> '' AND empresa_id = ? ORDER BY marca",
    [empresaId]
  );

  return rows.map((row) => row.marca);
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM vehiculos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function findByPlaca(placa, empresaId) {
  return db.get("SELECT * FROM vehiculos WHERE placa = ? AND empresa_id = ?", [placa, empresaId]);
}

async function create(vehiculo) {
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");
  const values = CREATE_FIELDS.map((field) => vehiculo[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO vehiculos (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO vehiculos (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return db.get("SELECT * FROM vehiculos WHERE id = ?", [result.lastID]);
}

async function update(id, vehiculo, empresaId) {
  const assignments = UPDATE_FIELDS.map((field) => `${field} = ?`).join(", ");
  const values = UPDATE_FIELDS.map((field) => vehiculo[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `UPDATE vehiculos SET ${assignments} WHERE id = ? AND empresa_id = ? RETURNING *`,
      [...values, id, empresaId]
    );
  }

  await db.run(`UPDATE vehiculos SET ${assignments} WHERE id = ? AND empresa_id = ?`, [...values, id, empresaId]);
  return findById(id, empresaId);
}

async function updateEstado(id, estado, empresaId) {
  if (db.client === "postgres") {
    return db.get(
      "UPDATE vehiculos SET estado = ? WHERE id = ? AND empresa_id = ? RETURNING *",
      [estado, id, empresaId]
    );
  }

  await db.run("UPDATE vehiculos SET estado = ? WHERE id = ? AND empresa_id = ?", [estado, id, empresaId]);
  return findById(id, empresaId);
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM vehiculos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

// El intervalo de cambio de aceite es un dato propio del vehiculo, no de un
// repuesto puntual -- se guarda aparte para que una empresa que no usa
// repuestos sugeridos (ver empresas.modulos_deshabilitados) igual pueda
// configurar cada cuantos km le toca el cambio, sin depender de tener al
// menos un repuesto asociado (vehiculo_repuestos_sugeridos.repuesto_id es
// NOT NULL, asi que no admite una fila "solo intervalo, sin repuesto").
async function updateIntervaloCambioAceite(id, intervaloKm, empresaId) {
  return db.get(
    "UPDATE vehiculos SET intervalo_cambio_aceite_km = ? WHERE id = ? AND empresa_id = ? RETURNING *",
    [intervaloKm, id, empresaId]
  );
}

module.exports = {
  findAll,
  findAllSimple,
  findAllParaCron,
  findDistinctMarcas,
  findById,
  findByPlaca,
  create,
  update,
  updateEstado,
  updateIntervaloCambioAceite,
  remove,
  SORT_KEYS: Object.keys(SORT_OPTIONS),
  DEFAULT_SORT
};
