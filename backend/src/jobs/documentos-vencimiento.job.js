const db = require("../database/query");
const notificacionesService = require("../services/notificaciones.service");
const { RECORDATORIO_UMBRALES_DIAS } = require("../config/notificaciones.config");

const CHECK_INTERVAL_MS = Number(process.env.DOCUMENT_CHECK_INTERVAL_MS || 6 * 60 * 60 * 1000);
const HORAS_SIN_DUPLICAR = 24;
// "documents.view" (no "documents.create") para que tambien llegue al rol de
// solo consulta, que puede ver documentos pero no crearlos/aprobarlos.
const DESTINATARIO_PERMISSION = "documents.view";

// Documentos cubiertos por el recordatorio automatico. Agregar un tipo nuevo
// (ej. "seguro") es una entrada mas aqui, sin tocar el resto del job.
const TIPO_DOCUMENTO_NOTIFICACION = {
  soat: { proximo: "soat_proximo", vencido: "soat_vencido", label: "SOAT" },
  tecnomecanica: { proximo: "tecnomecanica_proxima", vencido: "tecnomecanica_vencida", label: "Tecnico-Mecanica" }
};

async function obtenerDocumentosVigentes() {
  return db.all(`
    SELECT d.id, d.vehiculo_id, d.tipo, d.fecha_vencimiento, v.placa, v.marca, v.modelo
    FROM documentos d
    INNER JOIN vehiculos v ON v.id = d.vehiculo_id
    WHERE d.tipo IN ('soat', 'tecnomecanica')
      AND d.fecha_vencimiento IS NOT NULL
  `);
}

function calcularDiasRestantes(fechaVencimiento) {
  const diffMs = new Date(fechaVencimiento).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

async function evaluarDocumento(row) {
  const config = TIPO_DOCUMENTO_NOTIFICACION[row.tipo];
  if (!config) return;

  const diasRestantes = calcularDiasRestantes(row.fecha_vencimiento);
  const vencido = diasRestantes < 0;
  const proximoAVencer = diasRestantes >= 0 && RECORDATORIO_UMBRALES_DIAS.some((umbral) => diasRestantes <= umbral);

  if (!vencido && !proximoAVencer) return;

  const yaNotificado = await notificacionesService.existsRecentByReferencia("documento", row.id, HORAS_SIN_DUPLICAR);
  if (yaNotificado) return;

  const vehiculoLabel = `${row.marca} ${row.modelo} (${row.placa})`;
  const tipo = vencido ? config.vencido : config.proximo;
  const mensaje = vencido
    ? `El ${config.label} del vehiculo ${vehiculoLabel} vencio hace ${Math.abs(diasRestantes)} dias.`
    : `El ${config.label} del vehiculo ${vehiculoLabel} vence en ${diasRestantes} dias.`;

  await notificacionesService.notificarUsuariosConPermiso(DESTINATARIO_PERMISSION, {
    tipo,
    mensaje,
    vehiculo_id: row.vehiculo_id,
    referencia_tipo: "documento",
    referencia_id: row.id,
    accion: { tipo: "renovar_documento", payload: { documento_id: row.id, vehiculo_id: row.vehiculo_id } }
  });
}

async function ejecutarRevisionDocumentos() {
  try {
    const documentos = await obtenerDocumentosVigentes();
    await Promise.all(documentos.map(evaluarDocumento));
  } catch (error) {
    console.error("Error ejecutando la revision de vencimiento de documentos:", error.message);
  }
}

function start() {
  ejecutarRevisionDocumentos();
  setInterval(ejecutarRevisionDocumentos, CHECK_INTERVAL_MS);
}

module.exports = { start, ejecutarRevisionDocumentos };
