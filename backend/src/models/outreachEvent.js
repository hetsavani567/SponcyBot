const mongoose = require("mongoose");

const outreachEventSchema = new mongoose.Schema(
  {
    outreachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outreach",
      required: true,
      index: true
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeamMember",
      default: null
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "OUTREACH_CREATED",
        "EMAIL_ASSIGNED",
        "EMAIL_APPROVED",
        "EMAIL_REJECTED",
        "EMAIL_SENT",
        "REPLY_RECEIVED",
        "FOLLOWUP_SCHEDULED",
        "FOLLOWUP_SENT",
        "MAX_FOLLOWUPS_REACHED",
        "MEETING_BOOKED",
        "STATUS_CHANGED",
        "CLOSED",
        "NOTE_ADDED"
      ],
      index: true
    },
    fromStatus: {
      type: String,
      default: null
    },
    toStatus: {
      type: String,
      default: null
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

outreachEventSchema.index({ outreachId: 1, createdAt: 1 });

module.exports = mongoose.model("OutreachEvent", outreachEventSchema);
