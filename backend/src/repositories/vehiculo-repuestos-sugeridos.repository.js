const db = require("../database/query");

async function findByVehiculo(vehiculoId, tipoMantenimiento) {
  return db.all(
    `
      SELECT vrs.*, r.codigo_interno, r.nombre, r.categoria, r.unidad_medida, r.valor_promedio,
             COALESCE(rs.stock_fisico, 0) - COALESCE(rs.stock_comprometido, 0) AS stock_disponible
      FROM vehiculo_repuestos_sugeridos vrs
      INNER JOIN repuestos r ON r.id = vrs.repuesto_id
      LEFT JOIN repuestos_stock rs ON rs.repuesto_id = r.id
      WHERE vrs.vehiculo_id = ? AND vrs.tipo_mantenimiento = ?
      ORDER BY vrs.orden ASC, r.nombre ASC
    `,
    [vehiculoId, tipoMantenimiento]
  );
}

/**
 * Reemplaza el set completo de sugeridos de un vehiculo+tipo (misma logica
 * que facturasRepository.replaceGastos): usado por la UI de la ficha del
 * vehiculo, donde el usuario define la lista completa de una vez.
 */
async function replaceParaVehiculoYTipo(vehiculoId, tipoMantenimiento, items) {
  await db.run("DELETE FROM vehiculo_repuestos_sugeridos WHERE vehiculo_id = ? AND tipo_mantenimiento = ?", [
    vehiculoId,
    tipoMantenimiento
  ]);

  for (const item of items) {
    await db.run(
      `
        INSERT INTO vehiculo_repuestos_sugeridos (vehiculo_id, tipo_mantenimiento, repuesto_id, cantidad, orden, intervalo_km)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [vehiculoId, tipoMantenimiento, item.repuesto_id, item.cantidad ?? 1, item.orden ?? 0, item.intervalo_km ?? null]
    );
  }
}

/**
 * Usado por el importador bootstrap: nunca pisa lo que ya exista (a
 * diferencia de replaceParaVehiculoYTipo, que reemplaza todo el set).
 */
async function upsertIgnore(item) {
  return db.run(
    `
      INSERT INTO vehiculo_repuestos_sugeridos (vehiculo_id, tipo_mantenimiento, repuesto_id, cantidad, orden, intervalo_km)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (vehiculo_id, tipo_mantenimiento, repuesto_id) DO NOTHING
    `,
    [item.vehiculo_id, item.tipo_mantenimiento, item.repuesto_id, item.cantidad ?? 1, item.orden ?? 0, item.intervalo_km ?? null]
  );
}

module.exports = { findByVehiculo, replaceParaVehiculoYTipo, upsertIgnore };
