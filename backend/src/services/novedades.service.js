const fs = require("fs/promises");
const path = require("path");
const HttpError = require("../errors/http-error");
const novedadesRepository = require("../repositories/novedades.repository");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const notificacionComentariosRepository = require("../repositories/notificacion-comentarios.repository");

function toTrimmedOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

async function listNovedades(filters, empresaId) {
  return novedadesRepository.findAll(
    {
      vehiculoId: filters.vehiculo_id,
      fechaDesde: filters.fecha_desde,
      fechaHasta: filters.fecha_hasta
    },
    empresaId
  );
}

async function listNovedadesByVehicle(vehiculoId, empresaId) {
  return novedadesRepository.findByVehicle(vehiculoId, empresaId);
}

async function createNovedad(payload, file, currentUser) {
  const empresaId = currentUser.empresa_id;

  const vehiculoId = Number(payload.vehiculo_id);
  if (!Number.isInteger(vehiculoId) || vehiculoId <= 0) {
    throw new HttpError(400, "El vehiculo es obligatorio");
  }

  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const descripcion = toTrimmedOrNull(payload.descripcion);
  if (!descripcion) {
    throw new HttpError(400, "La descripción de la novedad es obligatoria");
  }

  const novedad = {
    empresa_id: empresaId,
    vehiculo_id: vehiculoId,
    fecha: toTrimmedOrNull(payload.fecha) || new Date().toISOString().slice(0, 10),
    descripcion,
    foto_url: file ? `/uploads/novedades/${file.filename}` : null,
    foto_nombre: file?.originalname || null,
    foto_mime: file?.mimetype || null,
    creado_por_usuario_id: currentUser?.id ?? null
  };

  return novedadesRepository.create(novedad);
}

async function eliminarArchivo(url) {
  if (!url) return;
  try {
    await fs.unlink(path.resolve(__dirname, "..", "..", url.replace(/^\//, "")));
  } catch (error) {
    // El archivo ya pudo haberse borrado a mano o nunca haberse escrito --
    // no es un error real del flujo de negocio.
  }
}

async function deleteNovedad(id, currentUser) {
  const empresaId = currentUser.empresa_id;
  const novedad = await novedadesRepository.findById(id, empresaId);
  if (!novedad) {
    throw new HttpError(404, "Novedad no encontrada");
  }

  await novedadesRepository.remove(id, empresaId);
  await eliminarArchivo(novedad.foto_url);
}

// Hilo de comentarios de una novedad, en solo lectura para quien tiene
// novedades.view -- antes esto se pedia por la ruta generica
// /notificaciones/referencia/novedad/:id/comentarios (permiso
// notificaciones.comentar, solo Administrador/Operador), asi que un rol como
// Conductor B (tiene novedades.view pero no notificaciones.comentar) recibia
// 403 y nunca veia las respuestas. Escribir sigue yendo por esa ruta
// generica, sin cambios; esta solo agrega una via de LECTURA equivalente
// (mismo criterio que viajes.service.js#listarComentariosViaje).
async function listarComentariosNovedad(id, currentUser) {
  const empresaId = currentUser.empresa_id;
  const novedad = await novedadesRepository.findById(id, empresaId);
  if (!novedad) {
    throw new HttpError(404, "Novedad no encontrada");
  }

  return notificacionComentariosRepository.findByReferencia("novedad", id, empresaId);
}

module.exports = {
  listNovedades,
  listNovedadesByVehicle,
  createNovedad,
  deleteNovedad,
  listarComentariosNovedad
};
