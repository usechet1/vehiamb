const express = require("express");
const router = express.Router();

const mantenimientosController = require("../controllers/mantenimientos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadMantenimiento = require("../middlewares/upload-mantenimiento");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload } = require("../middlewares/rename-upload");
const vehiculosRepository = require("../repositories/vehiculos.repository");

async function construirNombreMantenimiento(req) {
  const vehiculo = req.body.vehiculo_id
    ? await vehiculosRepository.findById(req.body.vehiculo_id, req.empresaId)
    : null;
  return [vehiculo?.placa, req.body.tipo, req.body.fecha];
}

router.get("/", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientos));
router.get("/usuarios-disponibles", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getUsuariosDisponibles));
router.get("/vehiculo/:vehiculoId", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientosByVehicle));
router.get("/:id/repuestos", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getRepuestosEstructurados));
router.get("/:id", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientoById));
router.post(
  "/",
  requirePermission("maintenance.create"),
  uploadMantenimiento.single("soporte"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreMantenimiento)),
  asyncHandler(compressImage),
  asyncHandler(mantenimientosController.createMantenimiento)
);

module.exports = router;
