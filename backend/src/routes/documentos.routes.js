const express = require("express");
const router = express.Router();

const documentosController = require("../controllers/documentos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadDocumento = require("../middlewares/upload-documento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");

router.get("/", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentos));
router.get("/vehiculo/:vehiculoId", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentosByVehicle));
router.post(
  "/",
  requirePermission("documents.create"),
  uploadDocumento.single("archivo"),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(documentosController.createDocumento)
);

module.exports = router;
