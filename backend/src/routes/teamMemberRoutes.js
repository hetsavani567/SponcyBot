const express = require("express");
const router = express.Router();

const {
  createTeamMember,
  getTeamMembers
} = require("../controllers/teamMemberController");

router.get("/", getTeamMembers);
router.post("/", createTeamMember);

module.exports = router;
