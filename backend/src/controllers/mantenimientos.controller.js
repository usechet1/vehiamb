const mantenimientosService = require("../services/mantenimientos.service");

exports.getMantenimientos = async (req, res) => {
  const { tipo, placa, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } = req.query;
  const mantenimientos = await mantenimientosService.listMantenimientos({
    tipo,
    placa,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta
  });
  res.json(mantenimientos);
};

exports.getMantenimientosByVehicle = async (req, res) => {
  const mantenimientos = await mantenimientosService.listMantenimientosByVehicle(req.params.vehiculoId);
  res.json(mantenimientos);
};

exports.createMantenimiento = async (req, res) => {
  const mantenimiento = await mantenimientosService.createMantenimiento(req.body, req.file, req.user);
  res.status(201).json(mantenimiento);
};
