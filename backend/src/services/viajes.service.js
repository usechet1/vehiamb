const HttpError = require("../errors/http-error");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const viajesRepository = require("../repositories/viajes.repository");
const documentosRepository = require("../repositories/documentos.repository");
const conductoresRepository = require("../repositories/conductores.repository");
const conductorLicenciasRepository = require("../repositories/conductor-licencias.repository");
const inspeccionesRepository = require("../repositories/inspecciones-preventivas.repository");
const itemsRepository = require("../repositories/inspeccion-items.repository");
const preoperacionalesRepository = require("../repositories/preoperacionales.repository");
const preoperacionalItemsRepository = require("../repositories/preoperacional-items.repository");
const asignacionesRepository = require("../repositories/asignaciones.repository");
const notificacionComentariosRepository = require("../repositories/notificacion-comentarios.repository");
const { hoyIso, mananaIso } = require("../utils/fecha-negocio");

// Documentos relevantes para un control de transito en carretera. "otro" se
// deja afuera a proposito -- ahi cae de todo (misceláneo) y no es lo primero
// que pide un agente de transito.
const TIPOS_DOCUMENTO_CONTROL = ["soat", "tecnomecanica", "seguro", "licencia_transito"];

function toSafeDocumentoControl(documento) {
  return {
    id: documento.id,
    tipo: documento.tipo,
    numero_documento: documento.numero_documento,
    fecha_expedicion: documento.fecha_expedicion,
    fecha_vencimiento: documento.fecha_vencimiento,
    archivo_url: documento.archivo_url,
    archivo_nombre: documento.archivo_nombre,
    propietario_tipo_identificacion: documento.propietario_tipo_identificacion,
    propietario_numero_identificacion: documento.propietario_numero_identificacion,
    propietario_nombre: documento.propietario_nombre
  };
}

function toSafeViaje(viaje) {
  return {
    id: viaje.id,
    vehiculo_id: viaje.vehiculo_id,
    vehiculo_placa: viaje.vehiculo_placa,
    vehiculo_marca: viaje.vehiculo_marca,
    vehiculo_modelo: viaje.vehiculo_modelo,
    usuario_nombre: viaje.usuario_nombre,
    destino: viaje.destino,
    creado_en: viaje.creado_en
  };
}

async function crear(payload, currentUser) {
  const vehiculoId = payload.vehiculo_id;
  const vehiculo = await vehiculosRepository.findById(vehiculoId, currentUser.empresa_id);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const destino = String(payload.destino || "").trim().slice(0, 300);
  if (!destino) {
    throw new HttpError(400, "Debes indicar a dónde vas a realizar el viaje");
  }

  const viaje = await viajesRepository.create({
    vehiculo_id: vehiculoId,
    usuario_id: currentUser?.id ?? null,
    destino,
    empresa_id: currentUser.empresa_id
  });

  return toSafeViaje({
    ...viaje,
    vehiculo_placa: vehiculo.placa,
    vehiculo_marca: vehiculo.marca,
    vehiculo_modelo: vehiculo.modelo
  });
}

async function listarRecientes(currentUser) {
  const viajes = await viajesRepository.findRecientesPorUsuario(currentUser?.id ?? null);
  return viajes.map(toSafeViaje);
}

// Historial de viajes de un vehiculo (para la seccion "Ultimos viajes" en su
// hoja de vida), sin importar que conductor lo haya usado cada vez.
async function listarPorVehiculo(vehiculoId, empresaId) {
  const vehiculo = await vehiculosRepository.findById(vehiculoId, empresaId);
  if (!vehiculo) {
    throw new HttpError(404, "Vehículo no encontrado");
  }

  const viajes = await viajesRepository.findRecientesPorVehiculo(vehiculoId, empresaId);
  return viajes.map(toSafeViaje);
}

// Pantalla de solo lectura para un control de transito: el ultimo viaje
// registrado por el conductor, con los documentos vigentes del vehiculo y su
// propia licencia, todo en una sola consulta para poder mostrarlo rapido.
async function obtenerUltimoViajeControl(currentUser) {
  const empresaId = currentUser.empresa_id;
  const [ultimoViaje] = await viajesRepository.findRecientesPorUsuario(currentUser?.id ?? null, { limit: 1 });

  if (!ultimoViaje) {
    return null;
  }

  const [vehiculo, documentos, conductor] = await Promise.all([
    vehiculosRepository.findById(ultimoViaje.vehiculo_id, empresaId),
    documentosRepository.findByVehicle(ultimoViaje.vehiculo_id, empresaId),
    conductoresRepository.findByUsuarioId(currentUser.id, empresaId)
  ]);

  const licencias = conductor
    ? await conductorLicenciasRepository.findByConductor(conductor.id, empresaId)
    : [];

  return {
    viaje: toSafeViaje({
      ...ultimoViaje,
      vehiculo_placa: vehiculo?.placa,
      vehiculo_marca: vehiculo?.marca,
      vehiculo_modelo: vehiculo?.modelo
    }),
    vehiculo: vehiculo
      ? {
          id: vehiculo.id,
          placa: vehiculo.placa,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          imagen_url: vehiculo.imagen_url,
          kilometraje_actual: vehiculo.kilometraje_actual
        }
      : null,
    documentos: documentos
      .filter((documento) => TIPOS_DOCUMENTO_CONTROL.includes(documento.tipo))
      .map(toSafeDocumentoControl),
    conductor: conductor
      ? {
          nombres: conductor.nombres,
          apellidos: conductor.apellidos,
          cedula: conductor.cedula,
          licencias: licencias.map((licencia) => ({
            categoria: licencia.categoria,
            fecha_vencimiento: licencia.fecha_vencimiento,
            archivo_url: licencia.archivo_url,
            archivo_nombre: licencia.archivo_nombre
          }))
        }
      : null
  };
}

// Asignacion de "Asignacion de rutas" (calendario de Bogota) para el
// conductor logueado, para una fecha puntual (hoy o mañana) -- permite que
// la pantalla de inicio del conductor (home.js inicializarConductorHome)
// muestre directamente su vehiculo/ruta en vez de que tenga que elegirlos a
// mano. Devuelve null si el conductor no esta vinculado a un usuario, si no
// hay asignacion para esa fecha, o si la asignacion no tiene vehiculo
// cargado -- en cualquiera de esos casos el frontend cae al flujo manual de
// siempre. Tambien agrega si ya existe una inspeccion preparada de antemano
// para esa asignacion (ver inspecciones.service.js, modo "preinspeccion").
async function resolverAsignacionParaFecha(currentUser, fecha) {
  const conductor = await conductoresRepository.findByUsuarioId(currentUser.id, currentUser.empresa_id);
  if (!conductor) return null;

  const asignacion = await asignacionesRepository.findByConductorYFecha(conductor.id, fecha, currentUser.empresa_id);
  if (!asignacion || !asignacion.vehiculo_id) return null;

  const inspeccionPrevia = await inspeccionesRepository.findByAsignacionId(asignacion.id, currentUser.empresa_id);

  return {
    id: asignacion.id,
    fecha: asignacion.fecha,
    ruta_nombre: asignacion.ruta_nombre,
    inspeccion_completada: Boolean(inspeccionPrevia),
    vehiculo: {
      id: asignacion.vehiculo_id,
      placa: asignacion.vehiculo_placa,
      marca: asignacion.vehiculo_marca,
      modelo: asignacion.vehiculo_modelo,
      imagen_url: asignacion.vehiculo_imagen_url
    }
  };
}

async function obtenerAsignacionHoy(currentUser) {
  return resolverAsignacionParaFecha(currentUser, hoyIso());
}

// Ruta asignada para el dia siguiente -- permite que el conductor prepare la
// inspeccion del vehiculo la tarde/noche anterior (ver home.js, tarjeta
// "Prepara tu inspeccion de mañana").
async function obtenerAsignacionManana(currentUser) {
  return resolverAsignacionParaFecha(currentUser, mananaIso());
}

// Viajes recientes de toda la empresa (todos los conductores), para el rol
// que no es Conductor dentro de "Mi ultimo viaje" -- ver mi-viaje.js. Con
// filtros de fecha, ademas alimenta el exportable PDF/Excel de esa misma
// pantalla (mi-viaje-export.js), por eso cada viaje trae tambien el detalle
// item por item de su preoperacional e inspeccion preventiva (no solo si se
// hizo o no).
async function listarRecientesEmpresa(empresaId, { fechaDesde, fechaHasta } = {}) {
  const viajes = await viajesRepository.findRecientesPorEmpresa(empresaId, { fechaDesde, fechaHasta });
  return viajes.map((viaje) => {
    const preoperacionalItems = viaje.preoperacional_items || [];
    const inspeccionItems = viaje.inspeccion_items || [];

    return {
      ...toSafeViaje(viaje),
      preoperacional_realizado: viaje.preoperacional_id !== null && viaje.preoperacional_id !== undefined,
      preoperacional_items: preoperacionalItems,
      preoperacional_items_mal: preoperacionalItems.filter((item) => item.respuesta === "no").length,
      inspeccion_realizada: viaje.inspeccion_id !== null && viaje.inspeccion_id !== undefined,
      inspeccion_items: inspeccionItems,
      inspeccion_items_mal: inspeccionItems.filter((item) => item.estado === "mal").length
    };
  });
}

// Resumen de un viaje puntual para el drawer de "Viajes recientes"
// (Administrador/Operador): vehiculo, conductor, documentos vigentes e
// inspeccion preventiva (si el conductor la lleno al iniciar el viaje). Todo
// en una sola consulta para no forzar al usuario a salir a la hoja de vida
// del vehiculo solo para ver este detalle. Un Conductor tambien puede pedir
// este resumen (para revisar sus propios viajes en "Mi ultimo viaje"), pero
// solo del suyo -- trips.view por si solo no distingue de quien es el viaje,
// asi que la restriccion de dueño se hace aca.
async function obtenerResumen(viajeId, currentUser) {
  const viaje = await viajesRepository.findById(viajeId, currentUser.empresa_id);
  if (!viaje) {
    throw new HttpError(404, "Viaje no encontrado");
  }
  if (currentUser.rol === "Conductor" && String(viaje.usuario_id) !== String(currentUser.id)) {
    throw new HttpError(403, "No tienes permiso para ver este viaje");
  }

  const empresaId = currentUser.empresa_id;
  const [vehiculo, documentos, conductor, inspeccion, preoperacional] = await Promise.all([
    vehiculosRepository.findById(viaje.vehiculo_id, empresaId),
    documentosRepository.findByVehicle(viaje.vehiculo_id, empresaId),
    conductoresRepository.findByUsuarioId(viaje.usuario_id, empresaId),
    inspeccionesRepository.findByViajeId(viajeId, empresaId),
    preoperacionalesRepository.findByViajeId(viajeId, empresaId)
  ]);

  const itemsInspeccion = inspeccion ? await itemsRepository.findByInspeccion(inspeccion.id, empresaId) : [];
  const itemsPreoperacional = preoperacional
    ? await preoperacionalItemsRepository.findByPreoperacional(preoperacional.id, empresaId)
    : [];
  const licencias = conductor
    ? await conductorLicenciasRepository.findByConductor(conductor.id, empresaId)
    : [];

  return {
    viaje: toSafeViaje({
      ...viaje,
      vehiculo_placa: vehiculo?.placa,
      vehiculo_marca: vehiculo?.marca,
      vehiculo_modelo: vehiculo?.modelo
    }),
    vehiculo: vehiculo
      ? {
          id: vehiculo.id,
          placa: vehiculo.placa,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          imagen_url: vehiculo.imagen_url
        }
      : null,
    documentos: documentos
      .filter((documento) => TIPOS_DOCUMENTO_CONTROL.includes(documento.tipo))
      .map(toSafeDocumentoControl),
    conductor: conductor
      ? {
          nombres: conductor.nombres,
          apellidos: conductor.apellidos,
          cedula: conductor.cedula,
          licencias: licencias.map((licencia) => ({
            categoria: licencia.categoria,
            fecha_vencimiento: licencia.fecha_vencimiento
          }))
        }
      : null,
    inspeccion: inspeccion
      ? {
          id: inspeccion.id,
          fecha: inspeccion.fecha,
          total_items: itemsInspeccion.length,
          total_items_mal: itemsInspeccion.filter((item) => item.estado === "mal").length,
          items: itemsInspeccion.map((item) => ({
            item_label: item.item_label,
            estado: item.estado,
            comentario: item.comentario,
            foto_url: item.foto_url
          }))
        }
      : null,
    preoperacional: preoperacional
      ? {
          id: preoperacional.id,
          fecha: preoperacional.fecha,
          total_items: itemsPreoperacional.length,
          total_items_no: itemsPreoperacional.filter((item) => item.respuesta === "no").length,
          items: itemsPreoperacional.map((item) => ({
            item_label: item.item_label,
            respuesta: item.respuesta,
            observacion: item.observacion
          }))
        }
      : null
  };
}

// Hilo de comentarios de un viaje, en solo lectura para quien lo pide --
// escribir sigue yendo por /notificaciones/referencia/viaje/:id/comentarios
// (permiso notificaciones.comentar, Administrador/Operador). Reutiliza la
// misma tabla generica por referencia_tipo/referencia_id, con la misma
// restriccion de dueño que obtenerResumen para que un Conductor solo vea el
// hilo de sus propios viajes.
async function listarComentariosViaje(viajeId, currentUser) {
  const viaje = await viajesRepository.findById(viajeId, currentUser.empresa_id);
  if (!viaje) {
    throw new HttpError(404, "Viaje no encontrado");
  }
  if (currentUser.rol === "Conductor" && String(viaje.usuario_id) !== String(currentUser.id)) {
    throw new HttpError(403, "No tienes permiso para ver este viaje");
  }

  return notificacionComentariosRepository.findByReferencia("viaje", viajeId, currentUser.empresa_id);
}

module.exports = {
  crear,
  listarRecientes,
  listarPorVehiculo,
  listarRecientesEmpresa,
  obtenerUltimoViajeControl,
  obtenerAsignacionHoy,
  obtenerAsignacionManana,
  obtenerResumen,
  listarComentariosViaje
};
