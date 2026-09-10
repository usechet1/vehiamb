const express = require("express");
const router = express.Router();

const gpsController = require("../controllers/gps.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/flota", requirePermission("gps.view"), asyncHandler(gpsController.getFlota));
router.get("/vehiculo/:vehiculoId/historial", requirePermission("gps.view"), asyncHandler(gpsController.getHistorialVehiculo));
router.get("/vehiculo/:vehiculoId/eventos", requirePermission("gps.view"), asyncHandler(gpsController.getEventosVehiculo));

router.get("/dispositivos", requirePermission("gps.manage"), asyncHandler(gpsController.getDispositivos));
router.post("/dispositivos", requirePermission("gps.manage"), asyncHandler(gpsController.registrarDispositivo));
router.put("/dispositivos/:dispositivoId/vehiculo", requirePermission("gps.manage"), asyncHandler(gpsController.asignarVehiculo));
router.put("/dispositivos/:dispositivoId/estado", requirePermission("gps.manage"), asyncHandler(gpsController.setEstadoDispositivo));

module.exports = router;
