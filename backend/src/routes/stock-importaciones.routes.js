const express = require("express");
const router = express.Router();

const stockImportacionesController = require("../controllers/stock-importaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// Rutas literales antes que las de parametro para que Express no confunda
// "/status" con un ":id".
router.get("/status", requirePermission("inventory.view"), asyncHandler(stockImportacionesController.status));
router.get("/", requirePermission("inventory.view"), asyncHandler(stockImportacionesController.listar));
router.post("/ejecutar", requirePermission("inventory.manage"), asyncHandler(stockImportacionesController.ejecutar));

router.get("/:id", requirePermission("inventory.view"), asyncHandler(stockImportacionesController.obtener));
router.get("/:id/detalle", requirePermission("inventory.view"), asyncHandler(stockImportacionesController.obtenerDetalle));
router.get("/:id/incidencias", requirePermission("inventory.view"), asyncHandler(stockImportacionesController.obtenerIncidencias));

router.patch(
  "/incidencias/:id/resolver",
  requirePermission("inventory.manage"),
  asyncHandler(stockImportacionesController.resolverIncidencia)
);

module.exports = router;
