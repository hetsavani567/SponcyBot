require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const llmRoutes = require("./routes/llmRoutes");
const companyRoutes = require("./routes/companyRoutes");
const outreachRoutes = require("./routes/outreachRoutes");
const teamMemberRoutes = require("./routes/teamMemberRoutes");
const emailRoutes = require("./routes/emailRoutes");

const app = express();

// Set CORS_ORIGIN (comma-separated) in .env to lock this down; open by default for local dev
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : true;

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Sponsy Bot Backend is running"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/companies", companyRoutes);
app.use("/llm", llmRoutes);
app.use("/outreach", outreachRoutes);
app.use("/team-members", teamMemberRoutes);
app.use("/emails", emailRoutes);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler (bad JSON bodies, unexpected throws)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status === 400 ? "Invalid request body" : "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
