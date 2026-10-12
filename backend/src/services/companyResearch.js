const { tavily } = require("@tavily/core");

const client = tavily({
  apiKey: process.env.TAVILY_API_KEY
});

const researchCompany = async (company) => {
  if (company.research) {
    return {
      industry: company.industry,
      research: company.research,
      sources: company.sources || [],
      researchedAt: company.researchedAt,
      score: company.score,
      category: company.category,
      recommendedTier: company.recommendedTier,
      recommendedAsk: company.recommendedAsk
    };
  }

  const name = company.name;

  try {
    console.time("Tavily Research");

    const response = await client.search(
      `${name} sponsorship education hackathon partnerships technology`,
      {
        searchDepth: "basic",
        maxResults: 3,
        includeAnswer: true
      }
    );

    console.timeEnd("Tavily Research");

    const results = response.results || [];

    const seen = new Set();

    const uniqueResults = results.filter((result) => {
      const key = result.url
        ? result.url.split("?")[0].replace(/\/$/, "").toLowerCase()
        : result.title?.toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    const selectedResults = uniqueResults.slice(0, 2);

    const researchText = selectedResults
      .map((result, index) => {
        return `
Source ${index + 1}

Title: ${result.title || ""}

URL: ${result.url || ""}

Content: ${(result.content || "").slice(0, 1000)}
`;
      })
      .join("\n");

    const sources = selectedResults.map((result) => ({
      title: result.title || "",
      url: result.url || "",
      evidence: (result.content || "").slice(0, 500)
    }));

    return {
      industry: "",
      research: researchText,
      sources,
      researchedAt: new Date().toISOString(),
      score: 0,
      category: "",
      recommendedTier: "",
      recommendedAsk: ""
    };

  } catch (error) {
    console.error("Company research failed:", error.message);
    throw new Error(`Company research failed: ${error.message}`);
  }
};

module.exports = {
  researchCompany
};
