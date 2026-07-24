const db = require("../database/query");

const FIELDS = [
  "nombres",
  "apellidos",
  "cedula",
  "telefono",
  "licencia_categoria",
  "licencia_archivo_url",
  "licencia_archivo_nombre",
  "licencia_archivo_mime",
  "email",
  "usuario_id",
  "estado",
  "empresa_id"
];

const SEARCH_COLUMNS = ["nombres", "apellidos", "cedula", "telefono", "email"];

const ORDER_BY = "apellidos ASC, nombres ASC";

function buildWhereClause(filters, empresaId) {
  const conditions = ["empresa_id = ?"];
  const values = [empresaId];

  if (filters.estado) {
    conditions.push("estado = ?");
    values.push(filters.estado);
  }

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
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  const rowsPromise = db.all(
    `SELECT * FROM conductores ${whereClause} ORDER BY ${ORDER_BY} LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM conductores ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return { rows, total: Number(totalRow?.total || 0) };
}

// Listado simple sin paginar, usado por los selectores de "quien entrega" /
// "quien recibe" del acta de entrega y recibida.
async function findAllActivos(empresaId) {
  return db.all(
    `SELECT * FROM conductores WHERE empresa_id = ? AND estado = 'activo' ORDER BY ${ORDER_BY}`,
    [empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM conductores WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function create(conductor) {
  const placeholders = FIELDS.map(() => "?").join(", ");
  const values = FIELDS.map((field) => conductor[field] ?? null);

  return db.get(`INSERT INTO conductores (${FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`, values);
}

async function update(id, conductor, empresaId) {
  const assignments = FIELDS.map((field) => `${field} = ?`).join(", ");
  const values = FIELDS.map((field) => conductor[field] ?? null);

  return db.get(
    `UPDATE conductores SET ${assignments} WHERE id = ? AND empresa_id = ? RETURNING *`,
    [...values, id, empresaId]
  );
}

module.exports = {
  findAll,
  findAllActivos,
  findById,
  create,
  update
};
