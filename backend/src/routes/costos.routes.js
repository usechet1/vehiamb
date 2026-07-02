const express = require("express");
const router = express.Router();

const costosController = require("../controllers/costos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.use(requirePermission("costs.view"));

router.get("/vehiculos", asyncHandler(costosController.listarVehiculos));
router.get("/vehiculos/:placa", asyncHandler(costosController.kpisVehiculo));
router.get("/vehiculos/:placa/graficas", asyncHandler(costosController.graficasVehiculo));
router.get("/vehiculos/:placa/facturas", asyncHandler(costosController.facturasVehiculo));

module.exports = router;
