const express = require("express");

const router = express.Router();

const { sponsorStrategy } = require("../controllers/llmController");

router.post("/sponsor-strategy", sponsorStrategy);

module.exports = router;