const logsErroresRepository = require("../repositories/logs-errores.repository");

// Solo se guardan errores 5xx (ver logs_errores en database/init.js): los
// 4xx (permisos denegados, 404, validaciones) no son "algo se rompio de
// verdad" y loguear cada uno seria el mismo crecimiento sin control que se
// evito al no loguear cada request HTTP.
function registrarError(err, req, statusCode) {
  logsErroresRepository
    .registrar({
      empresa_id: req.empresaId || null,
      usuario_id: req.user?.id || null,
      metodo: req.method,
      ruta: req.originalUrl,
      status_code: statusCode,
      mensaje: err.message || "Error interno del servidor",
      stack: err.stack || null,
      ip: req.ip
    })
    .catch((logError) => console.error("No fue posible registrar el log de error:", logError.message));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    registrarError(err, req, statusCode);
  }

  res.status(statusCode).json({
    message: err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
}

module.exports = errorHandler;
