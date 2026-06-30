const express = require("express");
const router = express.Router();

const documentosController = require("../controllers/documentos.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentos));
router.get("/vehiculo/:vehiculoId", requirePermission("documents.view"), asyncHandler(documentosController.getDocumentosByVehicle));
router.post("/", requirePermission("documents.create"), asyncHandler(documentosController.createDocumento));

module.exports = router;
