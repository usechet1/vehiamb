const HttpError = require("../errors/http-error");
const asignacionesRepository = require("../repositories/asignaciones.repository");
const rutasRepository = require("../repositories/rutas.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");

function toSafeAsignacion(asignacion) {
  return {
    id: asignacion.id,
    fecha: asignacion.fecha,
    conductor_id: asignacion.conductor_id,
    conductor_nombre: asignacion.conductor_id
      ? `${asignacion.conductor_nombres || ""} ${asignacion.conductor_apellidos || ""}`.trim()
      : null,
    // Version Apellidos-Nombres, solo para los reportes exportados (Excel/
    // imagen) -- en pantalla (asignaciones.js) se sigue mostrando
    // conductor_nombre (Nombres-Apellidos) sin tocar.
    conductor_nombre_reporte: asignacion.conductor_id
      ? `${asignacion.conductor_apellidos || ""} ${asignacion.conductor_nombres || ""}`.trim()
      : null,
    vehiculo_id: asignacion.vehiculo_id,
    vehiculo_placa: asignacion.vehiculo_placa,
    ruta_id: asignacion.ruta_id,
    ruta_nombre: asignacion.ruta_nombre,
    destinos: asignacion.destinos || null,
    telefono: asignacion.telefono,
    observaciones: asignacion.observaciones || null
  };
}

function toSafeRuta(ruta) {
  return { id: ruta.id, nombre: ruta.nombre };
}

async function listarRutas(empresaId) {
  const rutas = await rutasRepository.findAll(empresaId);
  return rutas.map(toSafeRuta);
}

async function listarPorFecha(fecha, empresaId) {
  if (!fecha) {
    throw new HttpError(400, "Debes indicar la fecha del reporte");
  }

  const asignaciones = await asignacionesRepository.findByFecha(fecha, empresaId);
  return asignaciones.map(toSafeAsignacion);
}

// Vehiculos que ya tienen un mantenimiento programado (y todavia pendiente)
// para esa fecha -- mismo criterio que validarYResolverPayload usa para
// rechazar el guardado, pero de una vez para todos los vehiculos, asi el
// selector del formulario los puede marcar apenas se elige la fecha, sin
// esperar a que el usuario intente guardar y le salga el error.
async function vehiculosBloqueadosEnFecha(fecha, empresaId) {
  if (!fecha) {
    throw new HttpError(400, "Debes indicar la fecha");
  }

  const rows = await mantenimientosRepository.findVehiculosBloqueadosEnFecha(fecha, empresaId);
  return rows.map((row) => row.vehiculo_id);
}

async function validarYResolverPayload(payload, empresaId, excludeId = null) {
  if (!payload.fecha) {
    throw new HttpError(400, "Debes indicar la fecha de la asignación");
  }

  if (!payload.conductor_id) {
    throw new HttpError(400, "Debes seleccionar un conductor");
  }
  const conductor = await conductoresRepository.findById(payload.conductor_id, empresaId);
  if (!conductor) {
    throw new HttpError(404, "Conductor no encontrado");
  }

  // Un conductor solo puede tener una ruta asignada por dia -- sin esto, el
  // mismo conductor quedaba asignado a dos vehiculos distintos el mismo dia
  // (bug real reportado: aparecia dos veces en el reporte, cada vez con un
  // vehiculo/ruta diferente).
  const asignacionExistente = await asignacionesRepository.findByConductorYFecha(conductor.id, payload.fecha, empresaId);
  if (asignacionExistente && String(asignacionExistente.id) !== String(excludeId)) {
    throw new HttpError(409, `${conductor.nombres} ${conductor.apellidos} ya tiene una ruta asignada el ${payload.fecha} (vehículo ${asignacionExistente.vehiculo_placa || "sin placa"}). Elimina o edita esa asignación primero.`);
  }

  if (!payload.vehiculo_id) {
    throw new HttpError(400, "Debes seleccionar un vehículo");
  }
  const vehiculo = await vehiculosRepository.findById(payload.vehiculo_id, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  // El selector del frontend ya oculta los vehiculos que no estan "activo"
  // (ver asignaciones.js), pero eso es solo la UI -- esta es la validacion
  // real que evita asignar por API directa un vehiculo en reparacion, fuera
  // de servicio o dado de baja. Al editar una asignacion existente se deja
  // pasar si el vehiculo no cambio (para no bloquear ediciones de otros
  // campos de una asignacion vieja cuyo vehiculo quedo inhabilitado despues).
  const original = excludeId ? await asignacionesRepository.findById(excludeId, empresaId) : null;
  const vehiculoSinCambios = Boolean(original) && String(original.vehiculo_id) === String(vehiculo.id);

  if (vehiculo.estado !== "activo" && !vehiculoSinCambios) {
    throw new HttpError(409, `El vehículo ${vehiculo.placa} no está disponible para asignar rutas (estado: ${vehiculo.estado}).`);
  }

  // Bloqueo especifico del dia: un mantenimiento (de cualquier tipo)
  // programado EXACTAMENTE para esa fecha, o uno "pendiente" (sin resolver)
  // desde esa fecha o antes, bloquea el vehiculo ESE dia -- deliberadamente
  // sin tocar ni depender de vehiculos.estado (ver el comentario de
  // existeMantenimientoQueBloquea en el repositorio: ese campo solo refleja
  // bloqueos abiertos/indefinidos, nunca uno de un solo dia, para no dejar
  // el vehiculo marcado "en reparacion" para CUALQUIER fecha futura solo por
  // una revision puntual de hoy). A diferencia del chequeo de estado de
  // arriba, este SIEMPRE se corre, incluso al editar una asignacion sin
  // cambios: es el caso real que motivo este chequeo -- rutas planificadas
  // con anticipacion, y el mantenimiento se programa despues, encima de una
  // asignacion que ya existia.
  const bloqueadoEnFecha = await mantenimientosRepository.existeMantenimientoQueBloqueaEnFecha(vehiculo.id, payload.fecha, empresaId);
  if (bloqueadoEnFecha) {
    throw new HttpError(409, `El vehículo ${vehiculo.placa} tiene un mantenimiento programado y no está disponible el ${payload.fecha}.`);
  }

  const destinos = Array.isArray(payload.destinos) ? payload.destinos : [];
  if (!destinos.length) {
    throw new HttpError(400, "Debes agregar al menos un destino");
  }

  const destinosNormalizados = destinos.map((destino) => ({
    departamento: String(destino?.departamento || "").trim(),
    municipio: String(destino?.municipio || "").trim()
  }));

  if (destinosNormalizados.some((destino) => !destino.departamento || !destino.municipio)) {
    throw new HttpError(400, "Selecciona departamento y municipio en cada destino");
  }

  const nombreRuta = destinosNormalizados.map((destino) => destino.municipio).join(" - ");
  const ruta = await rutasRepository.findOrCreateByNombre(nombreRuta, empresaId);

  const telefono = String(payload.telefono || conductor.telefono || "").trim() || null;
  // Campo libre y opcional: novedades del recorrido (retrasos, cambios de
  // ultima hora, carga especial). Se recorta para que una nota larga no
  // desarme la columna del reporte impreso.
  const observaciones = String(payload.observaciones || "").trim().slice(0, 500) || null;

  return {
    fecha: payload.fecha,
    conductor_id: conductor.id,
    vehiculo_id: vehiculo.id,
    ruta_id: ruta.id,
    destinos: destinosNormalizados,
    telefono,
    observaciones
  };
}

async function crear(payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const datos = await validarYResolverPayload(payload, empresaId);

  const asignacion = await asignacionesRepository.create({
    ...datos,
    usuario_id: currentUser?.id ?? null,
    empresa_id: empresaId
  });

  return toSafeAsignacion(asignacion);
}

async function actualizar(id, payload, currentUser) {
  const empresaId = currentUser.empresa_id;
  const existente = await asignacionesRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Asignación no encontrada");
  }

  const datos = await validarYResolverPayload({ ...payload, fecha: payload.fecha || existente.fecha }, empresaId, id);
  const asignacion = await asignacionesRepository.update(id, datos, empresaId);
  return toSafeAsignacion(asignacion);
}

async function eliminar(id, currentUser) {
  const empresaId = currentUser.empresa_id;
  const existente = await asignacionesRepository.findById(id, empresaId);
  if (!existente) {
    throw new HttpError(404, "Asignación no encontrada");
  }

  await asignacionesRepository.remove(id, empresaId);
}

module.exports = {
  listarRutas,
  listarPorFecha,
  vehiculosBloqueadosEnFecha,
  crear,
  actualizar,
  eliminar
};
