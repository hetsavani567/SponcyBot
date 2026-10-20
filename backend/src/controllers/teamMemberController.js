const mongoose = require("mongoose");
const TeamMember = require("../models/teamMember");

const createTeamMember = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database is connecting, please retry in a moment" });
    }

    const { name, email, role } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existing = await TeamMember.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({
        message: "Team member with this email already exists",
        teamMember: existing
      });
    }

    const member = await TeamMember.create({
      name: String(name).trim(),
      email: trimmedEmail,
      role: role ? String(role).trim() : "Sponsorship Coordinator"
    });

    res.status(201).json(member);
  } catch (error) {
    console.error("Create team member error:", error);
    res.status(500).json({ message: "Failed to create team member", error: error.message });
  }
};

const getTeamMembers = async (req, res) => {
  try {
    const { defaultTeamMembers } = require("../services/seedDataService");

    if (mongoose.connection.readyState !== 1) {
      return res.json(defaultTeamMembers);
    }

    const members = await TeamMember.find({ active: true }).sort({ name: 1 });
    if (!members || members.length === 0) {
      return res.json(defaultTeamMembers);
    }
    res.json(members);
  } catch (error) {
    console.error("Get team members error:", error);
    try {
      const { defaultTeamMembers } = require("../services/seedDataService");
      res.json(defaultTeamMembers);
    } catch (_) {
      res.status(200).json([]);
    }
  }
};

module.exports = {
  createTeamMember,
  getTeamMembers
};
