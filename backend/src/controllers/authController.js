const {
  registerUser,
  authenticateUser,
  verifyToken,
  findUserById
} = require("../services/authService");

/**
 * POST /auth/signup
 * Register a new organizer with username and password
 */
const signup = async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body || {};

    if (!username || String(username).trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long"
      });
    }

    if (!email || !String(email).includes("@")) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required"
      });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const result = await registerUser({
      username,
      email,
      password,
      name,
      role
    });

    return res.status(201).json({
      success: true,
      message: `Account created successfully! Welcome, ${result.user.name}.`,
      data: result
    });
  } catch (error) {
    console.error("[AuthController] signup error:", error.message);
    const statusCode = error.message.includes("already") ? 409 : 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * POST /auth/signin (or /auth/login)
 * Authenticate with username/email and password
 */
const signin = async (req, res) => {
  try {
    const { username, email, usernameOrEmail, password } = req.body || {};
    const identifier = usernameOrEmail || username || email;

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({
        success: false,
        message: "Username or email is required"
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required"
      });
    }

    const result = await authenticateUser({
      usernameOrEmail: identifier,
      password
    });

    return res.status(200).json({
      success: true,
      message: `Signed in successfully as ${result.user.name}`,
      data: result
    });
  } catch (error) {
    console.error("[AuthController] signin error:", error.message);
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid credentials"
    });
  }
};

/**
 * GET /auth/me
 * Returns current authenticated user profile
 */
const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    let token = "";

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided"
      });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid token. Please sign in again."
      });
    }

    const user = await findUserById(payload.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error("[AuthController] getMe error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile"
    });
  }
};

/**
 * POST /auth/signout
 */
const signout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Signed out successfully"
  });
};

module.exports = {
  signup,
  signin,
  getMe,
  signout
};
