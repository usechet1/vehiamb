const cron = require("node-cron");
const env = require("../config/env");
const importService = require("../services/import/import.service");

/**
 * Corre todos los dias a la hora configurada (IMPORT_SCHEDULE, default
 * 2:00 AM) y procesa el dia anterior. Si falla, queda registrado en
 * "importaciones" con estado "fallido" (ImportService ya lo hace) y el
 * proceso sigue vivo: la siguiente corrida programada (mañana, para el
 * periodo de mañana) intenta normalmente. Para reprocesar especificamente el
 * dia que fallo esta el endpoint manual POST /api/importaciones/ejecutar.
 */
function start() {
  if (!cron.validate(env.importSchedule)) {
    console.error(`[ImportScheduler] IMPORT_SCHEDULE invalido: "${env.importSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(
    env.importSchedule,
    async () => {
      console.log(`[ImportScheduler] Ejecutando importacion automatica programada (${new Date().toISOString()})`);

      try {
        await importService.ejecutar({ periodo: importService.ayer(), usuarioId: null });
      } catch (error) {
        console.error("[ImportScheduler] La importacion automatica fallo:", error.message);
      }
    },
    { timezone: env.importTimezone }
  );

  console.log(`[ImportScheduler] Programado con cron "${env.importSchedule}" (zona horaria ${env.importTimezone})`);
  return task;
}

module.exports = { start };
