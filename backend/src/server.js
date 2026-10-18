
require("dotenv").config();

const dns = require("dns");

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

mongoose.set("bufferTimeoutMS", 2000);

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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
