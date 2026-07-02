const HttpError = require("../errors/http-error");
const configImportService = require("../services/config-import/config-import.service");

exports.ejecutar = async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, "Debes adjuntar el archivo Excel de configuracion");
  }

  const resultado = await configImportService.ejecutar({
    buffer: req.file.buffer,
    nombreArchivo: req.file.originalname,
    usuarioId: req.user.id
  });

  res.status(201).json(resultado);
};

exports.listar = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const resultado = await configImportService.listar({ page, limit });
  res.json(resultado);
};
