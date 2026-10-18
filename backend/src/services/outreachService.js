const mongoose = require("mongoose");
const { Outreach, OUTREACH_STATUSES } = require("../models/outreach");
const OutreachEvent = require("../models/outreachEvent");
const Company = require("../models/company");

const recordEvent = async ({
  outreachId,
  companyId,
  memberId,
  eventType,
  fromStatus,
  toStatus,
  description,
  metadata = {}
}) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    return await OutreachEvent.create({
      outreachId,
      companyId,
      memberId,
      eventType,
      fromStatus,
      toStatus,
      description,
      metadata
    });
  } catch (error) {
    console.error("Failed to record outreach event:", error.message);
    return null;
  }
};

const calculateNextFollowUpDate = (days = 3) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const processFollowUp = async (outreach, { emailId = null, notes = "" } = {}) => {
  const currentCount = outreach.followUpCount || 0;

  // RULE: Maximum 2 follow-ups allowed. Third attempt is strictly blocked and auto-closed.
  if (currentCount >= 2) {
    const fromStatus = outreach.status;
    outreach.status = "CLOSED";
    outreach.closedReason = "MAX_FOLLOWUPS_REACHED: Stopped outreach after 2 follow-ups to prevent spamming";
    outreach.nextFollowUpAt = null;
    await outreach.save();

    await recordEvent({
      outreachId: outreach._id,
      companyId: outreach.companyId,
      memberId: outreach.memberId,
      eventType: "MAX_FOLLOWUPS_REACHED",
      fromStatus,
      toStatus: "CLOSED",
      description: "Third follow-up attempt blocked. Outreach closed after maximum 2 follow-ups.",
      metadata: { followUpCount: currentCount, reason: outreach.closedReason }
    });

    const error = new Error("Maximum follow-ups (2) reached. Outreach has been closed to prevent spamming sponsors.");
    error.statusCode = 400;
    error.outreach = outreach;
    throw error;
  }

  const nextCount = currentCount + 1;
  const newStatus = nextCount === 1 ? "FOLLOW-UP 1" : "FOLLOW-UP 2";
  const fromStatus = outreach.status;

  outreach.followUpCount = nextCount;
  outreach.status = newStatus;
  outreach.lastContactedAt = new Date();
  if (emailId) {
    outreach.emailId = emailId;
  }

  // If this was follow-up 1, schedule follow-up 2. If it's follow-up 2, no more follow-ups are allowed.
  if (nextCount < 2) {
    outreach.nextFollowUpAt = calculateNextFollowUpDate(3);
  } else {
    outreach.nextFollowUpAt = null;
  }

  await outreach.save();

  await recordEvent({
    outreachId: outreach._id,
    companyId: outreach.companyId,
    memberId: outreach.memberId,
    eventType: "FOLLOWUP_SENT",
    fromStatus,
    toStatus: newStatus,
    description: `Follow-up ${nextCount} registered successfully.${nextCount === 2 ? ' Final follow-up limit reached.' : ''}`,
    metadata: {
      followUpCount: nextCount,
      emailId,
      nextFollowUpAt: outreach.nextFollowUpAt,
      notes
    }
  });

  return outreach;
};

const closeOutreach = async (outreach, reason = "Closed by organizer") => {
  const fromStatus = outreach.status;
  outreach.status = "CLOSED";
  outreach.closedReason = reason;
  outreach.nextFollowUpAt = null;
  await outreach.save();

  await recordEvent({
    outreachId: outreach._id,
    companyId: outreach.companyId,
    memberId: outreach.memberId,
    eventType: "CLOSED",
    fromStatus,
    toStatus: "CLOSED",
    description: `Outreach closed. Reason: ${reason}`,
    metadata: { reason }
  });

  return outreach;
};

const updateOutreachStatus = async (outreach, newStatus, { reason = "", meetingLink = "", meetingScheduledAt = null, threadId = null, metadata = {} } = {}) => {
  if (!OUTREACH_STATUSES.includes(newStatus)) {
    const error = new Error(`Invalid status: ${newStatus}. Allowed: ${OUTREACH_STATUSES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const fromStatus = outreach.status;
  outreach.status = newStatus;

  if (threadId) {
    outreach.threadId = threadId;
  }

  // Handle specific status side-effects
  if (newStatus === "SENT") {
    outreach.lastContactedAt = new Date();
    // Schedule follow-up 1 in 3 days if not already followed up
    if (outreach.followUpCount === 0) {
      outreach.nextFollowUpAt = calculateNextFollowUpDate(3);
    }
  } else if (newStatus === "INTERESTED") {
    outreach.lastReplyAt = new Date();
    outreach.nextFollowUpAt = null; // Don't send automated follow-up when sponsor is interested
  } else if (newStatus === "MEETING") {
    outreach.lastReplyAt = new Date();
    outreach.nextFollowUpAt = null;
    if (meetingLink) outreach.meetingLink = meetingLink;
    if (meetingScheduledAt) outreach.meetingScheduledAt = new Date(meetingScheduledAt);
  } else if (newStatus === "DECLINED") {
    outreach.lastReplyAt = new Date();
    outreach.nextFollowUpAt = null;
    outreach.closedReason = reason || "Sponsor declined to participate";
  } else if (newStatus === "CLOSED") {
    outreach.nextFollowUpAt = null;
    if (reason) outreach.closedReason = reason;
  }

  await outreach.save();

  let eventType = "STATUS_CHANGED";
  if (newStatus === "EMAIL_SENT" || newStatus === "SENT") eventType = "EMAIL_SENT";
  else if (newStatus === "INTERESTED" || newStatus === "DECLINED") eventType = "REPLY_RECEIVED";
  else if (newStatus === "MEETING") eventType = "MEETING_BOOKED";
  else if (newStatus === "CLOSED") eventType = "CLOSED";

  await recordEvent({
    outreachId: outreach._id,
    companyId: outreach.companyId,
    memberId: outreach.memberId,
    eventType,
    fromStatus,
    toStatus: newStatus,
    description: `Outreach moved from ${fromStatus} to ${newStatus}${reason ? `: ${reason}` : ''}`,
    metadata: {
      ...metadata,
      reason,
      meetingLink,
      meetingScheduledAt
    }
  });

  return outreach;
};

const getStats = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      totalOutreach: 0,
      statusCounts: {},
      pendingFollowUpsDue: 0,
      totalFollowUpsSent: 0,
      repliesReceived: 0,
      responseRatePercent: 0,
      conversionsCount: 0,
      conversionRatePercent: 0
    };
  }

  const allOutreaches = await Outreach.find();
  const total = allOutreaches.length;

  const statusCounts = {};
  OUTREACH_STATUSES.forEach(s => { statusCounts[s] = 0; });

  let totalFollowUpsSent = 0;
  let repliesCount = 0;
  let interestedOrMeetingCount = 0;
  const now = new Date();
  let pendingFollowUpsCount = 0;

  for (const o of allOutreaches) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    totalFollowUpsSent += (o.followUpCount || 0);

    if (["INTERESTED", "MEETING", "DECLINED"].includes(o.status) || o.lastReplyAt) {
      repliesCount++;
    }

    if (["INTERESTED", "MEETING"].includes(o.status)) {
      interestedOrMeetingCount++;
    }

    if (
      o.nextFollowUpAt &&
      new Date(o.nextFollowUpAt) <= now &&
      (o.followUpCount || 0) < 2 &&
      !["CLOSED", "DECLINED", "INTERESTED", "MEETING"].includes(o.status)
    ) {
      pendingFollowUpsCount++;
    }
  }

  const responseRate = total > 0 ? Number(((repliesCount / total) * 100).toFixed(1)) : 0;
  const conversionRate = total > 0 ? Number(((interestedOrMeetingCount / total) * 100).toFixed(1)) : 0;

  return {
    totalOutreach: total,
    statusCounts,
    pendingFollowUpsDue: pendingFollowUpsCount,
    totalFollowUpsSent,
    repliesReceived: repliesCount,
    responseRatePercent: responseRate,
    conversionsCount: interestedOrMeetingCount,
    conversionRatePercent: conversionRate
  };
};

module.exports = {
  recordEvent,
  calculateNextFollowUpDate,
  processFollowUp,
  closeOutreach,
  updateOutreachStatus,
  getStats
};
