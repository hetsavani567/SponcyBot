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

const app = express();

// Determine static frontend path: prioritize compiled production React build
const frontendDist = path.join(__dirname, "../../frontend/dist");
const backendPublic = path.join(__dirname, "../public");
const frontendSrc = path.join(__dirname, "../../frontend");

const publicPath = fs.existsSync(path.join(frontendDist, "index.html"))
  ? frontendDist
  : fs.existsSync(path.join(backendPublic, "index.html"))
    ? backendPublic
    : frontendSrc;

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve static assets from primary and fallback public folders
app.use(express.static(publicPath));
if (publicPath !== backendPublic && fs.existsSync(backendPublic)) {
  app.use(express.static(backendPublic));
}

// Root route: serves frontend single-page application
app.get("/", (req, res) => {
  const targetHtml = fs.existsSync(path.join(publicPath, "index.html"))
    ? path.join(publicPath, "index.html")
    : path.join(backendPublic, "index.html");
  res.sendFile(targetHtml);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    message: "SponcyBot Backend is running",
    status: "healthy",
    timestamp: new Date()
  });
});

// API Routes
app.use("/companies", companyRoutes);
app.use("/llm", llmRoutes);
app.use("/outreach", outreachRoutes);
app.use("/team-members", teamMemberRoutes);
app.use("/emails", emailRoutes);
app.use("/gmail", gmailRoutes);

// Database Connection
connectDB();

// 404 handler (returns JSON for API requests, falls back to index.html for SPA routes)
app.use(notFoundHandler(publicPath));

// Centralized JSON Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[SponcyBot] Server running on port ${PORT}`);
    console.log(`[SponcyBot] Serving frontend from: ${publicPath}`);
  });
}

module.exports = app;
