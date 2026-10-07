require("dotenv").config();

const express = require("express");

const cors = require("cors");

const llmRoutes = require("./routes/llmRoutes");

const companyRoutes = require("./routes/companyRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Sponsy Bot Backend is running"
  });
});

app.use("/companies", companyRoutes);

app.use("/llm", llmRoutes);

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});