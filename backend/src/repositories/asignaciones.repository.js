const db = require("../database/query");

const CREATE_FIELDS = ["fecha", "conductor_id", "vehiculo_id", "ruta_id", "telefono", "usuario_id", "empresa_id"];

const SELECT_JOIN = `
  SELECT
    ar.*,
    c.nombres AS conductor_nombres,
    c.apellidos AS conductor_apellidos,
    v.placa AS vehiculo_placa,
    r.nombre AS ruta_nombre
  FROM asignaciones_ruta ar
  LEFT JOIN conductores c ON c.id = ar.conductor_id
  LEFT JOIN vehiculos v ON v.id = ar.vehiculo_id
  LEFT JOIN rutas r ON r.id = ar.ruta_id
`;

async function create(asignacion) {
  const values = CREATE_FIELDS.map((field) => asignacion[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  const creada = await db.get(
    `INSERT INTO asignaciones_ruta (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING id`,
    values
  );

  return findById(creada.id, asignacion.empresa_id);
}

async function update(id, asignacion, empresaId) {
  const campos = ["conductor_id", "vehiculo_id", "ruta_id", "telefono"];
  const assignments = campos.map((field) => `${field} = ?`).join(", ");
  const values = campos.map((field) => asignacion[field] ?? null);

  await db.run(`UPDATE asignaciones_ruta SET ${assignments} WHERE id = ? AND empresa_id = ?`, [...values, id, empresaId]);
  return findById(id, empresaId);
}

async function findById(id, empresaId) {
  return db.get(`${SELECT_JOIN} WHERE ar.id = ? AND ar.empresa_id = ?`, [id, empresaId]);
}

// Orden de creacion (id ASC) para que coincida con el numero de fila (#) del
// reporte impreso -- se van agregando en el orden en que salen los vehiculos.
async function findByFecha(fecha, empresaId) {
  return db.all(`${SELECT_JOIN} WHERE ar.empresa_id = ? AND ar.fecha = ? ORDER BY ar.id ASC`, [empresaId, fecha]);
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM asignaciones_ruta WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = { create, update, findById, findByFecha, remove };
