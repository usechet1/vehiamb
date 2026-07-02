const db = require("../database/query");

const REPUESTO_FIELDS = [
  "codigo_interno",
  "nombre",
  "categoria",
  "marca",
  "referencia",
  "unidad_medida",
  "valor_promedio",
  "estado",
  "observaciones"
];

const SEARCH_COLUMNS = ["r.codigo_interno", "r.nombre", "r.referencia"];

// El stock se trae con un LEFT JOIN simple porque en esta fase solo existe
// una bodega (UNIQUE(repuesto_id, bodega_id) garantiza a lo sumo una fila por
// repuesto hoy). Cuando se activen varias bodegas, esto pasa a ser una
// agregacion (SUM stock_fisico, etc.) en vez de un join directo.
const STOCK_JOIN = `
  LEFT JOIN repuestos_stock rs ON rs.repuesto_id = r.id
`;

const STOCK_COLUMNS = `
  COALESCE(rs.stock_fisico, 0) AS stock_fisico,
  COALESCE(rs.stock_minimo, 0) AS stock_minimo,
  COALESCE(rs.stock_fisico, 0) - COALESCE(rs.stock_comprometido, 0) AS stock_disponible,
  rs.actualizado_en AS stock_actualizado_en
`;

function buildWhereClause(filters) {
  const conditions = [];
  const values = [];

  if (filters.categoria) {
    conditions.push("r.categoria = ?");
    values.push(filters.categoria);
  }

  if (filters.estado) {
    conditions.push("r.estado = ?");
    values.push(filters.estado);
  }

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
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const rowsPromise = db.all(
    `
      SELECT r.*, ${STOCK_COLUMNS}
      FROM repuestos r
      ${STOCK_JOIN}
      ${whereClause}
      ORDER BY r.nombre ASC
      LIMIT ? OFFSET ?
    `,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM repuestos r ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return { rows, total: Number(totalRow?.total || 0) };
}

// Buscador predictivo usado por el autocomplete del formulario de mantenimiento
// (Fase 2). Solo trae repuestos activos, limitado a pocas filas.
async function buscar(term, limit = 10) {
  const like = `%${term}%`;

  return db.all(
    `
      SELECT r.*, ${STOCK_COLUMNS}
      FROM repuestos r
      ${STOCK_JOIN}
      WHERE r.estado = 'activo' AND (${SEARCH_COLUMNS.map((column) => `${column} ILIKE ?`).join(" OR ")})
      ORDER BY r.nombre ASC
      LIMIT ?
    `,
    [like, like, like, limit]
  );
}

async function findById(id) {
  return db.get(
    `
      SELECT r.*, ${STOCK_COLUMNS}
      FROM repuestos r
      ${STOCK_JOIN}
      WHERE r.id = ?
    `,
    [id]
  );
}

async function findByCodigoInterno(codigoInterno) {
  return db.get("SELECT * FROM repuestos WHERE codigo_interno = ?", [codigoInterno]);
}

/**
 * Trae, en una sola consulta, los repuestos ya existentes cuyo codigo_interno
 * aparece en el lote actual de una importacion de stock. Mismo patron que
 * facturas-vehiculares.repository.findByNumerosFactura.
 *
 * @returns {Promise<Map<string, object>>} codigo_interno -> fila en BD
 */
async function findByCodigosInternos(codigos) {
  const unicos = [...new Set(codigos.filter(Boolean))];
  if (!unicos.length) return new Map();

  const rows = await db.all("SELECT * FROM repuestos WHERE codigo_interno = ANY(?)", [unicos]);

  const mapa = new Map();
  rows.forEach((row) => mapa.set(row.codigo_interno, row));
  return mapa;
}

async function create(repuesto) {
  const placeholders = REPUESTO_FIELDS.map(() => "?").join(", ");
  const values = REPUESTO_FIELDS.map((field) => repuesto[field] ?? null);

  return db.get(
    `INSERT INTO repuestos (${REPUESTO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function update(id, repuesto) {
  const assignments = REPUESTO_FIELDS.map((field) => `${field} = ?`).join(", ");
  const values = REPUESTO_FIELDS.map((field) => repuesto[field] ?? null);

  return db.get(
    `UPDATE repuestos SET ${assignments}, actualizado_en = NOW() WHERE id = ? RETURNING *`,
    [...values, id]
  );
}

// Actualizacion parcial usada por la importacion de stock: solo toca los
// campos que vienen del ERP (nombre, unidad, valor promedio). Nunca toca
// categoria/marca/referencia/estado/observaciones -- esos son datos que
// administra VehiAmb y la importacion no debe pisarlos.
async function updateDatosImportados(id, { nombre, unidad_medida, valor_promedio }) {
  return db.get(
    `
      UPDATE repuestos
      SET nombre = ?, unidad_medida = ?, valor_promedio = ?, actualizado_en = NOW()
      WHERE id = ?
      RETURNING *
    `,
    [nombre, unidad_medida, valor_promedio, id]
  );
}

module.exports = {
  findAll,
  buscar,
  findById,
  findByCodigoInterno,
  findByCodigosInternos,
  create,
  update,
  updateDatosImportados
};
