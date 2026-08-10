const express = require("express");
const router = express.Router();

const seguridadController = require("../controllers/seguridad.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/botiquin/catalogo", requirePermission("seguridad.view"), asyncHandler(seguridadController.getCatalogoBotiquin));

router.get("/extintores", requirePermission("seguridad.view"), asyncHandler(seguridadController.getExtintores));
router.post("/extintores", requirePermission("seguridad.create"), asyncHandler(seguridadController.createExtintor));
router.put("/extintores/:id", requirePermission("seguridad.create"), asyncHandler(seguridadController.updateExtintor));
router.delete("/extintores/:id", requirePermission("seguridad.delete"), asyncHandler(seguridadController.deleteExtintor));

router.get("/botiquin", requirePermission("seguridad.view"), asyncHandler(seguridadController.getInspeccionesBotiquin));
router.get("/botiquin/:id", requirePermission("seguridad.view"), asyncHandler(seguridadController.getInspeccionBotiquin));
router.post("/botiquin", requirePermission("seguridad.create"), asyncHandler(seguridadController.createInspeccionBotiquin));
router.delete("/botiquin/:id", requirePermission("seguridad.delete"), asyncHandler(seguridadController.deleteInspeccionBotiquin));

router.get("/herramientas/catalogo", requirePermission("seguridad.view"), asyncHandler(seguridadController.getCatalogoHerramientas));
router.get("/herramientas", requirePermission("seguridad.view"), asyncHandler(seguridadController.getInspeccionesHerramientas));
router.get("/herramientas/:id", requirePermission("seguridad.view"), asyncHandler(seguridadController.getInspeccionHerramientas));
router.post("/herramientas", requirePermission("seguridad.create"), asyncHandler(seguridadController.createInspeccionHerramientas));
router.delete("/herramientas/:id", requirePermission("seguridad.delete"), asyncHandler(seguridadController.deleteInspeccionHerramientas));

module.exports = router;
