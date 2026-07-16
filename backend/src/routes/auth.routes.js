const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const asyncHandler = require("../middlewares/async-handler");
const requireAuth = require("../middlewares/require-auth");
const { loginLimiter } = require("../middlewares/rate-limit");

router.post("/login", loginLimiter, asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.getMe));

module.exports = router;
