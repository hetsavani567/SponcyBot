const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/user");

// In-memory user store for instant access and resilience against cloud database latency
const inMemoryUsers = new Map();

/**
 * Hash password with PBKDF2 (SHA-512) and salt
 */
const hashPassword = (password, salt) => {
  const chosenSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, chosenSalt, 10000, 64, "sha512").toString("hex");
  return { salt: chosenSalt, hash };
};

/**
 * Verify plaintext password against stored salt and hash
 */
const verifyPassword = (password, salt, storedHash) => {
  if (!password || !salt || !storedHash) return false;
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
};

/**
 * Generate standard RFC 7519 HMAC-SHA256 Token
 */
const createToken = (payload) => {
  const secret = process.env.JWT_SECRET || "sponcybot-organizer-secret-key-2026";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 3600); // 7 days expiration
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

/**
 * Verify and decode HMAC-SHA256 Token
 */
const verifyToken = (token) => {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const secret = process.env.JWT_SECRET || "sponcybot-organizer-secret-key-2026";
    const expectedSignature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

// Seed a default organizer account into in-memory store so testing/judges can log in immediately
const defaultPassword = hashPassword("password123");
inMemoryUsers.set("organizer", {
  id: "demo-organizer-id",
  _id: "demo-organizer-id",
  username: "organizer",
  email: "organizer@sponcybot.club",
  passwordHash: defaultPassword.hash,
  salt: defaultPassword.salt,
  name: "Club Sponsorship Lead",
  role: "Partnerships Director",
  createdAt: new Date()
});

inMemoryUsers.set("admin", {
  id: "demo-admin-id",
  _id: "demo-admin-id",
  username: "admin",
  email: "admin@sponcybot.club",
  passwordHash: defaultPassword.hash,
  salt: defaultPassword.salt,
  name: "Hackathon Organizer",
  role: "Lead Organizer",
  createdAt: new Date()
});

/**
 * Register a new user
 */
const registerUser = async ({ username, email, password, name, role }) => {
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name || cleanUsername).trim();
  const cleanRole = String(role || "Sponsorship Organizer").trim();

  // Check in-memory store for conflicts
  for (const memUser of inMemoryUsers.values()) {
    if (memUser.username === cleanUsername) {
      throw new Error("Username is already taken");
    }
    if (memUser.email === cleanEmail) {
      throw new Error("Email is already registered");
    }
  }

  // Check MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    const existing = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });
    if (existing) {
      if (existing.username === cleanUsername) {
        throw new Error("Username is already taken");
      }
      throw new Error("Email is already registered");
    }
  }

  const { salt, hash } = hashPassword(password);

  let createdUser = null;
  if (mongoose.connection.readyState === 1) {
    try {
      createdUser = await User.create({
        username: cleanUsername,
        email: cleanEmail,
        passwordHash: hash,
        salt,
        name: cleanName,
        role: cleanRole
      });
    } catch (dbErr) {
      console.warn("[AuthService] MongoDB user create warning, falling back to memory:", dbErr.message);
    }
  }

  if (!createdUser) {
    createdUser = {
      id: `usr_${Date.now()}`,
      _id: `usr_${Date.now()}`,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      name: cleanName,
      role: cleanRole,
      createdAt: new Date()
    };
  }

  // Always retain in memory for lightning fast retrieval
  inMemoryUsers.set(cleanUsername, createdUser);

  const token = createToken({
    id: createdUser._id || createdUser.id,
    username: cleanUsername,
    email: cleanEmail,
    role: cleanRole
  });

  return {
    user: {
      id: createdUser._id || createdUser.id,
      username: cleanUsername,
      email: cleanEmail,
      name: cleanName,
      role: cleanRole
    },
    token
  };
};

/**
 * Authenticate user by username/email and password
 */
const authenticateUser = async ({ usernameOrEmail, password }) => {
  const identifier = String(usernameOrEmail).trim().toLowerCase();

  let targetUser = null;

  // 1. Check in-memory users first
  for (const memUser of inMemoryUsers.values()) {
    if (memUser.username === identifier || memUser.email === identifier) {
      targetUser = memUser;
      break;
    }
  }

  // 2. Check MongoDB if not found in memory
  if (!targetUser && mongoose.connection.readyState === 1) {
    try {
      targetUser = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }]
      });
    } catch (dbErr) {
      console.warn("[AuthService] MongoDB find user warning:", dbErr.message);
    }
  }

  if (!targetUser) {
    throw new Error("Invalid username/email or password");
  }

  const isValid = verifyPassword(password, targetUser.salt, targetUser.passwordHash);
  if (!isValid) {
    throw new Error("Invalid username/email or password");
  }

  const token = createToken({
    id: targetUser._id || targetUser.id,
    username: targetUser.username,
    email: targetUser.email,
    role: targetUser.role
  });

  return {
    user: {
      id: targetUser._id || targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role
    },
    token
  };
};

/**
 * Find user by ID
 */
const findUserById = async (userId) => {
  if (!userId) return null;

  // Check in-memory
  for (const memUser of inMemoryUsers.values()) {
    if (String(memUser._id || memUser.id) === String(userId)) {
      return {
        id: memUser._id || memUser.id,
        username: memUser.username,
        email: memUser.email,
        name: memUser.name,
        role: memUser.role
      };
    }
  }

  // Check MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findById(userId);
      if (user) {
        return {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    } catch {}
  }

  return null;
};

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  registerUser,
  authenticateUser,
  findUserById
};
