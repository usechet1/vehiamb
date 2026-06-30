const express = require("express");
const router = express.Router();

const vehiculosController = require("../controllers/vehiculos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// GET todos los vehículos
router.get("/", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getVehiculos));

// GET vehículo por id
router.get("/:id", requirePermission("vehicles.view"), asyncHandler(vehiculosController.getVehiculoById));

// POST crear vehículo
router.post("/", requirePermission("vehicles.create"), asyncHandler(vehiculosController.createVehiculo));

// DELETE vehículo por id
router.delete("/:id", requirePermission("vehicles.delete"), asyncHandler(vehiculosController.deleteVehiculo));

module.exports = router;
