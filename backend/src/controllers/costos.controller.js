const costosService = require("../services/costos.service");

function placaParam(req) {
  return decodeURIComponent(req.params.placa || "").trim().toUpperCase();
}

// El conductorKey ("C12", "N:JUAN PEREZ", "SIN_IDENTIFICAR") ya viene en
// mayusculas desde el frontend (ver costos.repository.js), no se normaliza
// aqui para no romper el prefijo "C"/"N:" que si distingue mayusculas/minusculas.
function conductorKeyParam(req) {
  return decodeURIComponent(req.params.conductorKey || "").trim();
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

exports.listarConductores = async (req, res) => {
  const resultado = await costosService.listarConductores(req.query, req.empresaId);
  res.json(resultado);
};

exports.kpisConductor = async (req, res) => {
  const resultado = await costosService.kpisConductor(conductorKeyParam(req), req.query, req.empresaId);
  res.json(resultado);
};

exports.graficasConductor = async (req, res) => {
  const resultado = await costosService.graficasConductor(conductorKeyParam(req), req.query, req.empresaId);
  res.json(resultado);
};

exports.facturasConductor = async (req, res) => {
  const resultado = await costosService.listarFacturasConductor(conductorKeyParam(req), req.query, req.empresaId);
  res.json(resultado);
};
