const express = require("express");
const router = express.Router();

const usuariosController = require("../controllers/usuarios.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");
const uploadUsuario = require("../middlewares/upload-usuario");
const compressImage = require("../middlewares/compress-image");
const validateUpload = require("../middlewares/validate-upload");

router.use(requirePermission("users.manage"));

router.get("/", asyncHandler(usuariosController.getUsuarios));
router.post(
  "/",
  uploadUsuario.single("foto"),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(usuariosController.createUsuario)
);
router.put(
  "/:id",
  uploadUsuario.single("foto"),
  asyncHandler(validateUpload),
  asyncHandler(compressImage),
  asyncHandler(usuariosController.updateUsuario)
);
router.patch("/:id/activo", asyncHandler(usuariosController.setUsuarioActivo));
router.get("/catalogos/roles", asyncHandler(usuariosController.getRoles));
router.get("/catalogos/permisos", asyncHandler(usuariosController.getPermisos));
router.put("/catalogos/roles/:roleId/permisos", asyncHandler(usuariosController.updateRolePermissions));

module.exports = router;
