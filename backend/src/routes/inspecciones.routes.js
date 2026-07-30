const express = require("express");
const router = express.Router();

const inspeccionesController = require("../controllers/inspecciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadInspeccion = require("../middlewares/upload-inspeccion");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");

async function construirNombreInspeccion(req, file) {
  const vehiculo = await vehiculosRepository.findById(req.params.vehiculoId, req.empresaId);
  return [vehiculo?.placa, "INSPECCION", file.fieldname, fechaCorta()];
}

router.get("/catalogo", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getCatalogo));
router.get("/vehiculo/:vehiculoId", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getPorVehiculo));
router.get("/:id", requirePermission("inspections.view"), asyncHandler(inspeccionesController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("inspections.create"),
  uploadInspeccion.any(),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreInspeccion)),
  asyncHandler(compressImage),
  asyncHandler(inspeccionesController.crear)
);

module.exports = router;
