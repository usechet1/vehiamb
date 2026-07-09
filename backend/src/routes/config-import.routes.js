const express = require("express");
const router = express.Router();

const configImportController = require("../controllers/config-import.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// Igual que stock-importaciones.routes.js: la sincronizacion de configuracion
// de vehiculos ya es automatica por cron (config-sync.job.js), asi que solo
// Administrador necesita ver o ejecutar esto manualmente.
router.use(requirePermission("inventory.import"));

router.get("/vehiculos-repuestos/status", asyncHandler(configImportController.status));
router.get("/vehiculos-repuestos", asyncHandler(configImportController.listar));
router.post("/vehiculos-repuestos", asyncHandler(configImportController.ejecutar));

module.exports = router;
