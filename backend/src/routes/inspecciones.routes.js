const express = require("express");
const router = express.Router();

const inspeccionesController = require("../controllers/inspecciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadInspeccion = require("../middlewares/upload-inspeccion");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");

router.get("/catalogo", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getCatalogo));
router.get("/vehiculo/:vehiculoId", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getPorVehiculo));
router.get("/:id", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("inspections.create"),
  uploadInspeccion.any(),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(inspeccionesController.crear)
);

module.exports = router;
