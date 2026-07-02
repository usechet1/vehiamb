const notificacionesService = require("../services/notificaciones.service");

exports.getNotificaciones = async (req, res) => {
  const notificaciones = await notificacionesService.listNotificaciones(req.user.id, {
    estado: req.query.estado,
    prioridad: req.query.prioridad,
    categoria: req.query.categoria,
    vehiculo_id: req.query.vehiculo_id,
    fecha_desde: req.query.fecha_desde,
    fecha_hasta: req.query.fecha_hasta,
    search: req.query.search,
    agrupar: req.query.agrupar !== "false"
  });
  res.json(notificaciones);
};

exports.getContador = async (req, res) => {
  const total = await notificacionesService.contarPendientes(req.user.id);
  res.json({ pendientes: total });
};

exports.marcarLeida = async (req, res) => {
  await notificacionesService.marcarLeida(req.params.id, req.user.id);
  res.json({ ok: true });
};

exports.marcarTodasLeidas = async (req, res) => {
  await notificacionesService.marcarTodasLeidas(req.user.id);
  res.json({ ok: true });
};

exports.archivar = async (req, res) => {
  await notificacionesService.archivarNotificacion(req.params.id, req.user.id);
  res.json({ ok: true });
};

exports.eliminar = async (req, res) => {
  await notificacionesService.eliminarNotificacion(req.params.id, req.user.id);
  res.json({ ok: true });
};

exports.eliminarLeidas = async (req, res) => {
  await notificacionesService.eliminarLeidas(req.user.id);
  res.json({ ok: true });
};

exports.aprobar = async (req, res) => {
  const mantenimiento = await notificacionesService.aprobarNotificacion(req.params.id, req.user);
  res.json(mantenimiento);
};

exports.rechazar = async (req, res) => {
  const mantenimiento = await notificacionesService.rechazarNotificacion(req.params.id, req.user);
  res.json(mantenimiento);
};
