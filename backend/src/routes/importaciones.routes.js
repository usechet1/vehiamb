const express = require("express");
const router = express.Router();

const importacionesController = require("../controllers/importaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// Rutas literales antes que las de parametro para que Express no confunda
// "/status" con un ":id".
router.get("/status", requirePermission("imports.view"), asyncHandler(importacionesController.status));
router.get("/", requirePermission("imports.view"), asyncHandler(importacionesController.listar));
router.post("/ejecutar", requirePermission("imports.manage"), asyncHandler(importacionesController.ejecutar));

router.get("/:id", requirePermission("imports.view"), asyncHandler(importacionesController.obtener));
router.get("/:id/detalle", requirePermission("imports.view"), asyncHandler(importacionesController.obtenerDetalle));
router.get("/:id/incidencias", requirePermission("imports.view"), asyncHandler(importacionesController.obtenerIncidencias));

router.patch(
  "/incidencias/:id/resolver",
  requirePermission("imports.manage"),
  asyncHandler(importacionesController.resolverIncidencia)
);

module.exports = router;
