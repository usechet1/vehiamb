const viajesService = require("../services/viajes.service");

exports.crear = async (req, res) => {
  const viaje = await viajesService.crear(req.body, req.user);
  res.status(201).json(viaje);
};

exports.listarRecientes = async (req, res) => {
  const viajes = await viajesService.listarRecientes(req.user);
  res.json(viajes);
};

exports.obtenerUltimoControl = async (req, res) => {
  const resultado = await viajesService.obtenerUltimoViajeControl(req.user);
  res.json(resultado);
};

exports.getPorVehiculo = async (req, res) => {
  const viajes = await viajesService.listarPorVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(viajes);
};
