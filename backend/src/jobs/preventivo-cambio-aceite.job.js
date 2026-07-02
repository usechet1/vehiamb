const db = require("../database/query");
const notificacionesService = require("../services/notificaciones.service");

const CHECK_INTERVAL_MS = Number(process.env.PREVENTIVE_CHECK_INTERVAL_MS || 6 * 60 * 60 * 1000);
const KM_UMBRAL = 500;
const DIAS_UMBRAL = 15;
const HORAS_SIN_DUPLICAR = 72;
// Informativa: "maintenance.view" (no "maintenance.approve") para que tambien
// llegue al rol de solo consulta.
const DESTINATARIO_PERMISSION = "maintenance.view";

async function obtenerProximosCambiosAceite() {
  return db.all(`
    SELECT DISTINCT ON (m.vehiculo_id)
      m.id AS mantenimiento_id,
      m.vehiculo_id,
      m.proximo_cambio_km,
      m.proximo_cambio_fecha,
      v.placa,
      v.marca,
      v.modelo,
      v.kilometraje_actual
    FROM mantenimientos m
    INNER JOIN vehiculos v ON v.id = m.vehiculo_id
    WHERE m.tipo = 'cambio_aceite'
      AND (m.proximo_cambio_km IS NOT NULL OR m.proximo_cambio_fecha IS NOT NULL)
    ORDER BY m.vehiculo_id, m.fecha DESC, m.id DESC
  `);
}

function calcularKmRestantes(row) {
  if (row.proximo_cambio_km === null || row.proximo_cambio_km === undefined) return null;
  return Number(row.proximo_cambio_km) - Number(row.kilometraje_actual || 0);
}

function calcularDiasRestantes(row) {
  if (!row.proximo_cambio_fecha) return null;
  const diffMs = new Date(row.proximo_cambio_fecha).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

async function evaluarVehiculo(row) {
  const kmRestantes = calcularKmRestantes(row);
  const diasRestantes = calcularDiasRestantes(row);

  const proximoPorKm = kmRestantes !== null && kmRestantes <= KM_UMBRAL;
  const proximoPorFecha = diasRestantes !== null && diasRestantes <= DIAS_UMBRAL;

  if (!proximoPorKm && !proximoPorFecha) return;

  const yaNotificado = await notificacionesService.existsRecentByReferencia(
    "vehiculo",
    row.vehiculo_id,
    HORAS_SIN_DUPLICAR
  );
  if (yaNotificado) return;

  const detalle = proximoPorKm
    ? `${Math.max(kmRestantes, 0).toLocaleString("es-CO")} km`
    : `${Math.max(diasRestantes, 0)} dias`;

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo: "cambio_aceite_proximo",
    mensaje: `El vehiculo ${row.marca} ${row.modelo} (${row.placa}) esta a ${detalle} de cumplir el limite para su proximo Cambio de Aceite.`,
    vehiculo_id: row.vehiculo_id,
    referencia_tipo: "vehiculo",
    referencia_id: row.vehiculo_id,
    accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: row.vehiculo_id } }
  });
}

async function ejecutarRevisionPreventiva() {
  try {
    const vehiculos = await obtenerProximosCambiosAceite();
    await Promise.all(vehiculos.map(evaluarVehiculo));
  } catch (error) {
    console.error("Error ejecutando la revision de mantenimiento preventivo:", error.message);
  }
}

function start() {
  ejecutarRevisionPreventiva();
  setInterval(ejecutarRevisionPreventiva, CHECK_INTERVAL_MS);
}

module.exports = { start, ejecutarRevisionPreventiva };
