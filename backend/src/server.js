
require("dotenv").config();

if (process.env.USE_CUSTOM_DNS === "true") {
  const dns = require("dns");
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {}
}

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

mongoose.set("bufferTimeoutMS", 10000);

const llmRoutes = require("./routes/llmRoutes");
const companyRoutes = require("./routes/companyRoutes");
const outreachRoutes = require("./routes/outreachRoutes");
const teamMemberRoutes = require("./routes/teamMemberRoutes");
const emailRoutes = require("./routes/emailRoutes");
const gmailRoutes = require("./routes/gmailRoutes");

const app = express();
const publicPath = path.join(__dirname, "../public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    message: "Sponsy Bot Backend is running",
    status: "healthy",
    timestamp: new Date()
  });
});

app.use("/companies", companyRoutes);
app.use("/llm", llmRoutes);
app.use("/outreach", outreachRoutes);
app.use("/team-members", teamMemberRoutes);
app.use("/emails", emailRoutes);
app.use("/gmail", gmailRoutes);

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })
    .then(() => console.log("MongoDB connected successfully"))
    .catch((error) =>
      console.warn("MongoDB connection warning:", error.message)
    );
}

// ─── API 404 and SPA Fallback Handler ───────────────────────────────────────
// Ensure any API / data route request that is not found ALWAYS returns JSON, not HTML
app.use((req, res, next) => {
  const isApiRequest =
    req.path.startsWith("/companies") ||
    req.path.startsWith("/gmail") ||
    req.path.startsWith("/outreach") ||
    req.path.startsWith("/llm") ||
    req.path.startsWith("/emails") ||
    req.path.startsWith("/team-members") ||
    req.path.startsWith("/api") ||
    !req.accepts("html");

  if (isApiRequest) {
    return res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }

  // Fallback to index.html for Single Page App navigation
  res.sendFile(path.join(publicPath, "index.html"));
});

// ─── Centralized Error Handler (JSON) ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ServerError]", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || "0.0.0.0";

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;

