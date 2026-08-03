const preoperacionalesService = require("../services/preoperacionales.service");

exports.getCatalogo = (req, res) => {
  res.json(preoperacionalesService.getCatalogo());
};

exports.getPorVehiculo = async (req, res) => {
  const preoperacionales = await preoperacionalesService.listarPorVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(preoperacionales);
};

exports.getDetalle = async (req, res) => {
  const detalle = await preoperacionalesService.obtenerDetalle(req.params.id, req.empresaId);
  res.json(detalle);
};

exports.crear = async (req, res) => {
  const preoperacional = await preoperacionalesService.crear(req.params.vehiculoId, req.body, req.files, req.user);
  res.status(201).json(preoperacional);
};
