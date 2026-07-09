const configImportService = require("../services/config-import/config-import.service");

exports.ejecutar = async (req, res) => {
  const resultado = await configImportService.ejecutar({ usuarioId: req.user.id });
  res.status(201).json(resultado);
};

exports.listar = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const resultado = await configImportService.listar({ page, limit });
  res.json(resultado);
};

exports.status = async (req, res) => {
  const ultima = await configImportService.estadoUltimaAutomatica();
  res.json({ ultimaImportacionAutomatica: ultima || null });
};
