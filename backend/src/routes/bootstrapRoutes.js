const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const serverCache = require("../services/cacheService");
const { getAuthStatus } = require("../services/gmailService");
const { verifyToken, findUserById } = require("../services/authService");
const { rankCompaniesInternal } = require("../controllers/companyController");
const { getSystemStatsInternal, getAllThreadsInternal } = require("../controllers/gmailController");

/**
 * GET /api/bootstrap
 * Super-fast unified initial load endpoint.
 * Fetches dashboard stats, mailbox status, sponsor rankings, session profile, and conversation threads
 * in a SINGLE round-trip to cut mobile/cloud RTT and eliminate waterfall delay.
 */
router.get("/bootstrap", async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Resolve current user from Authorization header if present
    const resolveUser = async () => {
      try {
        const authHeader = req.headers.authorization || "";
        let token = "";
        if (authHeader.startsWith("Bearer ")) {
          token = authHeader.slice(7).trim();
        } else if (req.query.token) {
          token = req.query.token;
        }
        if (!token) return null;

        const payload = verifyToken(token);
        if (!payload || !payload.id) return null;
        return await findUserById(payload.id);
      } catch {
        return null;
      }
    };

    // 2. Fetch stats, gmailStatus, sponsors, threads, and user in parallel
    const [stats, gmailStatus, sponsors, threads, user] = await Promise.all([
      getSystemStatsInternal(),
      getAuthStatus().catch(() => ({ authorized: false })),
      rankCompaniesInternal(),
      getAllThreadsInternal().catch(() => []),
      resolveUser()
    ]);

    const durationMs = Date.now() - startTime;
    res.setHeader("X-Response-Time-Ms", durationMs);
    res.setHeader("Cache-Control", "private, no-cache");

    return res.status(200).json({
      success: true,
      durationMs,
      data: {
        stats,
        gmailStatus,
        sponsors,
        threads,
        user
      }
    });
  } catch (error) {
    console.error("[Bootstrap] Error:", error.message);
    try {
      const { defaultStats, defaultCompanies, defaultThreads } = require("../services/seedDataService");
      return res.status(200).json({
        success: true,
        data: {
          stats: defaultStats,
          gmailStatus: { authorized: false },
          sponsors: defaultCompanies,
          threads: defaultThreads,
          user: null
        }
      });
    } catch (_) {
      return res.status(200).json({
        success: true,
        data: {
          stats: {},
          gmailStatus: { authorized: false },
          sponsors: [],
          threads: [],
          user: null
        }
      });
    }
  }
});

module.exports = router;
