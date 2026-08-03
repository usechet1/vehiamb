const HttpError = require("../errors/http-error");
const asignacionesRepository = require("../repositories/asignaciones.repository");
const rutasRepository = require("../repositories/rutas.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");

function toSafeAsignacion(asignacion) {
  return {
    id: asignacion.id,
    fecha: asignacion.fecha,
    conductor_id: asignacion.conductor_id,
    conductor_nombre: asignacion.conductor_id
      ? `${asignacion.conductor_nombres || ""} ${asignacion.conductor_apellidos || ""}`.trim()
      : null,
    vehiculo_id: asignacion.vehiculo_id,
    vehiculo_placa: asignacion.vehiculo_placa,
    ruta_id: asignacion.ruta_id,
    ruta_nombre: asignacion.ruta_nombre,
    telefono: asignacion.telefono
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

async function validarYResolverPayload(payload, empresaId) {
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

  if (!payload.vehiculo_id) {
    throw new HttpError(400, "Debes seleccionar un vehículo");
  }
  const vehiculo = await vehiculosRepository.findById(payload.vehiculo_id, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const nombreRuta = String(payload.ruta_nombre || "").trim();
  if (!nombreRuta) {
    throw new HttpError(400, "Debes indicar la ruta");
  }
  const ruta = await rutasRepository.findOrCreateByNombre(nombreRuta, empresaId);

  const telefono = String(payload.telefono || conductor.telefono || "").trim() || null;

  return {
    fecha: payload.fecha,
    conductor_id: conductor.id,
    vehiculo_id: vehiculo.id,
    ruta_id: ruta.id,
    telefono
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

  const datos = await validarYResolverPayload({ ...payload, fecha: payload.fecha || existente.fecha }, empresaId);
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
  crear,
  actualizar,
  eliminar
};
