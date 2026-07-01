const notificacionesService = require("../services/notificaciones.service");

exports.getNotificaciones = async (req, res) => {
  const notificaciones = await notificacionesService.listNotificacionesByUsuario(req.user.id);
  res.json(notificaciones);
};

exports.marcarLeida = async (req, res) => {
  await notificacionesService.marcarLeida(req.params.id, req.user.id);
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
