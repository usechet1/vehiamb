const cron = require("node-cron");
const simitService = require("../services/simit.service");

// Por defecto corre una vez al dia, de madrugada, para no competir con el uso
// normal de la aplicacion ni saturar el portal SIMIT en horario habil.
const SCHEDULE = process.env.SIMIT_CHECK_SCHEDULE || "0 4 * * *";
const TIMEZONE = process.env.SIMIT_CHECK_TIMEZONE || "America/Bogota";

async function ejecutarActualizacionFlota() {
  try {
    const resumen = await simitService.actualizarFlota();
    console.log(
      `Actualizacion SIMIT de flota completada: ${resumen.ok} ok, ${resumen.con_novedades} con novedades, ${resumen.bloqueado} bloqueadas, ${resumen.error} con error (de ${resumen.total} vehiculos).`
    );
  } catch (error) {
    console.error("Error ejecutando la actualizacion masiva de SIMIT:", error.message);
  }
}

const task = cron.schedule(SCHEDULE, ejecutarActualizacionFlota, {
  scheduled: false,
  timezone: TIMEZONE
});

module.exports = {
  start: () => {
    task.start();
    console.log("Job simit-consulta iniciado");
  },
  stop: () => task.stop(),
  ejecutarActualizacionFlota
};
