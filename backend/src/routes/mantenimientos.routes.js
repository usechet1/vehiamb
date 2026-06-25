const express = require("express");
const router = express.Router();

const mantenimientosController = require("../controllers/mantenimientos.controller");
const asyncHandler = require("../middlewares/async-handler");
const uploadMantenimiento = require("../middlewares/upload-mantenimiento");

router.get("/", asyncHandler(mantenimientosController.getMantenimientos));
router.get("/vehiculo/:vehiculoId", asyncHandler(mantenimientosController.getMantenimientosByVehicle));
router.post("/", uploadMantenimiento.single("soporte"), asyncHandler(mantenimientosController.createMantenimiento));

module.exports = router;
