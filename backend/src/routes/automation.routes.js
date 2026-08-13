const express = require("express");
const router = express.Router();

const automationController = require("../controllers/automation.controller");
const asyncHandler = require("../middlewares/async-handler");
const HttpError = require("../errors/http-error");
const requireAutomationKey = require("../middlewares/require-automation-key");
const uploadDocumento = require("../middlewares/upload-documento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");

router.use(requireAutomationKey);

// A diferencia de documentos.routes.js (que arma el nombre a partir de un
// vehiculo_id ya conocido), aqui solo llega la placa en el body -- la
// resolucion real del vehiculo (con su 404 si no existe) ocurre en el
// servicio, esto solo es para nombrar el archivo.
function construirNombreAutomation(req) {
  return [req.body.placa, req.body.tipo, req.body.fecha_expedicion || fechaCorta()];
}

// uploadDocumento.single(...) no es una promesa (usa el callback propio de
// multer), asi que sus errores (mimetype no permitido, archivo >5MB) no
// pasan por asyncHandler -- sin este envoltorio caerian con status 500
// generico en vez de 400, y ensuciarian logs_errores con lo que en trafico
// de n8n es un caso rutinario (placa/documento invalido), no una falla real.
function withMulterErrorHandling(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido (5MB)"
        : err.message || "Archivo inválido";
      next(new HttpError(400, message));
    });
  };
}

router.post(
  "/documentos",
  withMulterErrorHandling(uploadDocumento.single("archivo")),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreAutomation)),
  asyncHandler(compressImage),
  asyncHandler(automationController.upsertDocumento)
);

module.exports = router;
