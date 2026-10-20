const User = require("../models/user");
const { verifyToken } = require("../services/authService");

/**
 * Middleware: Strictly requires valid Bearer JWT token in Authorization header
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization token required. Please sign in."
    });
  }

  const token = authHeader.split(" ")[1];
  const { valid, payload, error } = verifyToken(token);

  if (!valid || !payload) {
    return res.status(401).json({
      success: false,
      message: `Authentication failed: ${error || "Invalid token"}`
    });
  }

  try {
    const user = await User.findById(payload.sub).select("-passwordHash -salt");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists."
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error authenticating user request",
      error: err.message
    });
  }
};

/**
 * Middleware: Optionally attaches authenticated user if valid token exists
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const { valid, payload } = verifyToken(token);

    if (valid && payload?.sub) {
      try {
        const user = await User.findById(payload.sub).select("-passwordHash -salt");
        if (user) {
          req.user = user;
        }
      } catch {
        // Ignore optional auth lookup failures
      }
    }
  }

  next();
};

module.exports = {
  requireAuth,
  optionalAuth
};
