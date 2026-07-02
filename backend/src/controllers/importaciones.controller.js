const HttpError = require("../errors/http-error");
const importService = require("../services/import/import.service");

function parsePage(query) {
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    limit: Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || 20))
  };
}

exports.ejecutar = async (req, res) => {
  const periodo = req.body?.periodo ? String(req.body.periodo).trim() : null;

  if (periodo && !/^\d{4}-\d{2}-\d{2}$/.test(periodo)) {
    throw new HttpError(400, "El periodo debe tener formato YYYY-MM-DD");
  }

  const resultado = await importService.ejecutar({ periodo, usuarioId: req.user.id });
  res.status(201).json(resultado);
};

exports.listar = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await importService.listar({ page, limit, estado: req.query.estado, periodo: req.query.periodo });
  res.json(resultado);
};

exports.obtener = async (req, res) => {
  const importacion = await importService.obtener(req.params.id);
  res.json(importacion);
};

exports.obtenerDetalle = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resultado = await importService.obtenerDetalle(req.params.id, { page, limit, accion: req.query.accion });
  res.json(resultado);
};

exports.obtenerIncidencias = async (req, res) => {
  const { page, limit } = parsePage(req.query);
  const resuelta = req.query.resuelta === undefined ? undefined : req.query.resuelta === "true";
  const resultado = await importService.obtenerIncidencias(req.params.id, { page, limit, resuelta });
  res.json(resultado);
};

exports.resolverIncidencia = async (req, res) => {
  const incidencia = await importService.resolverIncidencia(req.params.id, req.user.id);
  res.json(incidencia);
};

exports.status = async (req, res) => {
  const ultima = await importService.estadoUltimaAutomatica();
  res.json({ ultimaImportacionAutomatica: ultima || null });
};
