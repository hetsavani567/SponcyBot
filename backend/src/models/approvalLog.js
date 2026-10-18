const mongoose = require("mongoose");

const DECISION_TYPES = ["APPROVED", "REJECTED"];

const approvalLogSchema = new mongoose.Schema(
  {
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
      required: true,
      index: true
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true
    },
    decision: {
      type: String,
      enum: DECISION_TYPES,
      required: true
    },
    reviewerName: {
      type: String,
      default: "Human Reviewer",
      trim: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    decidedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = {
  ApprovalLog: mongoose.model("ApprovalLog", approvalLogSchema),
  DECISION_TYPES
};
