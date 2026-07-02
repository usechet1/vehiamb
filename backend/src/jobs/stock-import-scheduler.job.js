const cron = require("node-cron");
const env = require("../config/env");
const stockImportService = require("../services/stock-import/stock-import.service");

/**
 * Corre todos los dias a la hora configurada (STOCK_IMPORT_SCHEDULE, default
 * 3:00 AM, una hora despues del import de gastos vehiculares para no
 * competir por el mismo Excel/red). Si falla, queda registrado en
 * "importaciones_stock" con estado "fallido" y el proceso sigue vivo. Para
 * reprocesar manualmente esta el endpoint POST /api/stock-importaciones/ejecutar.
 */
function start() {
  if (!cron.validate(env.stockImportSchedule)) {
    console.error(`[StockImportScheduler] STOCK_IMPORT_SCHEDULE invalido: "${env.stockImportSchedule}". El scheduler no se inicio.`);
    return null;
  }

  const task = cron.schedule(
    env.stockImportSchedule,
    async () => {
      console.log(`[StockImportScheduler] Ejecutando importacion de stock automatica (${new Date().toISOString()})`);

      try {
        await stockImportService.ejecutar({ usuarioId: null });
      } catch (error) {
        console.error("[StockImportScheduler] La importacion automatica fallo:", error.message);
      }
    },
    { timezone: env.stockImportTimezone }
  );

  console.log(`[StockImportScheduler] Programado con cron "${env.stockImportSchedule}" (zona horaria ${env.stockImportTimezone})`);
  return task;
}

module.exports = { start };
