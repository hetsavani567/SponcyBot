const mongoose = require("mongoose");

const EMAIL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "REJECTED"];
const EMAIL_TYPES = ["initial", "followup1", "followup2"];
const ASK_TYPES = ["money", "goodies", "infra"];

const emailSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: EMAIL_TYPES,
      default: "initial"
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: EMAIL_STATUSES,
      default: "PENDING_APPROVAL",
      index: true
    },
    version: {
      type: Number,
      default: 1
    },
    askType: {
      type: String,
      enum: ASK_TYPES,
      default: "money"
    },
    customInstructions: {
      type: String,
      default: "",
      trim: true
    },
    isCustomized: {
      type: Boolean,
      default: false
    },
    eventName: {
      type: String,
      default: "HackFest 2026",
      trim: true
    },
    eventDates: {
      type: String,
      default: "November 14–16, 2026",
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = {
  Email: mongoose.model("Email", emailSchema),
  EMAIL_STATUSES,
  EMAIL_TYPES,
  ASK_TYPES
};
