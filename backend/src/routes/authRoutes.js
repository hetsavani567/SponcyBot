const express = require("express");
const router = express.Router();

const {
  signup,
  signin,
  getMe,
  signout
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/signin", signin);
router.post("/login", signin);
router.get("/me", getMe);
router.post("/signout", signout);
router.post("/logout", signout);

module.exports = router;
