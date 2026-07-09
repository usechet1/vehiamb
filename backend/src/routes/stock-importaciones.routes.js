const express = require("express");
const router = express.Router();

const stockImportacionesController = require("../controllers/stock-importaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// Toda esta ruta -- ver historial y ejecutar sincronizacion manual -- corre
// bajo inventory.import: la sincronizacion de stock ya es automatica por
// cron (stock-import-scheduler.job.js), asi que Operador/Consulta no
// necesitan verla ni ejecutarla, solo Administrador.
router.use(requirePermission("inventory.import"));

// Rutas literales antes que las de parametro para que Express no confunda
// "/status" con un ":id".
router.get("/status", asyncHandler(stockImportacionesController.status));
router.get("/", asyncHandler(stockImportacionesController.listar));
router.post("/ejecutar", asyncHandler(stockImportacionesController.ejecutar));

router.get("/:id", asyncHandler(stockImportacionesController.obtener));
router.get("/:id/detalle", asyncHandler(stockImportacionesController.obtenerDetalle));
router.get("/:id/incidencias", asyncHandler(stockImportacionesController.obtenerIncidencias));

router.patch("/incidencias/:id/resolver", asyncHandler(stockImportacionesController.resolverIncidencia));

module.exports = router;
