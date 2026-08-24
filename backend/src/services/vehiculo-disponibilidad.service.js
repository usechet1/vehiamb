const vehiculosRepository = require("../repositories/vehiculos.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");

// Modulo deliberadamente sin dependencias de otros services (solo
// repositorios) para poder ser llamado tanto desde mantenimientos.service.js
// como desde notificaciones.service.js sin crear un require circular entre
// ellos dos.

const ESTADO_ACTIVO = "activo";
const ESTADO_EN_REPARACION = "reparacion";

// Al crear un mantenimiento marcado como "vehiculo varado" que queda
// pendiente de aprobacion (correctivo, o cambio_aceite por encima del
// umbral), el vehiculo pasa a "reparacion" -- eso ya lo saca del selector de
// asignaciones (ver asignaciones.service.js). Solo se toca si estaba
// "activo": si ya estaba en un estado mas severo (fuera_servicio,
// dado_de_baja) o ya en reparacion por otro motivo, se deja igual.
async function marcarEnReparacionSiAplica(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo || vehiculo.estado !== ESTADO_ACTIVO) return;

  await vehiculosRepository.updateEstado(vehiculoId, ESTADO_EN_REPARACION, empresaId);
}

// Se llama cada vez que un mantenimiento marcado como "vehiculo varado"
// queda aprobado -- si ya no le queda ningun otro mantenimiento varado
// pendiente, el vehiculo vuelve solo a "activo" y queda disponible de nuevo
// para escoger en una ruta. Si el estado actual no es "reparacion" (ej. lo
// pasaron a fuera_servicio/dado_de_baja a mano mientras tanto) no se toca.
async function reevaluarDisponibilidad(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo || vehiculo.estado !== ESTADO_EN_REPARACION) return;

  const sigueVarado = await mantenimientosRepository.existeVaradoPendiente(vehiculoId, empresaId);
  if (!sigueVarado) {
    await vehiculosRepository.updateEstado(vehiculoId, ESTADO_ACTIVO, empresaId);
  }
}

module.exports = { marcarEnReparacionSiAplica, reevaluarDisponibilidad };
