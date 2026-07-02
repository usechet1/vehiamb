const express = require("express");
const router = express.Router();

const notificacionesController = require("../controllers/notificaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

// Rutas literales ("/contador", "/leidas") se declaran antes que las rutas con
// parametro ("/:id") del mismo largo para que Express no las confunda con un id.
router.get("/", asyncHandler(notificacionesController.getNotificaciones));
router.get("/contador", asyncHandler(notificacionesController.getContador));

router.patch("/leidas", asyncHandler(notificacionesController.marcarTodasLeidas));
router.patch("/:id/leido", asyncHandler(notificacionesController.marcarLeida));
router.patch("/:id/archivar", asyncHandler(notificacionesController.archivar));

router.delete("/leidas", asyncHandler(notificacionesController.eliminarLeidas));
router.delete("/:id", asyncHandler(notificacionesController.eliminar));

router.post("/:id/aprobar", requirePermission("maintenance.approve"), asyncHandler(notificacionesController.aprobar));
router.post("/:id/rechazar", requirePermission("maintenance.approve"), asyncHandler(notificacionesController.rechazar));

module.exports = router;
