const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "sponcybot_jwt_secret_production_fallback_2026";

/**
 * Base64Url Encode
 */
const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

/**
 * Base64Url Decode
 */
const base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
};

/**
 * Hash password with random salt using Node.js scrypt
 */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
};

/**
 * Verify password against stored hash and salt
 */
const verifyPassword = (password, storedHash, salt) => {
  if (!password || !storedHash || !salt) return false;
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
};

/**
 * Generate a JWT standard token with HMAC-SHA256 signature
 */
const generateToken = (user, expiresInDays = 7) => {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user._id || user.id),
    email: user.email,
    name: user.name,
    role: user.role || "organizer",
    iat: now,
    exp: now + expiresInDays * 24 * 60 * 60
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

/**
 * Verify JWT token and return payload
 */
const verifyToken = (token) => {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token is missing" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Invalid token structure" };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return { valid: false, error: "Invalid token signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token has expired" };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: "Malformed token payload" };
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
};
