const assert = require("assert");
const { hashPassword, verifyPassword, generateToken, verifyToken } = require("../services/authService");
const { signup, login, getProfile } = require("../controllers/authController");

console.log("--- Starting Authentication Backend Tests ---");

// Test 1: Password hashing & verification
console.log("Test 1: Password hashing & timing-safe verification");
const pw = "SuperSecretHackathon2026!";
const { hash, salt } = hashPassword(pw);
assert.ok(hash && hash.length === 128, "Hash should be 64-byte hex string (128 chars)");
assert.ok(salt && salt.length === 32, "Salt should be 16-byte hex string (32 chars)");

assert.strictEqual(verifyPassword(pw, hash, salt), true, "Correct password must verify");
assert.strictEqual(verifyPassword("WrongPassword123", hash, salt), false, "Wrong password must be rejected");
assert.strictEqual(verifyPassword("", hash, salt), false, "Empty password must be rejected");
console.log("  ✓ Password hashing and verification passed");

// Test 2: JWT token generation and verification
console.log("Test 2: JWT token generation and verification");
const mockUser = {
  _id: "660c1f2e9d3b4a5c6e7f8a9b",
  name: "Jane Organizer",
  email: "jane@hackathon.club",
  role: "organizer"
};

const token = generateToken(mockUser);
assert.ok(token && token.split(".").length === 3, "Token must be valid 3-part JWT");

const verifyResult = verifyToken(token);
assert.strictEqual(verifyResult.valid, true, "Valid token must verify");
assert.strictEqual(verifyResult.payload.email, "jane@hackathon.club");
assert.strictEqual(verifyResult.payload.name, "Jane Organizer");
assert.strictEqual(verifyResult.payload.role, "organizer");
console.log("  ✓ Token generation and payload decoding verified");

// Test 3: Token tampering rejection
console.log("Test 3: Token tampering and invalid signature rejection");
const tamperedToken = token.slice(0, -5) + "abcde";
const tamperedResult = verifyToken(tamperedToken);
assert.strictEqual(tamperedResult.valid, false, "Tampered signature must be rejected");
assert.ok(tamperedResult.error.includes("signature"), "Should specify signature error");

const emptyResult = verifyToken("");
assert.strictEqual(emptyResult.valid, false, "Empty token must be rejected");
console.log("  ✓ Tampered and invalid tokens strictly rejected");

// Test 4: Controller Validation Tests (Mock req/res)
console.log("Test 4: Controller Validation Tests");

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

// 4a: Missing name
const req1 = { body: { email: "alex@test.com", password: "password123" } };
const res1 = mockRes();
signup(req1, res1);
assert.strictEqual(res1.statusCode, 400);
assert.ok(res1.body.message.toLowerCase().includes("name is required"));
console.log("  ✓ Signup rejects missing name");

// 4b: Invalid email
const req2 = { body: { name: "Alex", email: "not-an-email", password: "password123" } };
const res2 = mockRes();
signup(req2, res2);
assert.strictEqual(res2.statusCode, 400);
assert.ok(res2.body.message.includes("valid email"));
console.log("  ✓ Signup rejects invalid email format");

// 4c: Short password
const req3 = { body: { name: "Alex", email: "alex@test.com", password: "123" } };
const res3 = mockRes();
signup(req3, res3);
assert.strictEqual(res3.statusCode, 400);
assert.ok(res3.body.message.includes("at least 6 characters"));
console.log("  ✓ Signup rejects passwords under 6 characters");

// 4d: Login missing credentials
const req4 = { body: { email: "alex@test.com" } };
const res4 = mockRes();
login(req4, res4);
assert.strictEqual(res4.statusCode, 400);
console.log("  ✓ Login rejects missing password");

// 4e: Profile unauthenticated check
const req5 = { user: null };
const res5 = mockRes();
getProfile(req5, res5);
assert.strictEqual(res5.statusCode, 401);
console.log("  ✓ Profile rejects unauthenticated access");

console.log("\n🎉 ALL AUTHENTICATION BACKEND TESTS PASSED SUCCESSFULLY!");
