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

// Campos insertables en creacion (VEHICULO_FIELDS mas la imagen, si se subio una).
const CREATE_FIELDS = [...VEHICULO_FIELDS, "imagen_url"];

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

function buildWhereClause(filters) {
  const conditions = [];
  const values = [];

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
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

async function findAll(filters = {}) {
  const { whereClause, values } = buildWhereClause(filters);
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
async function findAllSimple() {
  return db.all("SELECT * FROM vehiculos ORDER BY id DESC");
}

async function findDistinctMarcas() {
  const rows = await db.all(
    "SELECT DISTINCT marca FROM vehiculos WHERE marca IS NOT NULL AND marca <> '' ORDER BY marca"
  );

  return rows.map((row) => row.marca);
}

async function findById(id) {
  return db.get("SELECT * FROM vehiculos WHERE id = ?", [id]);
}

async function findByPlaca(placa) {
  return db.get("SELECT * FROM vehiculos WHERE placa = ?", [placa]);
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

  return findById(result.lastID);
}

async function update(id, vehiculo) {
  const assignments = UPDATE_FIELDS.map((field) => `${field} = ?`).join(", ");
  const values = UPDATE_FIELDS.map((field) => vehiculo[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `UPDATE vehiculos SET ${assignments} WHERE id = ? RETURNING *`,
      [...values, id]
    );
  }

  await db.run(`UPDATE vehiculos SET ${assignments} WHERE id = ?`, [...values, id]);
  return findById(id);
}

async function updateEstado(id, estado) {
  if (db.client === "postgres") {
    return db.get("UPDATE vehiculos SET estado = ? WHERE id = ? RETURNING *", [estado, id]);
  }

  await db.run("UPDATE vehiculos SET estado = ? WHERE id = ?", [estado, id]);
  return findById(id);
}

async function remove(id) {
  return db.run("DELETE FROM vehiculos WHERE id = ?", [id]);
}

module.exports = {
  findAll,
  findAllSimple,
  findDistinctMarcas,
  findById,
  findByPlaca,
  create,
  update,
  updateEstado,
  remove,
  SORT_KEYS: Object.keys(SORT_OPTIONS),
  DEFAULT_SORT
};
