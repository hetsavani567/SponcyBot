const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    passwordHash: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["organizer", "lead", "member", "admin"],
      default: "organizer"
    },
    avatar: {
      type: String,
      default: ""
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * Hash password with salt using secure scrypt
 */
userSchema.statics.hashPassword = function (password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
};

/**
 * Instance method to verify password
 */
userSchema.methods.verifyPassword = function (password) {
  if (!password || !this.passwordHash || !this.salt) return false;
  const hash = crypto.scryptSync(password, this.salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(this.passwordHash, "hex"));
};

/**
 * Safe JSON projection (hides passwordHash and salt)
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("User", userSchema);
