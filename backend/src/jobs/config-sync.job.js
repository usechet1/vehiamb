const cron = require("node-cron");
const env = require("../config/env");
const configImportService = require("../services/config-import/config-import.service");

/**
 * Corre todos los dias a la hora configurada (CONFIG_SYNC_SCHEDULE, default
 * 4:00 AM, una hora despues del import de stock para no competir por la
 * misma red). Este archivo (repuestos sugeridos para cambio de aceite +
 * equivalencias) cambia con poca frecuencia, asi que un cron diario alcanza.
 * Si falla, queda registrado en "importaciones_config_vehiculos" con estado
 * "fallido" y el proceso sigue vivo. Para reprocesar manualmente esta el
 * endpoint POST /api/config-import/vehiculos-repuestos.
 */
function start() {
  if (!cron.validate(env.configSyncSchedule)) {
    console.error(`[ConfigSyncJob] CONFIG_SYNC_SCHEDULE invalido: "${env.configSyncSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(
    env.configSyncSchedule,
    async () => {
      console.log(`[ConfigSyncJob] Ejecutando sincronizacion de configuracion automatica (${new Date().toISOString()})`);

      try {
        await configImportService.ejecutar({ usuarioId: null });
      } catch (error) {
        console.error("[ConfigSyncJob] La sincronizacion automatica fallo:", error.message);
      }
    },
    { timezone: env.stockImportTimezone }
  );

  console.log(`[ConfigSyncJob] Programado con cron "${env.configSyncSchedule}" (zona horaria ${env.stockImportTimezone})`);
  return task;
}

module.exports = { start };
