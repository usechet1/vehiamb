const express = require("express");
const router = express.Router();

const vehiculosController = require("../controllers/vehiculos.controller");
const asyncHandler = require("../middlewares/async-handler");

// GET todos los vehículos
router.get("/", asyncHandler(vehiculosController.getVehiculos));

// GET vehículo por id
router.get("/:id", asyncHandler(vehiculosController.getVehiculoById));

// POST crear vehículo
router.post("/", asyncHandler(vehiculosController.createVehiculo));

// DELETE vehículo por id
router.delete("/:id", asyncHandler(vehiculosController.deleteVehiculo));

module.exports = router;
