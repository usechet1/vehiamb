const asignacionesService = require("../services/asignaciones.service");

exports.getRutas = async (req, res) => {
  const rutas = await asignacionesService.listarRutas(req.empresaId);
  res.json(rutas);
};

exports.getPorFecha = async (req, res) => {
  const asignaciones = await asignacionesService.listarPorFecha(req.query.fecha, req.empresaId);
  res.json(asignaciones);
};

exports.getVehiculosBloqueados = async (req, res) => {
  const vehiculoIds = await asignacionesService.vehiculosBloqueadosEnFecha(req.query.fecha, req.empresaId);
  res.json({ vehiculoIds });
};

exports.getReporteDiario = async (req, res) => {
  const reporte = await asignacionesService.obtenerReporteDiario(req.query.fecha, req.empresaId);
  res.json(reporte);
};

exports.crear = async (req, res) => {
  const asignacion = await asignacionesService.crear(req.body, req.user);
  res.status(201).json(asignacion);
};

exports.actualizar = async (req, res) => {
  const asignacion = await asignacionesService.actualizar(req.params.id, req.body, req.user);
  res.json(asignacion);
};

exports.eliminar = async (req, res) => {
  await asignacionesService.eliminar(req.params.id, req.user);
  res.status(204).end();
};
