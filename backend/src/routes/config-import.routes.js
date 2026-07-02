const express = require("express");
const router = express.Router();

const configImportController = require("../controllers/config-import.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadConfigImport = require("../middlewares/upload-config-import");

router.get("/vehiculos-repuestos", requirePermission("inventory.view"), asyncHandler(configImportController.listar));

router.post(
  "/vehiculos-repuestos",
  requirePermission("inventory.manage"),
  uploadConfigImport.single("archivo"),
  asyncHandler(configImportController.ejecutar)
);

module.exports = router;
