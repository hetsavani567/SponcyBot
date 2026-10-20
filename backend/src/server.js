const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = require("./config/db");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

// Import modular REST routes
const companyRoutes = require("./routes/companyRoutes");
const llmRoutes = require("./routes/llmRoutes");
const outreachRoutes = require("./routes/outreachRoutes");
const teamMemberRoutes = require("./routes/teamMemberRoutes");
const emailRoutes = require("./routes/emailRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const authRoutes = require("./routes/authRoutes");
const bootstrapRoutes = require("./routes/bootstrapRoutes");

const app = express();
app.set("etag", "strong");

// In-memory resolved static asset path cache to prevent repeated filesystem traversals
const resolvedAssetPaths = new Map();

// Determine static frontend path: check process.cwd() (cloud hosts/Vercel) and __dirname (local dev)
const candidateDirs = [
  path.join(process.cwd(), "frontend/dist"),
  path.join(process.cwd(), "backend/public"),
  path.join(process.cwd(), "public"),
  path.join(__dirname, "../../frontend/dist"),
  path.join(__dirname, "../public"),
  path.join(__dirname, "public"),
  path.join(__dirname, "../../frontend")
];

const availablePublicDirs = candidateDirs.filter(dir =>
  fs.existsSync(path.join(dir, "index.html"))
);

const primaryPublicDir = availablePublicDirs[0] || path.join(process.cwd(), "backend/public");

// Global Middlewares
app.use(cors());
app.use(express.json());

// Dedicated asset delivery middleware: directly resolves and streams any /assets/* file with guaranteed MIME types
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!req.path.startsWith("/assets/")) return next();

  const assetSubpath = req.path.replace(/^\/assets\//, "");
  const cleanSubpath = path.normalize(assetSubpath).replace(/^(\.\.[\/\\])+/, "");

  const sendWithHeaders = (filePath) => {
    if (cleanSubpath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    } else if (cleanSubpath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
    } else if (cleanSubpath.endsWith(".svg")) {
      res.setHeader("Content-Type", "image/svg+xml");
    } else if (cleanSubpath.endsWith(".json")) {
      res.setHeader("Content-Type", "application/json");
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.sendFile(filePath);
  };

  // Instant cache hit
  if (resolvedAssetPaths.has(cleanSubpath)) {
    return sendWithHeaders(resolvedAssetPaths.get(cleanSubpath));
  }

  for (const baseDir of candidateDirs) {
    const fullPath = path.join(baseDir, "assets", cleanSubpath);
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          resolvedAssetPaths.set(cleanSubpath, fullPath);
          return sendWithHeaders(fullPath);
        }
      } catch (e) {}
    }
  }

  // Also check if file exists directly in baseDir
  for (const baseDir of candidateDirs) {
    const fullPath = path.join(baseDir, cleanSubpath);
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          resolvedAssetPaths.set(cleanSubpath, fullPath);
          return sendWithHeaders(fullPath);
        }
      } catch (e) {}
    }
  }

  next();
});

// Explicit static routes for /assets to guarantee JS/CSS bundles always serve correctly
availablePublicDirs.forEach(dir => {
  const assetsDir = path.join(dir, "assets");
  if (fs.existsSync(assetsDir)) {
    app.use("/assets", express.static(assetsDir));
  }
});

// Serve static assets from all available frontend directories
availablePublicDirs.forEach(dir => {
  app.use(express.static(dir, {
    maxAge: "1d",
    index: false
  }));
});

// Always serve backend/public as fallback static if not already included
const backendPublic = path.join(process.cwd(), "backend/public");
if (!availablePublicDirs.includes(backendPublic) && fs.existsSync(backendPublic)) {
  app.use(express.static(backendPublic, { maxAge: "1d", index: false }));
}

// Helper to resolve SPA index.html across all cloud/local environments
const getIndexPath = () => {
  for (const dir of candidateDirs) {
    const targetHtml = path.join(dir, "index.html");
    if (fs.existsSync(targetHtml)) {
      return targetHtml;
    }
  }
  const fallbackHtml = path.join(process.cwd(), "backend/public/index.html");
  if (fs.existsSync(fallbackHtml)) {
    return fallbackHtml;
  }
  const dirnameFallback = path.join(__dirname, "../public/index.html");
  if (fs.existsSync(dirnameFallback)) {
    return dirnameFallback;
  }
  return null;
};

// Helper to serve index.html with strict cache-busting headers so deployments work without hard refresh
const sendIndexHtml = (res, targetHtml) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return res.sendFile(targetHtml);
};

// Root route: serves frontend single-page application with cache-busting headers
app.get("/", (req, res) => {
  const target = getIndexPath();
  if (target) {
    return sendIndexHtml(res, target);
  }
  res.status(200).send("<!DOCTYPE html><html><body style='background:#020617;color:#fff;font-family:sans-serif;padding:40px'><h1>SponcyBot Engine Active</h1><p>Building production assets...</p></body></html>");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    message: "SponcyBot Backend is running",
    status: "healthy",
    timestamp: new Date()
  });
});

// Proactive serverless DB connection middleware: ensures MongoDB connection is established before route handlers run
app.use(async (req, res, next) => {
  if (req.method !== "OPTIONS" && (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/companies") ||
    req.path.startsWith("/gmail") ||
    req.path.startsWith("/outreach") ||
    req.path.startsWith("/emails") ||
    req.path.startsWith("/team-members") ||
    req.path.startsWith("/bootstrap") ||
    req.path.startsWith("/api")
  )) {
    try {
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 1) {
        await connectDB();
      }
    } catch (_) {}
  }
  next();
});

// API Routes
app.use("/api", bootstrapRoutes);
app.use("/bootstrap", bootstrapRoutes);
app.use("/auth", authRoutes);
app.use("/companies", companyRoutes);
app.use("/llm", llmRoutes);
app.use("/outreach", outreachRoutes);
app.use("/team-members", teamMemberRoutes);
app.use("/emails", emailRoutes);
app.use("/gmail", gmailRoutes);

// Database Connection
connectDB();

// SPA Fallback Middleware: serve index.html for all browser GET navigation requests
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const isApi =
    req.path.startsWith("/auth") ||
    req.path.startsWith("/companies") ||
    req.path.startsWith("/gmail") ||
    req.path.startsWith("/outreach") ||
    req.path.startsWith("/llm") ||
    req.path.startsWith("/emails") ||
    req.path.startsWith("/team-members") ||
    req.path.startsWith("/bootstrap") ||
    req.path.startsWith("/api") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/assets");

  if (isApi || !req.accepts("html")) {
    return next();
  }

  const target = getIndexPath();
  if (target) {
    return sendIndexHtml(res, target);
  }
  next();
});

// 404 handler (returns JSON for API requests, falls back to index.html for SPA routes)
app.use(notFoundHandler(primaryPublicDir));

// Centralized JSON Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[SponcyBot] Server running on port ${PORT}`);
    console.log(`[SponcyBot] Serving frontend from: ${primaryPublicDir}`);
  });
}

module.exports = app;
