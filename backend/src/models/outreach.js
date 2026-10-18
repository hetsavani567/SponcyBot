const mongoose = require("mongoose");

const OUTREACH_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "WAITING FOR REPLY",
  "INTERESTED",
  "MEETING",
  "DECLINED",
  "NO REPLY",
  "FOLLOW-UP 1",
  "FOLLOW-UP 2",
  "CLOSED"
];

const outreachSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
    },
    emailId: {
      type: String,
      default: null,
      trim: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeamMember",
      required: true
    },
    status: {
      type: String,
      enum: OUTREACH_STATUSES,
      default: "DRAFT",
      index: true
    },
    followUpCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 2
    },
    nextFollowUpAt: {
      type: Date,
      default: null,
      index: true
    },
    lastContactedAt: {
      type: Date,
      default: null
    },
    lastReplyAt: {
      type: Date,
      default: null
    },
    threadId: {
      type: String,
      default: null,
      trim: true
    },
    closedReason: {
      type: String,
      default: "",
      trim: true
    },
    meetingLink: {
      type: String,
      default: "",
      trim: true
    },
    meetingScheduledAt: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Active statuses (everything except CLOSED and DECLINED)
const ACTIVE_STATUSES = OUTREACH_STATUSES.filter(
  (status) => !["CLOSED", "DECLINED"].includes(status)
);

// Compound index to help efficiently find active outreach for a company
outreachSchema.index({ companyId: 1, status: 1 });

// Unique partial index to ensure no duplicate active outreach per company
outreachSchema.index(
  { companyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ACTIVE_STATUSES }
    }
  }
);

module.exports = {
  Outreach: mongoose.model("Outreach", outreachSchema),
  OUTREACH_STATUSES
};
