const express = require("express");
const router = express.Router();

const conductoresController = require("../controllers/conductores.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadConductor = require("../middlewares/upload-conductor");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");

function construirNombreConductor(req) {
  return [req.body.cedula, "LICENCIA", fechaCorta()];
}

router.get("/", requirePermission("conductores.view"), asyncHandler(conductoresController.getConductores));
router.get("/:id", requirePermission("conductores.view"), asyncHandler(conductoresController.getConductorById));
router.post(
  "/",
  requirePermission("conductores.manage"),
  uploadConductor.single("licencia_archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreConductor)),
  asyncHandler(conductoresController.createConductor)
);
router.put(
  "/:id",
  requirePermission("conductores.manage"),
  uploadConductor.single("licencia_archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreConductor)),
  asyncHandler(conductoresController.updateConductor)
);

module.exports = router;
