const HttpError = require("../errors/http-error");
const notificacionesRepository = require("../repositories/notificaciones.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");

const APPROVAL_PERMISSION = "maintenance.approve";

const TIPOS_LABEL = {
  revision: "Revision general",
  preventivo: "Mantenimiento preventivo",
  correctivo: "Mantenimiento correctivo",
  cambio_aceite: "Cambio de aceite",
  frenos: "Frenos",
  llantas: "Llantas",
  otro: "Otro"
};

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function tipoLabel(tipo) {
  return TIPOS_LABEL[tipo] || tipo;
}

/**
 * Punto de extension unico para salida externa (ej. webhook de WhatsApp).
 * Mantener esta funcion como el unico lugar que conoce integraciones externas
 * permite activar un canal nuevo sin tocar las reglas de negocio.
 */
function dispatchExternalWebhook(notificacion) {
  if (!notificacion) return;
  // TODO: integrar proveedor externo (ej. POST a un webhook de WhatsApp Business API).
}

async function crearNotificacion({ usuario_id, tipo, prioridad, mensaje, referencia_tipo, referencia_id }) {
  const notificacion = await notificacionesRepository.create({
    usuario_id,
    tipo,
    prioridad,
    mensaje,
    referencia_tipo,
    referencia_id
  });

  dispatchExternalWebhook(notificacion);

  return notificacion;
}

async function notificarUsuariosConPermiso(permissionCode, { tipo, prioridad, mensaje, referencia_tipo, referencia_id }) {
  const usuarios = await usuariosRepository.findByPermission(permissionCode);

  return Promise.all(
    usuarios.map((usuario) =>
      crearNotificacion({
        usuario_id: usuario.id,
        tipo,
        prioridad,
        mensaje,
        referencia_tipo,
        referencia_id
      })
    )
  );
}

async function evaluarNotificacionesMantenimiento({ mantenimiento, vehiculo, requiereAprobacion }) {
  const vehiculoLabel = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})`;
  const tareas = [];

  if (requiereAprobacion) {
    tareas.push(
      notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
        tipo: "aprobacion",
        prioridad: "alta",
        mensaje: `El vehiculo ${vehiculo.placa} requiere aprobacion para ${tipoLabel(mantenimiento.tipo)} por un valor de ${formatCurrency(mantenimiento.valor)}.`,
        referencia_tipo: "mantenimiento",
        referencia_id: mantenimiento.id
      })
    );
  }

  if (mantenimiento.vehiculo_varado) {
    tareas.push(
      notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
        tipo: "alerta",
        prioridad: "media",
        mensaje: `El vehiculo ${vehiculoLabel} ha entrado a mantenimiento ${tipoLabel(mantenimiento.tipo)} y no esta disponible para asignacion de rutas.`,
        referencia_tipo: "mantenimiento",
        referencia_id: mantenimiento.id
      })
    );
  }

  await Promise.all(tareas);
}

async function notificarIncoherenciaKilometraje({ vehiculo, kilometrajeIntentado }) {
  const kilometrajeActual = Number(vehiculo.kilometraje_actual || 0);

  try {
    await notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
      tipo: "alerta",
      prioridad: "alta",
      mensaje: `¡Atencion! Se intento registrar un kilometraje de ${Number(kilometrajeIntentado).toLocaleString("es-CO")} km en el vehiculo ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}), cuando el ultimo registro fue de ${kilometrajeActual.toLocaleString("es-CO")} km.`,
      referencia_tipo: "vehiculo",
      referencia_id: vehiculo.id
    });
  } catch (error) {
    console.error("No fue posible generar la notificacion de incoherencia de kilometraje:", error.message);
  }
}

async function listNotificacionesByUsuario(usuarioId) {
  return notificacionesRepository.findByUsuario(usuarioId);
}

async function marcarLeida(id, usuarioId) {
  return notificacionesRepository.markAsRead(id, usuarioId);
}

async function resolverNotificacionAprobacion(notificacionId, currentUser, estadoDestino) {
  const notificacion = await notificacionesRepository.findById(notificacionId);
  if (!notificacion) {
    throw new HttpError(404, "Notificacion no encontrada");
  }

  if (notificacion.tipo !== "aprobacion" || notificacion.referencia_tipo !== "mantenimiento") {
    throw new HttpError(400, "La notificacion no corresponde a una aprobacion de mantenimiento");
  }

  const mantenimiento = await mantenimientosRepository.updateEstado(notificacion.referencia_id, estadoDestino);
  if (!mantenimiento) {
    throw new HttpError(404, "Mantenimiento no encontrado");
  }

  await notificacionesRepository.markAsRead(notificacionId, currentUser.id);

  if (mantenimiento.creado_por_usuario_id) {
    const vehiculoLabel = `${mantenimiento.marca} ${mantenimiento.modelo} (${mantenimiento.placa})`;
    const mensaje = estadoDestino === "aprobado"
      ? `El mantenimiento ${tipoLabel(mantenimiento.tipo)} del vehiculo ${mantenimiento.placa} ha sido aprobado y registrado exitosamente.`
      : `El mantenimiento ${tipoLabel(mantenimiento.tipo)} del vehiculo ${vehiculoLabel} fue rechazado. Revisa los detalles con el area administrativa.`;

    await crearNotificacion({
      usuario_id: mantenimiento.creado_por_usuario_id,
      tipo: estadoDestino === "aprobado" ? "info" : "alerta",
      prioridad: estadoDestino === "aprobado" ? "baja" : "media",
      mensaje,
      referencia_tipo: "mantenimiento",
      referencia_id: mantenimiento.id
    });
  }

  return mantenimiento;
}

async function aprobarNotificacion(notificacionId, currentUser) {
  return resolverNotificacionAprobacion(notificacionId, currentUser, "aprobado");
}

async function rechazarNotificacion(notificacionId, currentUser) {
  return resolverNotificacionAprobacion(notificacionId, currentUser, "rechazado");
}

module.exports = {
  APPROVAL_PERMISSION,
  crearNotificacion,
  notificarUsuariosConPermiso,
  evaluarNotificacionesMantenimiento,
  notificarIncoherenciaKilometraje,
  listNotificacionesByUsuario,
  marcarLeida,
  aprobarNotificacion,
  rechazarNotificacion,
  existsRecentByReferencia: notificacionesRepository.existsRecentByReferencia
};
