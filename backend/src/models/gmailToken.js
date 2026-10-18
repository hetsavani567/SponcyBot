const mongoose = require("mongoose");

/**
 * Stores the Gmail OAuth tokens for the sender account.
 * Only one record is expected (the account used to send all sponsor emails).
 * We use findOneAndUpdate with upsert to always keep it up to date.
 */
const gmailTokenSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    accessToken: {
      type: String,
      required: true
    },
    refreshToken: {
      type: String,
      required: true
    },
    expiryDate: {
      type: Date,
      default: null
    },
    scope: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("GmailToken", gmailTokenSchema);
