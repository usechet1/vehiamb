const express = require("express");
const router = express.Router();

const entregasController = require("../controllers/entregas-recibidas.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadEntrega = require("../middlewares/upload-entrega");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");
const withMulterErrorHandling = require("../middlewares/with-multer-error-handling");

async function construirNombreEntrega(req, file) {
  const vehiculo = await vehiculosRepository.findById(req.params.vehiculoId, req.empresaId);
  return [vehiculo?.placa, "ENTREGA", file.fieldname, fechaCorta()];
}

router.get("/catalogo", requirePermission("delivery.view"), asyncHandler(entregasController.getCatalogo));
router.get("/usuarios-disponibles", requirePermission("delivery.view"), asyncHandler(entregasController.getUsuariosDisponibles));
router.get("/vehiculo/:vehiculoId", requirePermission("delivery.view"), asyncHandler(entregasController.getPorVehiculo));
router.get("/:id", requirePermission("delivery.view"), asyncHandler(entregasController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("delivery.create"),
  withMulterErrorHandling(uploadEntrega.any(), "15MB"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreEntrega)),
  asyncHandler(compressImage),
  asyncHandler(entregasController.crear)
);

module.exports = router;
