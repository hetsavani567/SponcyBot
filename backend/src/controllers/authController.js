const User = require("../models/user");
const { hashPassword, verifyPassword, generateToken } = require("../services/authService");

/**
 * POST /auth/signup
 * Register a new organizer / member account
 */
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required."
      });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required."
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check for existing account
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists. Please log in."
      });
    }

    // Hash password with cryptographically secure salt
    const { hash, salt } = hashPassword(password);

    const allowedRoles = ["organizer", "lead", "member", "admin"];
    const userRole = allowedRoles.includes(role) ? role : "organizer";

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hash,
      salt,
      role: userRole,
      lastLoginAt: new Date()
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (error) {
    console.error("[AuthController] Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register user.",
      error: error.message
    });
  }
};

/**
 * POST /auth/login
 * Authenticate existing user with email and password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const isMatch = verifyPassword(password, user.passwordHash, user.salt);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (error) {
    console.error("[AuthController] Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed.",
      error: error.message
    });
  }
};

/**
 * GET /auth/me
 * Returns profile for the currently authenticated user
 */
const getProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated."
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile.",
      error: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  getProfile
};
