const db = require("../database/query");
const vehiculoDisponibilidadService = require("../services/vehiculo-disponibilidad.service");

const CHECK_INTERVAL_MS = Number(process.env.VEHICULO_DISPONIBILIDAD_CHECK_INTERVAL_MS || 60 * 60 * 1000);

// reevaluarDisponibilidad (vehiculo-disponibilidad.service.js) solo se
// disparaba antes en reaccion a crear/eliminar/aprobar/rechazar un
// mantenimiento -- un mantenimiento "pendiente" programado para una fecha
// futura (ej. vehiculo_varado marcado con fecha de la proxima semana) nunca
// volvia a revisarse una vez llegaba esa fecha si nadie tocaba el registro
// ese dia. Este job barre periodicamente los vehiculos con algun
// mantenimiento pendiente y fuerza esa reevaluacion, para que el vehiculo
// pase solo a "reparacion" el dia que corresponde.
async function obtenerVehiculosConPendientes() {
  return db.all("SELECT DISTINCT vehiculo_id, empresa_id FROM mantenimientos WHERE estado = 'pendiente'");
}

async function reevaluarDisponibilidadPendientes() {
  try {
    const filas = await obtenerVehiculosConPendientes();
    for (const fila of filas) {
      await vehiculoDisponibilidadService.reevaluarDisponibilidad(fila.vehiculo_id, fila.empresa_id);
    }
  } catch (error) {
    console.error("Error reevaluando disponibilidad de vehiculos:", error.message);
  }
}

function start() {
  reevaluarDisponibilidadPendientes();
  setInterval(reevaluarDisponibilidadPendientes, CHECK_INTERVAL_MS);
}

module.exports = { start, reevaluarDisponibilidadPendientes };
