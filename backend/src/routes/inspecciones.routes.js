const express = require("express");
const router = express.Router();

const inspeccionesController = require("../controllers/inspecciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadInspeccion = require("../middlewares/upload-inspeccion");
const compressImage = require("../middlewares/compress-image");

router.get("/catalogo", requirePermission("maintenance.view"), asyncHandler(inspeccionesController.getCatalogo));
router.get("/vehiculo/:vehiculoId", requirePermission("maintenance.view"), asyncHandler(inspeccionesController.getPorVehiculo));
router.get("/:id", requirePermission("maintenance.view"), asyncHandler(inspeccionesController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("maintenance.create"),
  uploadInspeccion.any(),
  asyncHandler(compressImage),
  asyncHandler(inspeccionesController.crear)
);

module.exports = router;
