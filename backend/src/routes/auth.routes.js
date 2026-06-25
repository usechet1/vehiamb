const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const asyncHandler = require("../middlewares/async-handler");
const requireAuth = require("../middlewares/require-auth");

router.post("/login", asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.getMe));

module.exports = router;
