const db = require("../database/query");

const DOCUMENTO_FIELDS = [
  "vehiculo_id",
  "tipo",
  "numero_documento",
  "fecha_expedicion",
  "fecha_vencimiento",
  "archivo_url",
  "archivo_nombre",
  "archivo_mime",
  "empresa_id"
];

async function findAll(empresaId) {
  return db.all(
    `
    SELECT
      d.*,
      v.placa,
      v.marca,
      v.modelo
    FROM documentos d
    INNER JOIN vehiculos v ON v.id = d.vehiculo_id
    WHERE d.empresa_id = ?
    ORDER BY d.fecha_vencimiento ASC, d.id DESC
  `,
    [empresaId]
  );
}

async function findByVehicle(vehiculoId, empresaId) {
  return db.all(
    `
      SELECT *
      FROM documentos
      WHERE vehiculo_id = ? AND empresa_id = ?
      ORDER BY fecha_vencimiento ASC, id DESC
    `,
    [vehiculoId, empresaId]
  );
}

async function findById(id, empresaId) {
  return db.get("SELECT * FROM documentos WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function create(documento) {
  const placeholders = DOCUMENTO_FIELDS.map(() => "?").join(", ");
  const values = DOCUMENTO_FIELDS.map((field) => documento[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO documentos (${DOCUMENTO_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO documentos (${DOCUMENTO_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );

  return db.get("SELECT * FROM documentos WHERE id = ?", [result.lastID]);
}

module.exports = {
  findAll,
  findByVehicle,
  findById,
  create
};
