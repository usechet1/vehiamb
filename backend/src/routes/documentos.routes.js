const express = require("express");
const router = express.Router();

const documentosController = require("../controllers/documentos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadDocumento = require("../middlewares/upload-documento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");

async function construirNombreDocumento(req) {
  const vehiculo = req.body.vehiculo_id
    ? await vehiculosRepository.findById(req.body.vehiculo_id, req.empresaId)
    : null;
  return [vehiculo?.placa, req.body.tipo, req.body.fecha_expedicion || fechaCorta()];
}

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
