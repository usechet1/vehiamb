const express = require("express");
const router = express.Router();

const notificacionesController = require("../controllers/notificaciones.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/", asyncHandler(notificacionesController.getNotificaciones));
router.patch("/:id/leido", asyncHandler(notificacionesController.marcarLeida));
router.post("/:id/aprobar", requirePermission("maintenance.approve"), asyncHandler(notificacionesController.aprobar));
router.post("/:id/rechazar", requirePermission("maintenance.approve"), asyncHandler(notificacionesController.rechazar));

module.exports = router;
