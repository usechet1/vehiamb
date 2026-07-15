const HttpError = require("../errors/http-error");
const notificacionesRepository = require("../repositories/notificaciones.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const mantenimientosRepository = require("../repositories/mantenimientos.repository");
const notifConfig = require("../config/notificaciones.config");

const APPROVAL_PERMISSION = "maintenance.approve";

const TIPOS_MANTENIMIENTO_LABEL = {
  revision: "Revision general",
  preventivo: "Mantenimiento preventivo",
  correctivo: "Mantenimiento correctivo",
  cambio_aceite: "Cambio de aceite",
  frenos: "Frenos",
  llantas: "Llantas",
  otro: "Otro"
};

// Agrupar cuando hay al menos este numero de notificaciones sin leer del mismo tipo.
const GRUPO_MINIMO = 3;

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function tipoMantenimientoLabel(tipo) {
  return TIPOS_MANTENIMIENTO_LABEL[tipo] || tipo;
}

/**
 * Canales de entrega. Hoy solo existe el canal "app" (persistencia en BD, ya
 * ocurrida antes de llegar aqui). Agregar un canal nuevo (email, WhatsApp,
 * push, SMS, Teams, Slack) es implementar una funcion mas en este arreglo
 * -- ninguna otra parte del sistema necesita cambiar.
 */
const CHANNELS = [
  function appChannel() {
    // La notificacion ya quedo persistida en la base de datos: es el canal
    // por defecto y siempre esta activo.
  },
  function externalWebhookChannel(notificacion) {
    // TODO: integrar proveedor externo (WhatsApp Business API, email, Slack, Teams...).
    // Punto de extension unico: nada mas en el sistema necesita saber de esto.
    void notificacion;
  }
];

function dispatchChannels(notificacion) {
  CHANNELS.forEach((channel) => {
    try {
      channel(notificacion);
    } catch (error) {
      console.error("Error despachando canal de notificacion:", error.message);
    }
  });
}

/**
 * Punto de entrada unico para crear una notificacion. Resuelve categoria,
 * prioridad y titulo por defecto desde el catalogo central (notificaciones.config.js)
 * si no se especifican explicitamente, y serializa la accion rapida asociada.
 */
async function notificar({
  usuario_id,
  tipo,
  mensaje,
  titulo,
  categoria,
  prioridad,
  vehiculo_id,
  referencia_tipo,
  referencia_id,
  accion
}) {
  const defaults = notifConfig.tipoConfig(tipo);

  const notificacion = await notificacionesRepository.create({
    usuario_id,
    tipo,
    categoria: categoria || defaults.categoria,
    prioridad: prioridad || defaults.prioridad,
    titulo: titulo || defaults.titulo,
    mensaje,
    vehiculo_id: vehiculo_id ?? null,
    accion_tipo: accion?.tipo || null,
    accion_payload: accion?.payload ? JSON.stringify(accion.payload) : null,
    referencia_tipo,
    referencia_id
  });

  dispatchChannels(notificacion);

  return notificacion;
}

// Alias retrocompatible: el nombre anterior de la funcion nucleo.
async function crearNotificacion(payload) {
  return notificar(payload);
}

async function notificarUsuariosConPermiso(permissionCode, payload) {
  const usuarios = await usuariosRepository.findByPermission(permissionCode);

  return Promise.all(
    usuarios.map((usuario) => notificar({ ...payload, usuario_id: usuario.id }))
  );
}

async function notificarUsuariosPorRol(roleNames, payload) {
  const usuarios = await usuariosRepository.findByRoles(roleNames);

  return Promise.all(
    usuarios.map((usuario) => notificar({ ...payload, usuario_id: usuario.id }))
  );
}

// Se dispara cuando un Conductor guarda la inspeccion preventiva de un viaje
// (paso 3 del wizard) y queda con items sin revisar y/o marcados "mal"/"no
// tiene": Administrador y Operador necesitan saber que el vehiculo salio a
// ruta con hallazgos pendientes. No aplica a inspecciones que registren
// Administrador/Operador por su cuenta (no estan "iniciando un viaje").
async function evaluarNotificacionInspeccion({ inspeccion, vehiculo, currentUser, totalItemsFaltantes, totalItemsMal }) {
  if (currentUser?.rol !== "Conductor") return;
  if (totalItemsFaltantes <= 0 && totalItemsMal <= 0) return;

  const partes = [];
  if (totalItemsFaltantes > 0) partes.push(`${totalItemsFaltantes} ítem${totalItemsFaltantes === 1 ? "" : "s"} sin revisar`);
  if (totalItemsMal > 0) partes.push(`${totalItemsMal} ítem${totalItemsMal === 1 ? "" : "s"} en mal estado`);

  await notificarUsuariosPorRol(["Administrador", "Operador"], {
    tipo: "inspeccion_con_hallazgos",
    mensaje: `El conductor ${currentUser.nombre} inició un viaje con el vehículo ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}) y la inspección preventiva quedó con ${partes.join(" y ")}.`,
    vehiculo_id: vehiculo.id,
    referencia_tipo: "inspeccion",
    referencia_id: inspeccion.id,
    accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
  });
}

async function evaluarNotificacionesMantenimiento({ mantenimiento, vehiculo, requiereAprobacion }) {
  const vehiculoLabel = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})`;
  const tareas = [];

  if (requiereAprobacion) {
    tareas.push(
      notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
        tipo: "aprobacion_requerida",
        mensaje: `El vehiculo ${vehiculo.placa} requiere aprobacion para ${tipoMantenimientoLabel(mantenimiento.tipo)} por un valor de ${formatCurrency(mantenimiento.valor)}.`,
        vehiculo_id: vehiculo.id,
        referencia_tipo: "mantenimiento",
        referencia_id: mantenimiento.id,
        accion: { tipo: "ver_mantenimiento", payload: { mantenimiento_id: mantenimiento.id } }
      })
    );
  }

  if (mantenimiento.vehiculo_varado) {
    tareas.push(
      notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
        tipo: "vehiculo_en_mantenimiento",
        mensaje: `El vehiculo ${vehiculoLabel} ha entrado a mantenimiento ${tipoMantenimientoLabel(mantenimiento.tipo)} y no esta disponible para asignacion de rutas.`,
        vehiculo_id: vehiculo.id,
        referencia_tipo: "mantenimiento",
        referencia_id: mantenimiento.id,
        accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
      })
    );
  }

  await Promise.all(tareas);
}

async function notificarIncoherenciaKilometraje({ vehiculo, kilometrajeIntentado }) {
  const kilometrajeActual = Number(vehiculo.kilometraje_actual || 0);

  try {
    await notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
      tipo: "kilometraje_incoherente",
      mensaje: `¡Atencion! Se intento registrar un kilometraje de ${Number(kilometrajeIntentado).toLocaleString("es-CO")} km en el vehiculo ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa}), cuando el ultimo registro fue de ${kilometrajeActual.toLocaleString("es-CO")} km.`,
      vehiculo_id: vehiculo.id,
      referencia_tipo: "vehiculo",
      referencia_id: vehiculo.id,
      accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
    });
  } catch (error) {
    console.error("No fue posible generar la notificacion de incoherencia de kilometraje:", error.message);
  }
}

async function notificarCambioEstadoVehiculo({ vehiculo, estadoAnterior, estadoNuevo }) {
  if (estadoAnterior === estadoNuevo) return;

  const vehiculoLabel = `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.placa})`;

  if (estadoNuevo === "fuera_servicio") {
    await notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
      tipo: "vehiculo_fuera_servicio",
      mensaje: `El vehiculo ${vehiculoLabel} fue marcado como fuera de servicio.`,
      vehiculo_id: vehiculo.id,
      referencia_tipo: "vehiculo",
      referencia_id: vehiculo.id,
      accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
    });
    return;
  }

  if (estadoAnterior === "fuera_servicio" && estadoNuevo === "activo") {
    await notificarUsuariosConPermiso(APPROVAL_PERMISSION, {
      tipo: "vehiculo_disponible",
      mensaje: `El vehiculo ${vehiculoLabel} volvio a estar disponible.`,
      vehiculo_id: vehiculo.id,
      referencia_tipo: "vehiculo",
      referencia_id: vehiculo.id,
      accion: { tipo: "ver_vehiculo", payload: { vehiculo_id: vehiculo.id } }
    });
  }
}

async function notificarUsuarioCreado(usuario) {
  await notificarUsuariosConPermiso("users.manage", {
    tipo: "usuario_creado",
    mensaje: `Se creo el usuario ${usuario.nombre} (${usuario.email}) con el rol ${usuario.rol}.`,
    referencia_tipo: "usuario",
    referencia_id: usuario.id,
    accion: { tipo: "ver_usuario", payload: { usuario_id: usuario.id } }
  });
}

async function notificarPermisosActualizados(usuario) {
  await notificarUsuariosConPermiso("users.manage", {
    tipo: "permisos_actualizados",
    mensaje: `El usuario ${usuario.nombre} (${usuario.email}) ahora tiene el rol ${usuario.rol}.`,
    referencia_tipo: "usuario",
    referencia_id: usuario.id,
    accion: { tipo: "ver_usuario", payload: { usuario_id: usuario.id } }
  });
}

function enrichNotificacion(row) {
  const defaults = notifConfig.tipoConfig(row.tipo);
  const prioridad = notifConfig.normalizarPrioridad(row.prioridad) || defaults.prioridad;

  let accionPayload = null;
  if (row.accion_payload) {
    try {
      accionPayload = JSON.parse(row.accion_payload);
    } catch (error) {
      accionPayload = null;
    }
  }

  return {
    ...row,
    titulo: row.titulo || defaults.titulo,
    categoria: row.categoria || defaults.categoria,
    prioridad,
    leido: row.estado !== "no_leida",
    vehiculo: row.vehiculo_id
      ? { id: row.vehiculo_id, placa: row.vehiculo_placa, marca: row.vehiculo_marca, modelo: row.vehiculo_modelo }
      : null,
    accion: row.accion_tipo ? { tipo: row.accion_tipo, payload: accionPayload } : null
  };
}

/**
 * Agrupa notificaciones sin leer del mismo tipo cuando hay 3 o mas (ej. "3
 * vehiculos tienen el SOAT proximo a vencer"). La agrupacion es puramente de
 * presentacion: no crea ninguna entidad nueva en BD, solo reorganiza la
 * respuesta. Cada grupo conserva el detalle original expandible.
 */
function agruparNotificaciones(items) {
  const porTipo = new Map();

  items.forEach((item) => {
    if (item.estado !== "no_leida") return;
    if (!porTipo.has(item.tipo)) porTipo.set(item.tipo, []);
    porTipo.get(item.tipo).push(item);
  });

  const idsAgrupados = new Set();
  const grupos = [];

  porTipo.forEach((grupo, tipo) => {
    if (grupo.length < GRUPO_MINIMO) return;

    grupo.forEach((item) => idsAgrupados.add(item.id));

    const defaults = notifConfig.tipoConfig(tipo);
    const prioridadMasAlta = grupo.reduce(
      (masAlta, item) => (notifConfig.ordenPrioridad(item.prioridad) < notifConfig.ordenPrioridad(masAlta) ? item.prioridad : masAlta),
      grupo[0].prioridad
    );

    grupos.push({
      id: `grupo-${tipo}`,
      agrupado: true,
      tipo,
      categoria: defaults.categoria,
      prioridad: prioridadMasAlta,
      titulo: `${grupo.length} vehiculos: ${defaults.titulo.toLowerCase()}`,
      mensaje: `${grupo.length} vehiculos tienen una notificacion de "${defaults.titulo.toLowerCase()}". Expande para ver el detalle.`,
      estado: "no_leida",
      fecha_creacion: grupo[0].fecha_creacion,
      items: grupo
    });
  });

  const individuales = items.filter((item) => !idsAgrupados.has(item.id));
  const resultado = [...grupos, ...individuales];

  return resultado.sort((a, b) => {
    const prioridadDiff = notifConfig.ordenPrioridad(a.prioridad) - notifConfig.ordenPrioridad(b.prioridad);
    if (prioridadDiff !== 0) return prioridadDiff;
    return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
  });
}

async function listNotificaciones(usuarioId, filters = {}) {
  const rows = await notificacionesRepository.findByUsuario(usuarioId, filters);
  const items = rows.map(enrichNotificacion);

  if (filters.agrupar === false) {
    return items.sort((a, b) => {
      const prioridadDiff = notifConfig.ordenPrioridad(a.prioridad) - notifConfig.ordenPrioridad(b.prioridad);
      if (prioridadDiff !== 0) return prioridadDiff;
      return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
    });
  }

  return agruparNotificaciones(items);
}

// Compatibilidad con el nombre anterior (listado sin filtros, usado en versiones previas).
async function listNotificacionesByUsuario(usuarioId) {
  return listNotificaciones(usuarioId, {});
}

async function contarPendientes(usuarioId) {
  return notificacionesRepository.countPendientes(usuarioId);
}

async function marcarLeida(id, usuarioId) {
  return notificacionesRepository.markAsRead(id, usuarioId);
}

async function marcarTodasLeidas(usuarioId) {
  return notificacionesRepository.markAllAsRead(usuarioId);
}

async function archivarNotificacion(id, usuarioId) {
  return notificacionesRepository.archive(id, usuarioId);
}

async function eliminarNotificacion(id, usuarioId) {
  return notificacionesRepository.remove(id, usuarioId);
}

async function eliminarLeidas(usuarioId) {
  return notificacionesRepository.removeLeidas(usuarioId);
}

async function resolverNotificacionAprobacion(notificacionId, currentUser, estadoDestino) {
  const notificacion = await notificacionesRepository.findById(notificacionId);
  if (!notificacion) {
    throw new HttpError(404, "Notificación no encontrada");
  }

  if (notificacion.tipo !== "aprobacion_requerida" || notificacion.referencia_tipo !== "mantenimiento") {
    throw new HttpError(400, "La notificación no corresponde a una aprobación de mantenimiento");
  }

  const mantenimiento = await mantenimientosRepository.updateEstado(notificacion.referencia_id, estadoDestino);
  if (!mantenimiento) {
    throw new HttpError(404, "Mantenimiento no encontrado");
  }

  await notificacionesRepository.markAsRead(notificacionId, currentUser.id);

  if (mantenimiento.creado_por_usuario_id) {
    const vehiculoLabel = `${mantenimiento.marca} ${mantenimiento.modelo} (${mantenimiento.placa})`;
    const mensaje = estadoDestino === "aprobado"
      ? `El mantenimiento ${tipoMantenimientoLabel(mantenimiento.tipo)} del vehiculo ${mantenimiento.placa} ha sido aprobado y registrado exitosamente.`
      : `El mantenimiento ${tipoMantenimientoLabel(mantenimiento.tipo)} del vehiculo ${vehiculoLabel} fue rechazado. Revisa los detalles con el area administrativa.`;

    await notificar({
      usuario_id: mantenimiento.creado_por_usuario_id,
      tipo: estadoDestino === "aprobado" ? "mantenimiento_aprobado" : "mantenimiento_rechazado",
      mensaje,
      vehiculo_id: mantenimiento.vehiculo_id,
      referencia_tipo: "mantenimiento",
      referencia_id: mantenimiento.id,
      accion: { tipo: "ver_mantenimiento", payload: { mantenimiento_id: mantenimiento.id } }
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
  notificar,
  crearNotificacion,
  notificarUsuariosConPermiso,
  notificarUsuariosPorRol,
  evaluarNotificacionInspeccion,
  evaluarNotificacionesMantenimiento,
  notificarIncoherenciaKilometraje,
  notificarCambioEstadoVehiculo,
  notificarUsuarioCreado,
  notificarPermisosActualizados,
  listNotificaciones,
  listNotificacionesByUsuario,
  contarPendientes,
  marcarLeida,
  marcarTodasLeidas,
  archivarNotificacion,
  eliminarNotificacion,
  eliminarLeidas,
  aprobarNotificacion,
  rechazarNotificacion,
  existsRecentByReferencia: notificacionesRepository.existsRecentByReferencia
};
