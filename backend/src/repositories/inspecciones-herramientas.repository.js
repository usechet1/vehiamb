const db = require("../database/query");

const INSPECCION_FIELDS = [
  "vehiculo_id",
  "fecha",
  "inspeccionado_por_nombres",
  "inspeccionado_por_apellidos",
  "inspeccionado_por_cargo",
  "revisado_por_nombres",
  "revisado_por_apellidos",
  "revisado_por_cargo",
  "observaciones",
  "usuario_id",
  "empresa_id"
];

// Mismo criterio que inspecciones-botiquin.repository.js: los totales se
// calculan con subconsultas correlacionadas sobre herramientas_items en vez
// de un JOIN + GROUP BY, para que la cabecera no se duplique por cada item.
const TOTALES_SELECT = `
  (SELECT COUNT(*) FROM herramientas_items hi WHERE hi.inspeccion_id = i.id) AS total_items,
  (SELECT COUNT(*) FROM herramientas_items hi WHERE hi.inspeccion_id = i.id AND hi.estado = 'malo') AS total_items_malos
`;

async function findAll({ vehiculoId, fechaDesde, fechaHasta } = {}, empresaId) {
  const conditions = ["i.empresa_id = ?"];
  const params = [empresaId];

  if (vehiculoId) {
    conditions.push("i.vehiculo_id = ?");
    params.push(vehiculoId);
  }

  if (fechaDesde) {
    conditions.push("i.fecha >= ?");
    params.push(fechaDesde);
  }

  if (fechaHasta) {
    conditions.push("i.fecha <= ?");
    params.push(fechaHasta);
  }

  return db.all(
    `
      SELECT i.*, v.placa, v.marca, v.modelo, ${TOTALES_SELECT}
      FROM inspecciones_herramientas i
      INNER JOIN vehiculos v ON v.id = i.vehiculo_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.fecha DESC, i.id DESC
    `,
    params
  );
}

async function findById(id, empresaId) {
  return db.get(
    `
      SELECT i.*, v.placa, v.marca, v.modelo, ${TOTALES_SELECT}
      FROM inspecciones_herramientas i
      INNER JOIN vehiculos v ON v.id = i.vehiculo_id
      WHERE i.id = ? AND i.empresa_id = ?
    `,
    [id, empresaId]
  );
}

async function create(inspeccion) {
  const placeholders = INSPECCION_FIELDS.map(() => "?").join(", ");
  const values = INSPECCION_FIELDS.map((field) => inspeccion[field] ?? null);

  return db.get(
    `INSERT INTO inspecciones_herramientas (${INSPECCION_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM inspecciones_herramientas WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findAll,
  findById,
  create,
  remove
};
