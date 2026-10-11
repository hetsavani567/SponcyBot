const express = require("express");

const router = express.Router();

const {
  addCompany,
  getCompanies,
  getCompany,
  research,
  rankCompanies,
  getTopCompanies,
  recommendCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
} = require("../controllers/companyController");

router.post("/", addCompany);

router.get("/", getCompanies);

router.post("/research", research);

router.get("/rank", rankCompanies);

router.get("/top/:limit", getTopCompanies);

router.get("/recommend", recommendCompanies);

router.get("/:id", getCompany);

router.put("/:id", updateCompany);

router.delete("/:id", deleteCompany);

module.exports = router;