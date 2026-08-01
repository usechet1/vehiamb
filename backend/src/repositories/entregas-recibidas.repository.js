const db = require("../database/query");

const CREATE_FIELDS = [
  "vehiculo_id",
  "usuario_id",
  "usuario_entrega_id",
  "usuario_recibe_id",
  "motivo",
  "kilometraje",
  "observaciones",
  "firma_entrega_url",
  "firma_entrega_nombre",
  "firma_recibe_url",
  "firma_recibe_nombre",
  "fotos_generales_json",
  "empresa_id"
];

async function create(entrega, dbClient = db) {
  const values = CREATE_FIELDS.map((field) => entrega[field] ?? null);
  const placeholders = CREATE_FIELDS.map(() => "?").join(", ");

  return dbClient.get(
    `INSERT INTO entregas_recibidas (${CREATE_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
}

// "Quien entrega"/"quien recibe" son usuarios de la empresa (no se limitan al
// catalogo de Conductores: un conductor le puede entregar el vehiculo a su
// jefe y viceversa), ver [[feedback_nombres_apellidos_separados]] para el
// porque conductores.nombres/apellidos van separados (no aplica aqui, son
// usuarios con un unico campo "nombre").
const SELECT_BASE = `
  SELECT
    er.*,
    u.nombre AS usuario_nombre,
    ue.nombre AS usuario_entrega_nombre,
    ue.email AS usuario_entrega_email,
    ur.nombre AS usuario_recibe_nombre,
    ur.email AS usuario_recibe_email
  FROM entregas_recibidas er
  LEFT JOIN usuarios u ON u.id = er.usuario_id
  LEFT JOIN usuarios ue ON ue.id = er.usuario_entrega_id
  LEFT JOIN usuarios ur ON ur.id = er.usuario_recibe_id
`;

async function findById(id, empresaId) {
  return db.get(`${SELECT_BASE} WHERE er.id = ? AND er.empresa_id = ?`, [id, empresaId]);
}

// Historial de un vehiculo, mas reciente primero, con el conteo de items con
// novedades (rayones, golpes, etc.) para un badge rapido sin cargar el detalle.
async function findByVehiculo(vehiculoId, empresaId, { limit = 50 } = {}) {
  return db.all(
    `
      SELECT
        er.*,
        u.nombre AS usuario_nombre,
        ue.nombre AS usuario_entrega_nombre,
        ue.email AS usuario_entrega_email,
        ur.nombre AS usuario_recibe_nombre,
        ur.email AS usuario_recibe_email,
        COUNT(*) FILTER (WHERE ei.estado = 'mal') AS total_items_mal,
        COUNT(ei.id) AS total_items
      FROM entregas_recibidas er
      LEFT JOIN usuarios u ON u.id = er.usuario_id
      LEFT JOIN usuarios ue ON ue.id = er.usuario_entrega_id
      LEFT JOIN usuarios ur ON ur.id = er.usuario_recibe_id
      LEFT JOIN entrega_items ei ON ei.entrega_id = er.id
      WHERE er.vehiculo_id = ? AND er.empresa_id = ?
      GROUP BY er.id, u.nombre, ue.nombre, ue.email, ur.nombre, ur.email
      ORDER BY er.fecha DESC, er.id DESC
      LIMIT ?
    `,
    [vehiculoId, empresaId, limit]
  );
}

module.exports = { create, findById, findByVehiculo };
