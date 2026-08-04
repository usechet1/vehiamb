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

exports.getAsignacionHoy = async (req, res) => {
  const resultado = await viajesService.obtenerAsignacionHoy(req.user);
  res.json(resultado);
};

exports.getPorVehiculo = async (req, res) => {
  const viajes = await viajesService.listarPorVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(viajes);
};

exports.getRecientesEmpresa = async (req, res) => {
  const viajes = await viajesService.listarRecientesEmpresa(req.empresaId);
  res.json(viajes);
};

exports.getResumen = async (req, res) => {
  const resumen = await viajesService.obtenerResumen(req.params.viajeId, req.empresaId);
  res.json(resumen);
};
