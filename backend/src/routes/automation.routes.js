const express = require("express");
const multer = require("multer");
const router = express.Router();

const automationController = require("../controllers/automation.controller");
const asyncHandler = require("../middlewares/async-handler");
const requireAutomationKey = require("../middlewares/require-automation-key");
const uploadDocumento = require("../middlewares/upload-documento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const withMulterErrorHandling = require("../middlewares/with-multer-error-handling");

router.use(requireAutomationKey);

// A diferencia de documentos.routes.js (que arma el nombre a partir de un
// vehiculo_id ya conocido), aqui solo llega la placa en el body -- la
// resolucion real del vehiculo (con su 404 si no existe) ocurre en el
// servicio, esto solo es para nombrar el archivo.
function construirNombreAutomation(req) {
  return [req.body.placa, req.body.tipo, req.body.fecha_expedicion || fechaCorta()];
}

router.post(
  "/documentos",
  withMulterErrorHandling(uploadDocumento.single("archivo"), "5MB"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreAutomation)),
  asyncHandler(compressImage),
  asyncHandler(automationController.upsertDocumento)
);

// A diferencia de /documentos, estos dos solo extraen texto/campos y no
// guardan nada -- el archivo es insumo temporal, no el documento final, asi
// que se procesa en memoria (memoryStorage) en vez de escribirse a
// uploads/documentos, y no hay nada que limpiar despues.
function uploadEnMemoria(mimetypesPermitidos, mensajeError) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter(req, file, cb) {
      if (!mimetypesPermitidos.has(file.mimetype)) {
        return cb(new Error(mensajeError));
      }
      cb(null, true);
    }
  });
}

const uploadSoatPdf = uploadEnMemoria(new Set(["application/pdf"]), "El SOAT debe adjuntarse como PDF");
const uploadTecnomecanica = uploadEnMemoria(
  new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  "La RTM debe adjuntarse como foto (JPG, PNG o WEBP) o PDF"
);

router.post(
  "/extraer/soat",
  withMulterErrorHandling(uploadSoatPdf.single("archivo"), "15MB"),
  asyncHandler(automationController.extraerSoat)
);

router.post(
  "/extraer/tecnomecanica",
  withMulterErrorHandling(uploadTecnomecanica.single("archivo"), "15MB"),
  asyncHandler(automationController.extraerTecnomecanica)
);

module.exports = router;
