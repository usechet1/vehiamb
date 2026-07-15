const simitService = require("../services/simit.service");

exports.getEstadoFlota = async (req, res) => {
  const estado = await simitService.listarEstadoFlota({
    estado_cartera: req.query.estado_cartera,
    placa: req.query.placa
  }, req.empresaId);
  res.json(estado);
};

exports.getHistorialVehiculo = async (req, res) => {
  const historial = await simitService.listarHistorialVehiculo(req.params.vehiculoId, req.empresaId);
  res.json(historial);
};

exports.getConsultaDetalle = async (req, res) => {
  const detalle = await simitService.obtenerConsultaDetalle(req.params.consultaId, req.empresaId);
  res.json(detalle);
};

exports.consultarVehiculo = async (req, res) => {
  const resultado = await simitService.consultarVehiculo(req.params.vehiculoId, req.empresaId, { origen: "manual" });
  res.status(201).json(resultado);
};

exports.actualizarFlota = async (req, res) => {
  const resumen = await simitService.actualizarFlota(req.empresaId);
  res.status(202).json(resumen);
};
