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

  const queries = [
    `${name} sponsorship events partnerships`,
    `${name} student education university hackathon sponsorship`,
    `${name} products cloud AI software technology developer`,
    `${name} community grants corporate sponsorship`
  ];

  let allResults = [];

  for (const query of queries) {
    try {
      const response = await client.search(query, {
        searchDepth: "advanced",
        maxResults: 5,
        includeAnswer: true
      });

      if (response.results) {
        allResults.push(...response.results);
      }
    } catch (error) {
      console.error(`Tavily search failed for: ${query}`);
    }
  }

  const seen = new Set();

  const uniqueResults = allResults.filter((result) => {
    const key = result.url
      ? result.url.split("?")[0].replace(/\/$/, "").toLowerCase()
      : result.title?.toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const relevantResults = uniqueResults.filter((result) => {
    const text = `${result.title || ""} ${result.content || ""}`.toLowerCase();

    return (
      text.includes(name.toLowerCase()) ||
      text.includes("sponsor") ||
      text.includes("sponsorship") ||
      text.includes("partnership") ||
      text.includes("education") ||
      text.includes("student") ||
      text.includes("university") ||
      text.includes("hackathon") ||
      text.includes("community") ||
      text.includes("developer") ||
      text.includes("cloud") ||
      text.includes("artificial intelligence") ||
      text.includes("software") ||
      text.includes("technology")
    );
  });

  const selectedResults = relevantResults.slice(0, 10);

  const researchText = selectedResults
    .map((result, index) => {
      return `
Source ${index + 1}
Title: ${result.title || ""}
URL: ${result.url || ""}
Content: ${(result.content || "").slice(0, 1500)}
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
};

module.exports = {
  researchCompany
};