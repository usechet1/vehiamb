const express = require("express");
const router = express.Router();

const simitController = require("../controllers/simit.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/flota", requirePermission("simit.view"), asyncHandler(simitController.getEstadoFlota));
router.get("/vehiculo/:vehiculoId/historial", requirePermission("simit.view"), asyncHandler(simitController.getHistorialVehiculo));
router.get("/consultas/:consultaId", requirePermission("simit.view"), asyncHandler(simitController.getConsultaDetalle));
router.post("/vehiculo/:vehiculoId/consultar", requirePermission("simit.view"), asyncHandler(simitController.consultarVehiculo));
router.post("/actualizar-flota", requirePermission("simit.view"), asyncHandler(simitController.actualizarFlota));

module.exports = router;
