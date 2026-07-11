const inspeccionesService = require("../services/inspecciones.service");

exports.getCatalogo = (req, res) => {
  res.json(inspeccionesService.getCatalogo());
};

exports.getPorVehiculo = async (req, res) => {
  const inspecciones = await inspeccionesService.listarPorVehiculo(req.params.vehiculoId);
  res.json(inspecciones);
};

exports.getDetalle = async (req, res) => {
  const detalle = await inspeccionesService.obtenerDetalle(req.params.id);
  res.json(detalle);
};

exports.crear = async (req, res) => {
  const inspeccion = await inspeccionesService.crear(req.params.vehiculoId, req.body, req.files, req.user);
  res.status(201).json(inspeccion);
};
