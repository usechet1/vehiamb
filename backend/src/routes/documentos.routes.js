const express = require("express");
const multer = require("multer");
const router = express.Router();

const documentosController = require("../controllers/documentos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadDocumento = require("../middlewares/upload-documento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const HttpError = require("../errors/http-error");

// Insumo temporal solo para extraer texto (no es el documento final, ese
// pasa por uploadDocumento y sí se guarda en disco) -- se procesa en
// memoria y se descarta, sin nada que limpiar despues.
const uploadParaExtraccion = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const permitidos = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
    if (!permitidos.has(file.mimetype)) {
      return cb(new Error("Solo se permiten PDF o imágenes PNG, JPG y WEBP"));
    }
    cb(null, true);
  }
});

// uploadParaExtraccion.single(...) usa el callback propio de multer, no una
// promesa -- sus errores (mimetype no permitido, archivo >15MB) no pasan por
// asyncHandler. Sin este envoltorio caerian con status 500 generico en vez
// de un 400 claro para el usuario (mismo motivo que en automation.routes.js).
function withMulterErrorHandling(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (!err) return next();
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido (15MB)"
        : err.message || "Archivo inválido";
      next(new HttpError(400, message));
    });
  };
}

async function construirNombreDocumento(req) {
  const vehiculo = req.body.vehiculo_id
    ? await vehiculosRepository.findById(req.body.vehiculo_id, req.empresaId)
    : null;
  return [vehiculo?.placa, req.body.tipo, req.body.fecha_expedicion || fechaCorta()];
}

router.post(
  "/extraer",
  requirePermission("documents.create"),
  withMulterErrorHandling(uploadParaExtraccion.single("archivo")),
  asyncHandler(documentosController.extraerDatos)
);
router.get("/", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentos));
router.get("/vehiculo/:vehiculoId", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentosByVehicle));
router.post(
  "/",
  requirePermission("documents.create"),
  uploadDocumento.single("archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreDocumento)),
  asyncHandler(compressImage),
  asyncHandler(documentosController.createDocumento)
);
router.put(
  "/:id",
  requirePermission("documents.create"),
  uploadDocumento.single("archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreDocumento)),
  asyncHandler(compressImage),
  asyncHandler(documentosController.updateDocumento)
);
router.delete("/:id", requirePermission("documents.delete"), asyncHandler(documentosController.deleteDocumento));

module.exports = router;
