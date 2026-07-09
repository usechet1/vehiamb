const express = require("express");
const router = express.Router();

const configImportController = require("../controllers/config-import.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/vehiculos-repuestos/status", requirePermission("inventory.view"), asyncHandler(configImportController.status));
router.get("/vehiculos-repuestos", requirePermission("inventory.view"), asyncHandler(configImportController.listar));

router.post(
  "/vehiculos-repuestos",
  requirePermission("inventory.manage"),
  asyncHandler(configImportController.ejecutar)
);

module.exports = router;
