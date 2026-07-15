const express = require("express");
const router = express.Router();

const empresasController = require("../controllers/empresas.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadEmpresa = require("../middlewares/upload-empresa");
const compressImage = require("../middlewares/compress-image");

router.use(requirePermission("empresa.manage"));

router.get("/me", asyncHandler(empresasController.getMiEmpresa));
router.put(
  "/me",
  uploadEmpresa.single("logo"),
  asyncHandler(compressImage),
  asyncHandler(empresasController.updateMiEmpresa)
);

module.exports = router;
