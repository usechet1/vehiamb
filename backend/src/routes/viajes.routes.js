const express = require("express");
const router = express.Router();

const viajesController = require("../controllers/viajes.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/", requirePermission("trips.view"), asyncHandler(viajesController.listarRecientes));
router.get("/ultimo-control", requirePermission("trips.view"), asyncHandler(viajesController.obtenerUltimoControl));
router.get("/asignacion-hoy", requirePermission("trips.view"), asyncHandler(viajesController.getAsignacionHoy));
router.get("/asignacion-manana", requirePermission("trips.view"), asyncHandler(viajesController.getAsignacionManana));
router.get("/vehiculo/:vehiculoId", requirePermission("trips.view"), asyncHandler(viajesController.getPorVehiculo));
router.get("/recientes-empresa", requirePermission("trips.view"), asyncHandler(viajesController.getRecientesEmpresa));
router.get("/:viajeId/resumen", requirePermission("trips.view"), asyncHandler(viajesController.getResumen));
router.post("/", requirePermission("trips.create"), asyncHandler(viajesController.crear));

module.exports = router;
