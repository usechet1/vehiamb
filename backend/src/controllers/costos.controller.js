const costosService = require("../services/costos.service");

function placaParam(req) {
  return decodeURIComponent(req.params.placa || "").trim().toUpperCase();
}

exports.listarVehiculos = async (req, res) => {
  const resultado = await costosService.listarVehiculos(req.query, req.empresaId);
  res.json(resultado);
};

exports.kpisVehiculo = async (req, res) => {
  const resultado = await costosService.kpisVehiculo(placaParam(req), req.query, req.empresaId);
  res.json(resultado);
};

exports.graficasVehiculo = async (req, res) => {
  const resultado = await costosService.graficasVehiculo(placaParam(req), req.query, req.empresaId);
  res.json(resultado);
};

exports.facturasVehiculo = async (req, res) => {
  const resultado = await costosService.listarFacturas(placaParam(req), req.query, req.empresaId);
  res.json(resultado);
};
