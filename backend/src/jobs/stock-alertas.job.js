const db = require("../database/query");
const notificacionesService = require("../services/notificaciones.service");

const CHECK_INTERVAL_MS = Number(process.env.STOCK_ALERTAS_CHECK_INTERVAL_MS || 6 * 60 * 60 * 1000);
const HORAS_SIN_DUPLICAR = 24;
const DESTINATARIO_PERMISSION = "inventory.view";

async function obtenerRepuestosBajoMinimo() {
  return db.all(
    `
      SELECT r.id, r.nombre, r.codigo_interno, rs.stock_fisico, rs.stock_minimo
      FROM repuestos_stock rs
      INNER JOIN repuestos r ON r.id = rs.repuesto_id
      WHERE rs.stock_minimo > 0 AND rs.stock_fisico <= rs.stock_minimo
    `
  );
}

async function obtenerRepuestosInactivosConfigurados() {
  return db.all(
    `
      SELECT DISTINCT r.id, r.nombre, r.codigo_interno
      FROM vehiculo_repuestos_sugeridos vrs
      INNER JOIN repuestos r ON r.id = vrs.repuesto_id
      WHERE r.estado = 'inactivo'
    `
  );
}

async function evaluarStockMinimo(row) {
  const yaNotificado = await notificacionesService.existsRecentByReferencia("repuesto_stock", row.id, HORAS_SIN_DUPLICAR);
  if (yaNotificado) return;

  const agotado = Number(row.stock_fisico) <= 0;

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: agotado ? "stock_agotado" : "stock_minimo_alcanzado",
    mensaje: agotado
      ? `El repuesto "${row.nombre}" (${row.codigo_interno}) esta agotado.`
      : `El repuesto "${row.nombre}" (${row.codigo_interno}) llego al stock minimo (${row.stock_fisico}/${row.stock_minimo}).`,
    referencia_tipo: "repuesto_stock",
    referencia_id: row.id,
    accion: { tipo: "ver_repuesto", payload: { repuesto_id: row.id } }
  });
}

async function evaluarRepuestoInactivo(row) {
  const yaNotificado = await notificacionesService.existsRecentByReferencia("repuesto_inactivo", row.id, HORAS_SIN_DUPLICAR);
  if (yaNotificado) return;

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: "repuesto_inactivo_configurado",
    mensaje: `El repuesto "${row.nombre}" (${row.codigo_interno}) esta inactivo pero sigue configurado como sugerido para algun vehiculo.`,
    referencia_tipo: "repuesto_inactivo",
    referencia_id: row.id,
    accion: { tipo: "ver_repuesto", payload: { repuesto_id: row.id } }
  });
}

async function ejecutarRevisionStock() {
  try {
    const [bajoMinimo, inactivos] = await Promise.all([
      obtenerRepuestosBajoMinimo(),
      obtenerRepuestosInactivosConfigurados()
    ]);

    await Promise.all([...bajoMinimo.map(evaluarStockMinimo), ...inactivos.map(evaluarRepuestoInactivo)]);
  } catch (error) {
    console.error("Error ejecutando la revision de alertas de stock:", error.message);
  }
}

function start() {
  ejecutarRevisionStock();
  setInterval(ejecutarRevisionStock, CHECK_INTERVAL_MS);
}

module.exports = { start, ejecutarRevisionStock };
