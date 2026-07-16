const express = require("express");
const router = express.Router();

const empresasController = require("../controllers/empresas.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadEmpresa = require("../middlewares/upload-empresa");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");

router.get("/", requirePermission("empresas.switch"), asyncHandler(empresasController.getEmpresas));

router.get("/me", requirePermission("empresa.manage"), asyncHandler(empresasController.getMiEmpresa));
router.put(
  "/me",
  requirePermission("empresa.manage"),
  uploadEmpresa.single("logo"),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(empresasController.updateMiEmpresa)
);

module.exports = router;
