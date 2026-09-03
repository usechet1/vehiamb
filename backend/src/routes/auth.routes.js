const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const asyncHandler = require("../middlewares/async-handler");
const requireAuth = require("../middlewares/require-auth");
const { loginLimiterPorIp, loginLimiterPorCuenta, recuperacionLimiter } = require("../middlewares/rate-limit");

router.post("/login", loginLimiterPorIp, loginLimiterPorCuenta, asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.getMe));
router.post("/cambiar-password", requireAuth, asyncHandler(authController.cambiarPassword));
router.post("/olvide-password", recuperacionLimiter, asyncHandler(authController.olvidePassword));
router.post("/reset-password", recuperacionLimiter, asyncHandler(authController.restablecerPassword));

module.exports = router;
