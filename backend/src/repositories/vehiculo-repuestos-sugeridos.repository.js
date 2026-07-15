const db = require("../database/query");

async function findByVehiculo(vehiculoId, tipoMantenimiento, empresaId) {
  return db.all(
    `
      SELECT vrs.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida, r.valor_promedio,
             COALESCE(rs.stock_fisico, 0) - COALESCE(rs.stock_comprometido, 0) AS stock_disponible
      FROM vehiculo_repuestos_sugeridos vrs
      INNER JOIN repuestos r ON r.id = vrs.repuesto_id
      LEFT JOIN repuestos_stock rs ON rs.repuesto_id = r.id
      WHERE vrs.vehiculo_id = ? AND vrs.tipo_mantenimiento = ? AND vrs.empresa_id = ?
      ORDER BY vrs.orden ASC, r.nombre ASC
    `,
    [vehiculoId, tipoMantenimiento, empresaId]
  );
}

/**
 * Reemplaza el set completo de sugeridos de un vehiculo+tipo (misma logica
 * que facturasRepository.replaceGastos): usado por la UI de la ficha del
 * vehiculo, donde el usuario define la lista completa de una vez.
 */
async function replaceParaVehiculoYTipo(vehiculoId, tipoMantenimiento, items, empresaId) {
  await db.run(
    "DELETE FROM vehiculo_repuestos_sugeridos WHERE vehiculo_id = ? AND tipo_mantenimiento = ? AND empresa_id = ?",
    [vehiculoId, tipoMantenimiento, empresaId]
  );

  for (const item of items) {
    await db.run(
      `
        INSERT INTO vehiculo_repuestos_sugeridos (vehiculo_id, tipo_mantenimiento, repuesto_id, cantidad, orden, intervalo_km, empresa_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [vehiculoId, tipoMantenimiento, item.repuesto_id, item.cantidad ?? 1, item.orden ?? 0, item.intervalo_km ?? null, empresaId]
    );
  }
}

/**
 * Usado por el importador bootstrap: nunca pisa lo que ya exista (a
 * diferencia de replaceParaVehiculoYTipo, que reemplaza todo el set). El
 * importador Excel es infraestructura de UNA sola empresa (una ruta de
 * archivo compartida via env vars), asi que siempre corre contra la
 * empresa por defecto -- ver config-import.service.js.
 */
async function upsertIgnore(item) {
  return db.run(
    `
      INSERT INTO vehiculo_repuestos_sugeridos (vehiculo_id, tipo_mantenimiento, repuesto_id, cantidad, orden, intervalo_km, empresa_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (empresa_id, vehiculo_id, tipo_mantenimiento, repuesto_id) DO NOTHING
    `,
    [item.vehiculo_id, item.tipo_mantenimiento, item.repuesto_id, item.cantidad ?? 1, item.orden ?? 0, item.intervalo_km ?? null, item.empresa_id]
  );
}

module.exports = { findByVehiculo, replaceParaVehiculoYTipo, upsertIgnore };
