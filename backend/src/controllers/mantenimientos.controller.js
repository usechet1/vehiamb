const mantenimientosService = require("../services/mantenimientos.service");

exports.getMantenimientos = async (req, res) => {
  const { tipo, placa, fecha_desde: fechaDesde, fecha_hasta: fechaHasta } = req.query;
  const mantenimientos = await mantenimientosService.listMantenimientos(
    {
      tipo,
      placa,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta
    },
    req.empresaId
  );
  res.json(mantenimientos);
};

exports.getMantenimientosByVehicle = async (req, res) => {
  const mantenimientos = await mantenimientosService.listMantenimientosByVehicle(req.params.vehiculoId, req.empresaId);
  res.json(mantenimientos);
};

exports.createMantenimiento = async (req, res) => {
  const mantenimiento = await mantenimientosService.createMantenimiento(req.body, req.file, req.user);
  res.status(201).json(mantenimiento);
};

exports.getRepuestosEstructurados = async (req, res) => {
  const items = await mantenimientosService.getRepuestosEstructurados(req.params.id, req.empresaId);
  res.json(items);
};

exports.getMantenimientoById = async (req, res) => {
  const mantenimiento = await mantenimientosService.getMantenimiento(req.params.id, req.empresaId);
  res.json(mantenimiento);
};
