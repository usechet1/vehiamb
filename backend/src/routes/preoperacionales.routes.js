const express = require("express");
const router = express.Router();

const preoperacionalesController = require("../controllers/preoperacionales.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/catalogo", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getCatalogo));
router.get("/vehiculo/:vehiculoId", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getPorVehiculo));
router.get("/:id", requirePermission("preoperacional.view"), asyncHandler(preoperacionalesController.getDetalle));

router.post(
  "/vehiculo/:vehiculoId",
  requirePermission("preoperacional.create"),
  asyncHandler(preoperacionalesController.crear)
);

module.exports = router;
