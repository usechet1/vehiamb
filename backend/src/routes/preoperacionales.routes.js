const express = require("express");
const router = express.Router();

const preoperacionalesController = require("../controllers/preoperacionales.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadPreoperacional = require("../middlewares/upload-preoperacional");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");

async function construirNombrePreoperacional(req, file) {
  const vehiculo = await vehiculosRepository.findById(req.params.vehiculoId, req.empresaId);
  return [vehiculo?.placa, "PREOPERACIONAL", file.fieldname, fechaCorta()];
}

router.get("/catalogo", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getCatalogo));
router.get("/vehiculo/:vehiculoId", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getPorVehiculo));
router.get("/:id", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("preoperacional.create"),
  uploadPreoperacional.any(),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombrePreoperacional)),
  asyncHandler(compressImage),
  asyncHandler(preoperacionalesController.crear)
);

module.exports = router;
