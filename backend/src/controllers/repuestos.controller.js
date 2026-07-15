const repuestosService = require("../services/repuestos.service");
const equivalenciasService = require("../services/repuestos-equivalencias.service");

exports.getRepuestos = async (req, res) => {
  const resultado = await repuestosService.listRepuestos(req.query, req.empresaId);
  res.json(resultado);
};

exports.buscarRepuestos = async (req, res) => {
  const resultado = await repuestosService.buscarRepuestos(req.query.q, req.empresaId);
  res.json(resultado);
};

exports.getRepuestoById = async (req, res) => {
  const repuesto = await repuestosService.getRepuesto(req.params.id, req.empresaId);
  res.json(repuesto);
};

exports.createRepuesto = async (req, res) => {
  const repuesto = await repuestosService.createRepuesto(req.body, req.empresaId);
  res.status(201).json(repuesto);
};

exports.updateRepuesto = async (req, res) => {
  const repuesto = await repuestosService.updateRepuesto(req.params.id, req.body, req.empresaId);
  res.json(repuesto);
};

exports.getEquivalencias = async (req, res) => {
  const equivalencias = await equivalenciasService.listarEquivalencias(req.params.id, req.empresaId);
  res.json(equivalencias);
};

exports.createEquivalencia = async (req, res) => {
  const equivalencia = await equivalenciasService.crearEquivalencia(req.params.id, req.body, req.empresaId);
  res.status(201).json(equivalencia);
};

exports.deleteEquivalencia = async (req, res) => {
  await equivalenciasService.eliminarEquivalencia(req.params.id, req.params.equivalenciaId, req.empresaId);
  res.status(204).send();
};

exports.getDisponibilidad = async (req, res) => {
  const disponibilidad = await equivalenciasService.consultarDisponibilidad(req.params.id, req.empresaId);
  res.json(disponibilidad);
};
