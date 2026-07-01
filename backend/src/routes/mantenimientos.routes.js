const express = require("express");
const router = express.Router();

const mantenimientosController = require("../controllers/mantenimientos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadMantenimiento = require("../middlewares/upload-mantenimiento");
const compressImage = require("../middlewares/compress-image");

router.get("/", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientos));
router.get("/vehiculo/:vehiculoId", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientosByVehicle));
router.post(
  "/",
  requirePermission("maintenance.create"),
  uploadMantenimiento.single("soporte"),
  asyncHandler(compressImage),
  asyncHandler(mantenimientosController.createMantenimiento)
);

module.exports = router;
