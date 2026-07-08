const cron = require("node-cron");
const env = require("../config/env");
const importService = require("../services/import/import.service");

/**
 * Corre cada hora (GASTOS_SYNC_SCHEDULE, default cada hora en punto) y
 * sincroniza el periodo de "hoy" -- para que las filas nuevas o editadas el
 * mismo dia en el Excel de cargues (unidad de red T:) se reflejen en Gastos
 * sin esperar al job diario. No reemplaza a import-scheduler.job.js: ese
 * sigue corriendo de madrugada y finaliza "ayer" como red de seguridad. Si
 * el archivo no cambio desde la ultima corrida de este mismo periodo,
 * ImportService detecta el hash repetido y no reprocesa nada (estado
 * "sin_cambios").
 */
function start() {
  if (!cron.validate(env.gastosSyncSchedule)) {
    console.error(`[GastosSyncJob] GASTOS_SYNC_SCHEDULE invalido: "${env.gastosSyncSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(
    env.gastosSyncSchedule,
    async () => {
      console.log(`[GastosSyncJob] Sincronizando cargues del dia (${new Date().toISOString()})`);

      try {
        await importService.ejecutar({ periodo: importService.hoy(), usuarioId: null });
      } catch (error) {
        console.error("[GastosSyncJob] La sincronizacion automatica fallo:", error.message);
      }
    },
    { timezone: env.importTimezone }
  );

  console.log(`[GastosSyncJob] Programado con cron "${env.gastosSyncSchedule}" (zona horaria ${env.importTimezone})`);
  return task;
}

module.exports = { start };
