const express = require("express");
const router = express.Router();

const viajesController = require("../controllers/viajes.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.get("/", requirePermission("trips.view"), asyncHandler(viajesController.listarRecientes));
router.post("/", requirePermission("trips.create"), asyncHandler(viajesController.crear));

module.exports = router;
