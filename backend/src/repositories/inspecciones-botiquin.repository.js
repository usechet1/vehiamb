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

// Los totales se calculan con subconsultas correlacionadas sobre
// botiquin_items en vez de un JOIN + GROUP BY: evita que la cabecera se
// duplique por cada item y deja el ORDER BY del listado intacto.
const TOTALES_SELECT = `
  (SELECT COUNT(*) FROM botiquin_items bi WHERE bi.inspeccion_id = i.id) AS total_items,
  (SELECT COUNT(*) FROM botiquin_items bi WHERE bi.inspeccion_id = i.id AND bi.estado = 'malo') AS total_items_malos
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
      FROM inspecciones_botiquin i
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
      FROM inspecciones_botiquin i
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
    `INSERT INTO inspecciones_botiquin (${INSPECCION_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

async function remove(id, empresaId) {
  return db.run("DELETE FROM inspecciones_botiquin WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

module.exports = {
  findAll,
  findById,
  create,
  remove
};
