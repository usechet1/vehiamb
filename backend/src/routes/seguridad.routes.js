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

module.exports = router;
