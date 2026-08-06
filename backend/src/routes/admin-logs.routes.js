const express = require("express");
const router = express.Router();

const adminLogsController = require("../controllers/admin-logs.controller");
const asyncHandler = require("../middlewares/async-handler");
const requirePermission = require("../middlewares/require-permission");

router.use(requirePermission("logs.view"));

router.get("/accesos", asyncHandler(adminLogsController.getAccesos));
router.get("/registro", asyncHandler(adminLogsController.getRegistro));
router.get("/errores", asyncHandler(adminLogsController.getErrores));
router.get("/metricas", asyncHandler(adminLogsController.getMetricas));

module.exports = router;
