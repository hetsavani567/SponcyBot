const mongoose = require("mongoose");

const REPLY_LABELS = [
  "INTERESTED",
  "DECLINED",
  "NO_REPLY",
  "OTHER",
  "PENDING_CLASSIFICATION"
];

const gmailThreadSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true
    },
    outreachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outreach",
      default: null,
      index: true
    },
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
      default: null,
      index: true
    },
    subject: {
      type: String,
      default: ""
    },
    snippet: {
      type: String,
      default: ""
    },
    messages: [
      {
        messageId: { type: String, required: true },
        from: { type: String, default: "" },
        to: { type: String, default: "" },
        date: { type: Date, default: Date.now },
        snippet: { type: String, default: "" },
        body: { type: String, default: "" },
        isFromSponsor: { type: Boolean, default: false }
      }
    ],
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    suggestedLabel: {
      type: String,
      enum: REPLY_LABELS,
      default: "PENDING_CLASSIFICATION"
    },
    classificationReason: {
      type: String,
      default: ""
    },
    confidence: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"],
      default: "UNVERIFIED"
    },
    confirmedLabel: {
      type: String,
      enum: ["INTERESTED", "DECLINED", "NO_REPLY", "OTHER", null],
      default: null
    },
    confirmedBy: {
      type: String,
      default: null
    },
    confirmedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = {
  GmailThread: mongoose.model("GmailThread", gmailThreadSchema),
  REPLY_LABELS
};
