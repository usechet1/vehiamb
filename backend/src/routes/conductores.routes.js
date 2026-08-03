const express = require("express");
const router = express.Router();

const conductoresController = require("../controllers/conductores.controller");
const conductorLicenciasController = require("../controllers/conductor-licencias.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadConductor = require("../middlewares/upload-conductor");
const validateUpload = require("../middlewares/validate-upload");
const { renameUpload, fechaCorta } = require("../middlewares/rename-upload");
const conductoresRepository = require("../repositories/conductores.repository");
const conductorLicenciasRepository = require("../repositories/conductor-licencias.repository");

router.get("/", requirePermission("conductores.view"), asyncHandler(conductoresController.getConductores));
router.get("/catalogo", requirePermission("conductores.view"), asyncHandler(conductoresController.getCatalogo));
router.get("/:id", requirePermission("conductores.view"), asyncHandler(conductoresController.getConductorById));
router.post("/", requirePermission("conductores.manage"), asyncHandler(conductoresController.createConductor));
router.put("/:id", requirePermission("conductores.manage"), asyncHandler(conductoresController.updateConductor));

// Cada conductor puede tener varias licencias (una por categoria), cada una
// con su propio archivo -- ver [[feedback... conductor-licencias]] y
// conductor-licencias.service.js. El nombre del archivo usa la cedula del
// conductor (buscada aqui porque el body de esta ruta no la trae, solo la
// categoria/fecha de la licencia en si).
async function construirNombreLicencia(req) {
  let conductorId = req.params.conductorId;

  if (!conductorId && req.params.id) {
    const licenciaExistente = await conductorLicenciasRepository.findById(req.params.id, req.empresaId);
    conductorId = licenciaExistente?.conductor_id;
  }

  const conductor = conductorId ? await conductoresRepository.findById(conductorId, req.empresaId) : null;
  return [conductor?.cedula, "LICENCIA", req.body.categoria, fechaCorta()];
}

router.get(
  "/:conductorId/licencias",
  requirePermission("conductores.view"),
  asyncHandler(conductorLicenciasController.getLicencias)
);
router.post(
  "/:conductorId/licencias",
  requirePermission("conductores.manage"),
  uploadConductor.single("archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreLicencia)),
  asyncHandler(conductorLicenciasController.createLicencia)
);
router.put(
  "/licencias/:id",
  requirePermission("conductores.manage"),
  uploadConductor.single("archivo"),
  asyncHandler(validateUpload),
  asyncHandler(renameUpload(construirNombreLicencia)),
  asyncHandler(conductorLicenciasController.updateLicencia)
);
router.delete(
  "/licencias/:id",
  requirePermission("conductores.manage"),
  asyncHandler(conductorLicenciasController.deleteLicencia)
);

module.exports = router;
