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

const server = app.listen(env.port, () => {
  console.log(`Servidor corriendo en puerto ${env.port}`);
  preventivoCambioAceiteJob.start();
  documentosVencimientoJob.start();
  mantenimientosProximosJob.start();
  importSchedulerJob.start();
  gastosSyncJob.start();
  stockImportSchedulerJob.start();
  stockAlertasJob.start();
  simitConsultaJob.start();
  configSyncJob.start();
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
