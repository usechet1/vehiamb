const express = require("express");
const router = express.Router();

const asignacionesController = require("../controllers/asignaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/rutas", requirePermission("asignaciones.view"), asyncHandler(asignacionesController.getRutas));
router.get("/vehiculos-bloqueados", requirePermission("asignaciones.view"), asyncHandler(asignacionesController.getVehiculosBloqueados));
router.get("/", requirePermission("asignaciones.view"), asyncHandler(asignacionesController.getPorFecha));
router.post("/", requirePermission("asignaciones.create"), asyncHandler(asignacionesController.crear));
router.put("/:id", requirePermission("asignaciones.create"), asyncHandler(asignacionesController.actualizar));
router.delete("/:id", requirePermission("asignaciones.create"), asyncHandler(asignacionesController.eliminar));

module.exports = router;
