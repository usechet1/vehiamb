const entregasService = require("../services/entregas-recibidas.service");

exports.getCatalogo = (req, res) => {
  res.json(entregasService.getCatalogo());
};

exports.getUsuariosDisponibles = async (req, res) => {
  const usuarios = await entregasService.listUsuariosDisponibles(req.empresaId);
  res.json(usuarios);
};

exports.getPorVehiculo = async (req, res) => {
  const entregas = await entregasService.listarPorVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(entregas);
};

exports.getDetalle = async (req, res) => {
  const detalle = await entregasService.obtenerDetalle(req.params.id, req.empresaId);
  res.json(detalle);
};

exports.crear = async (req, res) => {
  const entrega = await entregasService.crear(req.params.vehiculoId, req.body, req.files, req.user);
  res.status(201).json(entrega);
};
