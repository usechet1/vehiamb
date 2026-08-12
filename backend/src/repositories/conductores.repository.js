const db = require("../database/query");

const FIELDS = [
  "nombres",
  "apellidos",
  "cedula",
  "telefono",
  "email",
  "usuario_id",
  "estado",
  "excluir_de_costos",
  "empresa_id"
];

const SEARCH_COLUMNS = ["nombres", "apellidos", "cedula", "telefono", "email"];

const ORDER_BY = "apellidos ASC, nombres ASC";

// Resumen de licencias (una fila por conductor, N licencias por conductor_licencias)
// para no forzar al listado/detalle a hacer una consulta aparte por cada uno.
const LICENCIAS_RESUMEN_SUBQUERY = `
  (
    SELECT STRING_AGG(
      cl.categoria || COALESCE(' (vence ' || TO_CHAR(cl.fecha_vencimiento, 'DD/MM/YYYY') || ')', ''),
      ', ' ORDER BY cl.categoria
    )
    FROM conductor_licencias cl
    WHERE cl.conductor_id = conductores.id
  ) AS licencias_resumen
`;

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
    `SELECT conductores.*, ${LICENCIAS_RESUMEN_SUBQUERY} FROM conductores ${whereClause} ORDER BY ${ORDER_BY} LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const totalPromise = db.get(`SELECT COUNT(*) AS total FROM conductores ${whereClause}`, values);

  const [rows, totalRow] = await Promise.all([rowsPromise, totalPromise]);

  return { rows, total: Number(totalRow?.total || 0) };
}

async function findById(id, empresaId) {
  return db.get(
    `SELECT conductores.*, ${LICENCIAS_RESUMEN_SUBQUERY} FROM conductores WHERE id = ? AND empresa_id = ?`,
    [id, empresaId]
  );
}

// Ficha del conductor vinculada a la cuenta de usuario que inicio sesion
// (usado por "Mi ultimo viaje" para mostrar su propia licencia sin pedirle
// que la busque en el catalogo).
async function findByUsuarioId(usuarioId, empresaId) {
  return db.get("SELECT * FROM conductores WHERE usuario_id = ? AND empresa_id = ?", [usuarioId, empresaId]);
}

// Usado para bloquear cedulas duplicadas al crear/editar un conductor -- ver
// createConductor/updateConductor en conductores.service.js.
async function findByCedula(cedula, empresaId) {
  return db.get("SELECT id FROM conductores WHERE cedula = ? AND empresa_id = ?", [cedula, empresaId]);
}

// Listado liviano (solo lo necesario para comparar identidad) usado por
// comparendo-conductor-matcher.js al cruzar el nombre/cedula enmascarados de
// un comparendo SIMIT contra todos los conductores de la empresa.
async function findAllParaMatching(empresaId) {
  return db.all("SELECT id, nombres, apellidos, cedula FROM conductores WHERE empresa_id = ?", [empresaId]);
}

// Listado completo (sin paginar) de conductores activos, para poblar selects
// como el de asignacion de rutas -- findAll() sirve al listado paginado de
// la pantalla de Conductores, con un limite maximo de 100 por pagina, que se
// queda corto para un dropdown con toda la flota de conductores.
async function findActivosCatalogo(empresaId) {
  return db.all(
    "SELECT id, nombres, apellidos, telefono FROM conductores WHERE empresa_id = ? AND estado = 'activo' ORDER BY apellidos ASC, nombres ASC",
    [empresaId]
  );
}

// Conductores activos sin cuenta de usuario vinculada -- candidatos para
// aparecer en selects como "quien entrega/recibe" de un acta (ver
// entregas-recibidas.service.js) sin obligarlos a tener login. Los que ya
// tienen usuario_id no se listan aqui porque ya aparecen via la tabla
// usuarios, y listarlos dos veces duplicaria la opcion en el select.
async function findActivosSinUsuario(empresaId) {
  return db.all(
    "SELECT id, nombres, apellidos FROM conductores WHERE empresa_id = ? AND usuario_id IS NULL AND estado = 'activo'",
    [empresaId]
  );
}

// Vincula retroactivamente un conductor a una cuenta de usuario creada
// "sobre la marcha" (ver entregas-recibidas.service.js resolverParticipante).
async function vincularUsuario(id, usuarioId, empresaId) {
  return db.run("UPDATE conductores SET usuario_id = ? WHERE id = ? AND empresa_id = ?", [usuarioId, id, empresaId]);
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
  findById,
  findByUsuarioId,
  findByCedula,
  findAllParaMatching,
  findActivosCatalogo,
  findActivosSinUsuario,
  vincularUsuario,
  create,
  update
};
