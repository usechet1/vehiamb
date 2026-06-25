const express = require("express");
const router = express.Router();

const documentosController = require("../controllers/documentos.controller");
const asyncHandler = require("../middlewares/async-handler");

router.get("/", asyncHandler(documentosController.getDocumentos));
router.get("/vehiculo/:vehiculoId", asyncHandler(documentosController.getDocumentosByVehicle));
router.post("/", asyncHandler(documentosController.createDocumento));

module.exports = router;
