const vehiculosRepository = require("../repositories/vehiculos.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");

// Modulo deliberadamente sin dependencias de otros services (solo
// repositorios) para poder ser llamado tanto desde mantenimientos.service.js
// como desde notificaciones.service.js sin crear un require circular entre
// ellos dos.

const ESTADO_ACTIVO = "activo";
const ESTADO_EN_REPARACION = "reparacion";

// Reevalua si el vehiculo deberia estar "en reparacion" (fuera del selector
// de asignaciones, ver asignaciones.service.js) segun si le queda algun
// mantenimiento que lo bloquee -- marcado "vehiculo varado" (tipicamente
// correctivo), o un cambio de aceite todavia sin confirmar (ver
// confirmarCambioAceite en mantenimientos.service.js) -- Y CUYA FECHA YA
// LLEGO. Programar uno de estos mantenimientos para un dia futuro no debe
// dejar el vehiculo fuera de servicio desde ya: eso lo decide
// existeMantenimientoQueBloquea (fecha <= hoy) en el repositorio, no aca.
//
// Bidireccional: si corresponde bloquear y el vehiculo esta "activo", lo
// pasa a "reparacion"; si ya no corresponde y esta en "reparacion", lo
// regresa a "activo". Nunca toca un estado mas severo puesto a mano
// (fuera_servicio, dado_de_baja).
async function reevaluarDisponibilidad(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) return;

  const bloqueado = await mantenimientosRepository.existeMantenimientoQueBloquea(vehiculoId, empresaId);

  if (bloqueado && vehiculo.estado === ESTADO_ACTIVO) {
    await vehiculosRepository.updateEstado(vehiculoId, ESTADO_EN_REPARACION, empresaId);
  } else if (!bloqueado && vehiculo.estado === ESTADO_EN_REPARACION) {
    await vehiculosRepository.updateEstado(vehiculoId, ESTADO_ACTIVO, empresaId);
  }
}

module.exports = { reevaluarDisponibilidad };
