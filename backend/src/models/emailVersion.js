const mongoose = require("mongoose");

const emailVersionSchema = new mongoose.Schema(
  {
    emailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Email",
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true
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
    type: {
      type: String,
      enum: ["initial", "followup1", "followup2"],
      default: "initial"
    },
    source: {
      type: String,
      enum: ["ai", "human"],
      default: "ai"
    },
    promptUsed: {
      type: String,
      default: ""
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

// Unique compound index on (emailId, version)
emailVersionSchema.index({ emailId: 1, version: 1 }, { unique: true });

module.exports = {
  EmailVersion: mongoose.model("EmailVersion", emailVersionSchema)
};
