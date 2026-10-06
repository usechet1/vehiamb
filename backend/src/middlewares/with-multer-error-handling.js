const HttpError = require("../errors/http-error");

// Un middleware de multer (.single/.any/.fields/.array) no es una promesa --
// usa su propio callback de error, asi que sus fallos (archivo demasiado
// grande, mimetype rechazado por el fileFilter) nunca pasan por
// asyncHandler. Sin este envoltorio, Express los deja caer directo al
// errorHandler global como una excepcion sin "statusCode": responden 500
// generico en vez de un 400 claro, y ensucian logs_errores (que solo
// deberia guardar fallas 5xx reales, ver error-handler.js) con lo que en
// realidad es un archivo invalido subido por un usuario -- un caso
// rutinario, no "algo se rompio". Mismo criterio ya usado en
// automation.routes.js y documentos.routes.js (ver "/extraer"), ahora
// reutilizable para el resto de rutas con subida de archivos.
//
// maxSizeLabel es el texto humano del limite configurado en el upload-*.js
// correspondiente (ej. "5MB"), para que el mensaje de "archivo muy grande"
// diga el limite real en vez de uno generico.
function withMulterErrorHandling(uploadMiddleware, maxSizeLabel = "el tamaño máximo permitido") {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      const message = err.code === "LIMIT_FILE_SIZE"
        ? `El archivo supera ${maxSizeLabel}`
        : err.message || "Archivo inválido";
      next(new HttpError(400, message));
    });
  };
}

module.exports = withMulterErrorHandling;
