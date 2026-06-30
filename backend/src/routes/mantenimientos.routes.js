const express = require("express");
const router = express.Router();

const mantenimientosController = require("../controllers/mantenimientos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadMantenimiento = require("../middlewares/upload-mantenimiento");

router.get("/", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientos));
router.get("/vehiculo/:vehiculoId", requirePermission("maintenance.view"), asyncHandler(mantenimientosController.getMantenimientosByVehicle));
router.post("/", requirePermission("maintenance.create"), uploadMantenimiento.single("soporte"), asyncHandler(mantenimientosController.createMantenimiento));

module.exports = router;
