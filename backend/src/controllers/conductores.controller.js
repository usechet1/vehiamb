const conductoresService = require("../services/conductores.service");

exports.getConductores = async (req, res) => {
  const resultado = await conductoresService.listConductores(req.query, req.empresaId);
  res.json(resultado);
};

exports.getCatalogo = async (req, res) => {
  const conductores = await conductoresService.listActivosCatalogo(req.empresaId);
  res.json(conductores);
};

exports.getConductorById = async (req, res) => {
  const conductor = await conductoresService.getConductor(req.params.id, req.empresaId);
  res.json(conductor);
};

exports.createConductor = async (req, res) => {
  const conductor = await conductoresService.createConductor(req.body, req.empresaId);
  res.status(201).json(conductor);
};

exports.updateConductor = async (req, res) => {
  const conductor = await conductoresService.updateConductor(req.params.id, req.body, req.empresaId);
  res.json(conductor);
};
