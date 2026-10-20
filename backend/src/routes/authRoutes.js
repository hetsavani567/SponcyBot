const express = require("express");
const router = express.Router();
const { signup, login, getProfile } = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

// Public authentication routes
router.post("/signup", signup);
router.post("/login", login);

// Protected routes (requires Bearer token)
router.get("/me", requireAuth, getProfile);

module.exports = router;
