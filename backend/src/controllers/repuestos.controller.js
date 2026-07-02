const repuestosService = require("../services/repuestos.service");
const equivalenciasService = require("../services/repuestos-equivalencias.service");

exports.getRepuestos = async (req, res) => {
  const resultado = await repuestosService.listRepuestos(req.query);
  res.json(resultado);
};

exports.buscarRepuestos = async (req, res) => {
  const resultado = await repuestosService.buscarRepuestos(req.query.q);
  res.json(resultado);
};

exports.getRepuestoById = async (req, res) => {
  const repuesto = await repuestosService.getRepuesto(req.params.id);
  res.json(repuesto);
};

exports.createRepuesto = async (req, res) => {
  const repuesto = await repuestosService.createRepuesto(req.body);
  res.status(201).json(repuesto);
};

exports.updateRepuesto = async (req, res) => {
  const repuesto = await repuestosService.updateRepuesto(req.params.id, req.body);
  res.json(repuesto);
};

exports.getEquivalencias = async (req, res) => {
  const equivalencias = await equivalenciasService.listarEquivalencias(req.params.id);
  res.json(equivalencias);
};

exports.createEquivalencia = async (req, res) => {
  const equivalencia = await equivalenciasService.crearEquivalencia(req.params.id, req.body);
  res.status(201).json(equivalencia);
};

exports.deleteEquivalencia = async (req, res) => {
  await equivalenciasService.eliminarEquivalencia(req.params.id, req.params.equivalenciaId);
  res.status(204).send();
};

exports.getDisponibilidad = async (req, res) => {
  const disponibilidad = await equivalenciasService.consultarDisponibilidad(req.params.id);
  res.json(disponibilidad);
};
