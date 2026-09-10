const cron = require("node-cron");
const env = require("../config/env");
const gpsService = require("../services/gps.service");

/**
 * Sincroniza alarmas/eventos GPS (no posicion, esa se consulta en vivo)
 * desde Traccar hacia gps_eventos, cada GPS_EVENTOS_SYNC_SCHEDULE (default
 * cada minuto). Si TRACCAR_URL no esta configurado, sincronizarEventosGlobal
 * es un no-op silencioso -- no hace falta un flag aparte para "modulo GPS
 * desactivado".
 */
function start() {
  if (!env.traccarUrl) {
    console.log("[GpsEventosSyncJob] TRACCAR_URL no configurado, el job no se inicia.");
    return null;
  }

  if (!cron.validate(env.gpsEventosSyncSchedule)) {
    console.error(`[GpsEventosSyncJob] GPS_EVENTOS_SYNC_SCHEDULE invalido: "${env.gpsEventosSyncSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(env.gpsEventosSyncSchedule, async () => {
    try {
      const resultado = await gpsService.sincronizarEventosGlobal();
      if (resultado.nuevos > 0) {
        console.log(`[GpsEventosSyncJob] ${resultado.nuevos} evento(s) GPS nuevo(s) de ${resultado.revisados} dispositivo(s) revisados.`);
      }
    } catch (error) {
      console.error("[GpsEventosSyncJob] La sincronizacion de eventos GPS fallo:", error.message);
    }
  });

  console.log(`[GpsEventosSyncJob] Programado con cron "${env.gpsEventosSyncSchedule}"`);
  return task;
}

module.exports = { start };
