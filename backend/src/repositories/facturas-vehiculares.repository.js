const db = require("../database/query");

const INSERT_FIELDS = [
  "numero_factura",
  "fecha_factura",
  "valor_factura",
  "sala",
  "peso_kg",
  "vehiculo_id",
  "placa_original",
  "conductor_nombre",
  "fecha_envio",
  "observaciones",
  "estado_vehiculo",
  "importacion_creacion_id",
  "importacion_ultima_id",
  "hash_fila",
  "empresa_id"
];

/**
 * Trae, en una sola consulta, las facturas ya existentes cuyo numero_factura
 * aparece en el lote actual. Evita una consulta por fila (el lote de un dia
 * son decenas o cientos de filas).
 *
 * @returns {Promise<Map<string, object>>} numero_factura -> fila en BD
 */
async function findByNumerosFactura(numeros, empresaId) {
  const unicos = [...new Set(numeros.filter(Boolean))];
  if (!unicos.length) return new Map();

  const rows = await db.all(
    "SELECT * FROM facturas_vehiculares WHERE numero_factura = ANY(?) AND empresa_id = ?",
    [unicos, empresaId]
  );

  const mapa = new Map();
  rows.forEach((row) => mapa.set(row.numero_factura, row));
  return mapa;
}

async function create(factura) {
  const values = INSERT_FIELDS.map((field) => factura[field] ?? null);
  const placeholders = INSERT_FIELDS.map(() => "?").join(", ");

  if (db.client === "postgres") {
    return db.get(
      `INSERT INTO facturas_vehiculares (${INSERT_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      values
    );
  }

  const result = await db.run(
    `INSERT INTO facturas_vehiculares (${INSERT_FIELDS.join(", ")}) VALUES (${placeholders})`,
    values
  );
  return db.get("SELECT * FROM facturas_vehiculares WHERE id = ?", [result.lastID]);
}

async function update(id, factura, empresaId) {
  const updateFields = INSERT_FIELDS.filter(
    (field) => field !== "numero_factura" && field !== "importacion_creacion_id" && field !== "empresa_id"
  );
  const assignments = updateFields.map((field) => `${field} = ?`).join(", ");
  const values = updateFields.map((field) => factura[field] ?? null);

  if (db.client === "postgres") {
    return db.get(
      `UPDATE facturas_vehiculares SET ${assignments}, actualizado_en = NOW() WHERE id = ? AND empresa_id = ? RETURNING *`,
      [...values, id, empresaId]
    );
  }

  await db.run(`UPDATE facturas_vehiculares SET ${assignments} WHERE id = ? AND empresa_id = ?`, [...values, id, empresaId]);
  return db.get("SELECT * FROM facturas_vehiculares WHERE id = ? AND empresa_id = ?", [id, empresaId]);
}

async function replaceGastos(facturaId, gastos, importacionId, empresaId) {
  await db.run("DELETE FROM gastos_operativos WHERE factura_id = ? AND empresa_id = ?", [facturaId, empresaId]);

  for (const gasto of gastos) {
    await db.run(
      `
        INSERT INTO gastos_operativos (factura_id, tipo_gasto, valor, unidad, importacion_id, empresa_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [facturaId, gasto.tipo, gasto.valor, gasto.unidad, importacionId, empresaId]
    );
  }
}

module.exports = { findByNumerosFactura, create, update, replaceGastos };
