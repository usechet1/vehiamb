const gpsService = require("../services/gps.service");

exports.getDispositivos = async (req, res) => {
  const dispositivos = await gpsService.listarDispositivos(req.empresaId);
  res.json(dispositivos);
};

exports.registrarDispositivo = async (req, res) => {
  const dispositivo = await gpsService.registrarDispositivo(req.body, req.empresaId);
  res.status(201).json(dispositivo);
};

exports.asignarVehiculo = async (req, res) => {
  const dispositivo = await gpsService.asignarVehiculo(req.params.dispositivoId, req.body.vehiculo_id || null, req.empresaId);
  res.json(dispositivo);
};

exports.setEstadoDispositivo = async (req, res) => {
  const dispositivo = await gpsService.setEstadoDispositivo(req.params.dispositivoId, req.body.estado, req.empresaId);
  res.json(dispositivo);
};

exports.getFlota = async (req, res) => {
  const posiciones = await gpsService.listarPosicionesFlota(req.empresaId);
  res.json(posiciones);
};

exports.getHistorialVehiculo = async (req, res) => {
  const hasta = req.query.hasta ? new Date(req.query.hasta) : new Date();
  const desde = req.query.desde ? new Date(req.query.desde) : new Date(hasta.getTime() - 24 * 60 * 60 * 1000);

  const historial = await gpsService.obtenerHistorialVehiculo(req.params.vehiculoId, req.empresaId, { desde, hasta });
  res.json(historial);
};

exports.getEventosVehiculo = async (req, res) => {
  const eventos = await gpsService.listarEventosVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(eventos);
};
