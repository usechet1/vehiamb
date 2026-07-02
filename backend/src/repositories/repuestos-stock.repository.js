const db = require("../database/query");

async function findBodegaPrincipal(dbClient = db) {
  return dbClient.get("SELECT * FROM bodegas WHERE codigo = 'PRINCIPAL'");
}

/**
 * Lee el stock de un repuesto con FOR UPDATE -- solo tiene sentido dentro de
 * una transaccion (withTransaction), para que dos mantenimientos guardados
 * al mismo tiempo no descuenten el mismo stock dos veces (evita condicion de
 * carrera). "dbClient" es el cliente escopeado que entrega withTransaction.
 */
async function findByRepuestoIdForUpdate(repuestoId, bodegaId, dbClient) {
  return dbClient.get(
    "SELECT * FROM repuestos_stock WHERE repuesto_id = ? AND bodega_id = ? FOR UPDATE",
    [repuestoId, bodegaId]
  );
}

async function decrementarStock(repuestoId, bodegaId, cantidad, dbClient) {
  return dbClient.get(
    `
      UPDATE repuestos_stock
      SET stock_fisico = stock_fisico - ?, actualizado_en = NOW()
      WHERE repuesto_id = ? AND bodega_id = ?
      RETURNING *
    `,
    [cantidad, repuestoId, bodegaId]
  );
}

async function findByRepuestoIds(repuestoIds) {
  const unicos = [...new Set(repuestoIds.filter(Boolean))];
  if (!unicos.length) return new Map();

  const rows = await db.all("SELECT * FROM repuestos_stock WHERE repuesto_id = ANY(?)", [unicos]);

  const mapa = new Map();
  rows.forEach((row) => mapa.set(row.repuesto_id, row));
  return mapa;
}

/**
 * Crea o actualiza la fila de stock de un repuesto en una bodega. No usa
 * ON CONFLICT DO UPDATE directo porque necesita saber si ya existia (para
 * decidir en el sync-engine si hay que registrar un movimiento).
 */
async function upsertStock(repuestoId, bodegaId, { stockFisico, ubicacionOriginal, hashFila }) {
  return db.get(
    `
      INSERT INTO repuestos_stock (repuesto_id, bodega_id, stock_fisico, ubicacion_original, hash_fila, actualizado_en)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON CONFLICT (repuesto_id, bodega_id) DO UPDATE SET
        stock_fisico = EXCLUDED.stock_fisico,
        ubicacion_original = EXCLUDED.ubicacion_original,
        hash_fila = EXCLUDED.hash_fila,
        actualizado_en = NOW()
      RETURNING *
    `,
    [repuestoId, bodegaId, stockFisico, ubicacionOriginal, hashFila]
  );
}

async function insertMovimiento(movimiento, dbClient = db) {
  return dbClient.run(
    `
      INSERT INTO movimientos_stock
        (repuesto_id, bodega_id, tipo_movimiento, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      movimiento.repuestoId,
      movimiento.bodegaId,
      movimiento.tipoMovimiento,
      movimiento.cantidad,
      movimiento.stockResultante,
      movimiento.motivo ?? null,
      movimiento.referenciaTipo ?? null,
      movimiento.referenciaId ?? null,
      movimiento.usuarioId ?? null
    ]
  );
}

module.exports = {
  findBodegaPrincipal,
  findByRepuestoIds,
  findByRepuestoIdForUpdate,
  decrementarStock,
  upsertStock,
  insertMovimiento
};
