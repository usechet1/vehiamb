const vehiculosRepository = require("../repositories/vehiculos.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");

// Modulo deliberadamente sin dependencias de otros services (solo
// repositorios) para poder ser llamado tanto desde mantenimientos.service.js
// como desde notificaciones.service.js sin crear un require circular entre
// ellos dos.

const ESTADO_ACTIVO = "activo";
const ESTADO_EN_REPARACION = "reparacion";

// Un mantenimiento pendiente "bloquea" el vehiculo (lo saca de disponible
// para rutas) en dos casos: viene marcado explicitamente como "vehiculo
// varado" (tipicamente correctivo), o es un cambio de aceite -- ahi el
// vehiculo se considera en el taller mientras no se confirme con la salida
// de inventario y se descargue/imprima la etiqueta (ver confirmarCambioAceite
// en mantenimientos.service.js, que es lo unico que lo saca de "pendiente").
function bloqueaDisponibilidad(mantenimiento) {
  return Boolean(mantenimiento.vehiculo_varado) || mantenimiento.tipo === "cambio_aceite";
}

// Al crear uno de esos mantenimientos, si queda pendiente de aprobacion, el
// vehiculo pasa a "reparacion" -- eso ya lo saca del selector de
// asignaciones (ver asignaciones.service.js). Solo se toca si estaba
// "activo": si ya estaba en un estado mas severo (fuera_servicio,
// dado_de_baja) o ya en reparacion por otro motivo, se deja igual.
async function marcarEnReparacionSiAplica(mantenimiento, empresaId) {
  if (mantenimiento.estado !== "pendiente" || !bloqueaDisponibilidad(mantenimiento)) return;

  const vehiculo = await vehiculosRepository.findById(mantenimiento.vehiculo_id, empresaId);
  if (!vehiculo || vehiculo.estado !== ESTADO_ACTIVO) return;

  await vehiculosRepository.updateEstado(mantenimiento.vehiculo_id, ESTADO_EN_REPARACION, empresaId);
}

// Se llama cada vez que uno de esos mantenimientos queda aprobado -- si ya
// no le queda ningun otro mantenimiento de ese tipo pendiente, el vehiculo
// vuelve solo a "activo" y queda disponible de nuevo para escoger en una
// ruta. Si el estado actual no es "reparacion" (ej. lo pasaron a
// fuera_servicio/dado_de_baja a mano mientras tanto) no se toca.
async function reevaluarDisponibilidad(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo || vehiculo.estado !== ESTADO_EN_REPARACION) return;

  const sigueBloqueado = await mantenimientosRepository.existeMantenimientoQueBloquea(vehiculoId, empresaId);
  if (!sigueBloqueado) {
    await vehiculosRepository.updateEstado(vehiculoId, ESTADO_ACTIVO, empresaId);
  }
}

module.exports = { marcarEnReparacionSiAplica, reevaluarDisponibilidad };
