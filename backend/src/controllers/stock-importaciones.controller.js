const stockImportService = require("../services/stock-import/stock-import.service");

function parsePage(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  };
}

exports.ejecutar = async (req, res) => {
  const resultado = await stockImportService.ejecutar({ usuarioId: req.user.id });
  res.status(201).json(resultado);
};

exports.listar = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await stockImportService.listar({ page, limit, estado: req.query.estado }, req.empresaId);
  res.json(resultado);
};

exports.obtener = async (req, res) => {
  const importacion = await stockImportService.obtener(req.params.id, req.empresaId);
  res.json(importacion);
};

exports.obtenerDetalle = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await stockImportService.obtenerDetalle(req.params.id, { page, limit, accion: req.query.accion }, req.empresaId);
  res.json(resultado);
};

exports.obtenerIncidencias = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resuelta = req.query.resuelta === undefined ? undefined : req.query.resuelta === "true";
  const resultado = await stockImportService.obtenerIncidencias(req.params.id, { page, limit, resuelta }, req.empresaId);
  res.json(resultado);
};

exports.resolverIncidencia = async (req, res) => {
  const incidencia = await stockImportService.resolverIncidencia(req.params.id, req.user.id, req.empresaId);
  res.json(incidencia);
};

exports.status = async (req, res) => {
  const ultima = await stockImportService.estadoUltimaAutomatica(req.empresaId);
  res.json({ ultimaImportacionAutomatica: ultima || null });
};
