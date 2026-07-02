const db = require("../database/query");
const notificacionesService = require("../services/notificaciones.service");
const { RECORDATORIO_UMBRALES_DIAS } = require("../config/notificaciones.config");

const CHECK_INTERVAL_MS = Number(process.env.MAINTENANCE_SCHEDULE_CHECK_INTERVAL_MS || 6 * 60 * 60 * 1000);
const HORAS_SIN_DUPLICAR = 24;
// Informativa: "maintenance.view" para que tambien llegue al rol de solo consulta.
const DESTINATARIO_PERMISSION = "maintenance.view";
const MAX_DIAS = Math.max(...RECORDATORIO_UMBRALES_DIAS);

const TIPOS_LABEL = {
  revision: "Revision general",
  preventivo: "Mantenimiento preventivo",
  correctivo: "Mantenimiento correctivo",
  cambio_aceite: "Cambio de aceite",
  frenos: "Frenos",
  llantas: "Llantas",
  otro: "Otro"
};

// Mantenimientos ya programados con fecha futura (agendados de antemano).
// El cambio de aceite predictivo (por proximo_cambio_km/fecha) ya tiene su
// propio job (preventivo-cambio-aceite.job.js); este cubre cualquier
// mantenimiento con una fecha futura explicita, sea cual sea el tipo.
async function obtenerMantenimientosProgramados() {
  return db.all(
    `
      SELECT m.id, m.vehiculo_id, m.tipo, m.fecha, v.placa, v.marca, v.modelo
      FROM mantenimientos m
      INNER JOIN vehiculos v ON v.id = m.vehiculo_id
      WHERE m.fecha > CURRENT_DATE
        AND m.fecha <= CURRENT_DATE + (? || ' days')::interval
    `,
    [MAX_DIAS]
  );
}

function calcularDiasRestantes(fecha) {
  const diffMs = new Date(fecha).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

async function evaluarMantenimiento(row) {
  const yaNotificado = await notificacionesService.existsRecentByReferencia("mantenimiento", row.id, HORAS_SIN_DUPLICAR);
  if (yaNotificado) return;

  const diasRestantes = calcularDiasRestantes(row.fecha);
  const vehiculoLabel = `${row.marca} ${row.modelo} (${row.placa})`;
  const tipoLabel = TIPOS_LABEL[row.tipo] || row.tipo;

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: "mantenimiento_proximo",
    mensaje: `${tipoLabel} programado para el vehiculo ${vehiculoLabel} en ${Math.max(diasRestantes, 0)} dias.`,
    vehiculo_id: row.vehiculo_id,
    referencia_tipo: "mantenimiento",
    referencia_id: row.id,
    accion: { tipo: "ver_mantenimiento", payload: { mantenimiento_id: row.id } }
  });
}

async function ejecutarRevisionMantenimientosProgramados() {
  try {
    const mantenimientos = await obtenerMantenimientosProgramados();
    await Promise.all(mantenimientos.map(evaluarMantenimiento));
  } catch (error) {
    console.error("Error ejecutando la revision de mantenimientos programados:", error.message);
  }
}

function start() {
  ejecutarRevisionMantenimientosProgramados();
  setInterval(ejecutarRevisionMantenimientosProgramados, CHECK_INTERVAL_MS);
}

module.exports = { start, ejecutarRevisionMantenimientosProgramados };
