const mantenimientosService = require("../services/mantenimientos.service");

exports.getMantenimientos = async (req, res) => {
  const mantenimientos = await mantenimientosService.listMantenimientos();
  res.json(mantenimientos);
};

exports.getMantenimientosByVehicle = async (req, res) => {
  const mantenimientos = await mantenimientosService.listMantenimientosByVehicle(req.params.vehiculoId);
  res.json(mantenimientos);
};

exports.createMantenimiento = async (req, res) => {
  const mantenimiento = await mantenimientosService.createMantenimiento(req.body, req.file);
  res.status(201).json(mantenimiento);
};
