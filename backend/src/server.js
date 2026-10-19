require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { connectDB } = require("./config/db");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

// Route imports
const llmRoutes = require("./routes/llmRoutes");
const companyRoutes = require("./routes/companyRoutes");
const outreachRoutes = require("./routes/outreachRoutes");
const teamMemberRoutes = require("./routes/teamMemberRoutes");
const emailRoutes = require("./routes/emailRoutes");
const gmailRoutes = require("./routes/gmailRoutes");

const app = express();

// Determine static frontend path: prefer compiled frontend/dist, fallback to frontend/ or backend/public
const frontendDist = path.join(__dirname, "../../frontend/dist");
const frontendCandidate = path.join(__dirname, "../../frontend");
const publicPath = fs.existsSync(path.join(frontendDist, "index.html"))
  ? frontendDist
  : fs.existsSync(path.join(frontendCandidate, "index.html"))
    ? frontendCandidate
    : path.join(__dirname, "../public");

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

// Root route: serves frontend single-page application
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
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

// Server Startup
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || "0.0.0.0";

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
