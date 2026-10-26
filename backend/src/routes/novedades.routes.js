const express = require("express");
const router = express.Router();

const novedadesController = require("../controllers/novedades.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadNovedad = require("../middlewares/upload-novedad");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");
const withMulterErrorHandling = require("../middlewares/with-multer-error-handling");
const { MAX_ADJUNTOS_POR_CAMPO } = require("../utils/adjuntos");

router.get("/", requirePermission("novedades.view"), asyncHandler(novedadesController.getNovedades));
router.get("/vehiculo/:vehiculoId", requirePermission("novedades.view"), asyncHandler(novedadesController.getNovedadesByVehicle));
router.get("/:id/comentarios", requirePermission("novedades.view"), asyncHandler(novedadesController.getComentarios));

router.post(
  "/",
  requirePermission("novedades.create"),
  withMulterErrorHandling(uploadNovedad.array("foto", MAX_ADJUNTOS_POR_CAMPO), "15MB"),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(novedadesController.createNovedad)
);

router.delete("/:id", requirePermission("novedades.delete"), asyncHandler(novedadesController.deleteNovedad));

module.exports = router;
