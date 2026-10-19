const fs = require("fs");

/**
 * Ensures any undefined API or data route returns JSON 404 rather than Express HTML.
 * For browser HTML requests, gracefully falls back to index.html for SPA routing.
 */
const notFoundHandler = (publicPath) => (req, res, next) => {
  const isAssetRequest =
    req.path.startsWith("/assets") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".map") ||
    req.path.endsWith(".ico") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".svg");

  const isApiRequest =
    req.path.startsWith("/companies") ||
    req.path.startsWith("/gmail") ||
    req.path.startsWith("/outreach") ||
    req.path.startsWith("/llm") ||
    req.path.startsWith("/emails") ||
    req.path.startsWith("/team-members") ||
    req.path.startsWith("/api") ||
    req.path === "/health" ||
    isAssetRequest ||
    !req.accepts("html");

  if (isApiRequest) {
    return res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }

  // Fallback to index.html for client-side routing
  const htmlPath = path.join(publicPath, "index.html");
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(htmlPath);
  }
  return res.status(404).json({
    success: false,
    error: `Page not found: ${req.originalUrl}`
  });
};

/**
 * Centralized JSON error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error("[ServerError]", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
