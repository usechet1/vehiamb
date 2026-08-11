const app = require("./src/app");
const env = require("./src/config/env");
const db = require("./src/database/query");
const preventivoCambioAceiteJob = require("./src/jobs/preventivo-cambio-aceite.job");
const documentosVencimientoJob = require("./src/jobs/documentos-vencimiento.job");
const mantenimientosProximosJob = require("./src/jobs/mantenimientos-proximos.job");
const importSchedulerJob = require("./src/jobs/import-scheduler.job");
const gastosSyncJob = require("./src/jobs/gastos-sync.job");
const stockImportSchedulerJob = require("./src/jobs/stock-import-scheduler.job");
const stockAlertasJob = require("./src/jobs/stock-alertas.job");
const simitConsultaJob = require("./src/jobs/simit-consulta.job");
const configSyncJob = require("./src/jobs/config-sync.job");
const backupJob = require("./src/jobs/backup.job");

const server = app.listen(env.port, () => {
  console.log(`Servidor corriendo en puerto ${env.port}`);

  // Estos 4 jobs corren una revision inmediata al arrancar (ademas de su
  // setInterval periodico), y esa revision inmediata puede enviar
  // notificaciones reales por email/WhatsApp -- util en produccion (no
  // espera al primer intervalo para avisar de algo vencido), pero al
  // levantar el servidor en un puerto de pruebas contra la base real termina
  // mandando mensajes reales sin querer. DISABLE_STARTUP_JOBS=true salta
  // solo esa primera ejecucion inmediata de estos 4; el resto de jobs (que
  // solo usan cron.schedule, sin ejecucion al arrancar) no se ven afectados
  // y siguen igual.
  if (process.env.DISABLE_STARTUP_JOBS !== "true") {
    preventivoCambioAceiteJob.start();
    documentosVencimientoJob.start();
    mantenimientosProximosJob.start();
    stockAlertasJob.start();
  }
  importSchedulerJob.start();
  gastosSyncJob.start();
  stockImportSchedulerJob.start();
  simitConsultaJob.start();
  configSyncJob.start();
  backupJob.start();
});

function shutdown(signal) {
  console.log(`Recibida señal ${signal}. Cerrando servidor...`);

  server.close(() => {
    db.close(() => {
      console.log("Servidor cerrado correctamente");
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
