const { analyzeCompany } = require("../services/sponsorIntelligence");

const sponsorStrategy = async (req, res) => {
  try {
    const { companyId } = req.body || {};

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID is required"
      });
    }

    const company = require("./companyController").getCompanyById(companyId);

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    const result = await analyzeCompany(company);

    res.json(result);

  } catch (error) {
    console.error("Sponsor strategy error:", error);

    res.status(500).json({
      message: "Sponsor intelligence generation failed",
      error: error.message
    });
  }
};

module.exports = {
  sponsorStrategy
};