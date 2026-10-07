const express = require("express");

const router = express.Router();

const {
  addCompany,
  getCompanies,
  research,
  rankCompanies,
  getTopCompanies,
  recommendCompanies,
  getCompany
} = require("../controllers/companyController");

router.post("/", addCompany);

router.get("/", getCompanies);

router.post("/research", research);

router.get("/rank", rankCompanies);

router.get("/top/:limit", getTopCompanies);

router.get("/recommend", recommendCompanies);

router.get("/:id", getCompany);

module.exports = router;