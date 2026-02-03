function wantsJson(req) {
  const accept = req.headers?.accept || "";
  if (req.xhr) return true;
  if (req.originalUrl && req.originalUrl.startsWith("/api/")) return true;
  if (accept.includes("application/json")) return true;

  const accepted = req.accepts ? req.accepts(["html", "json"]) : null;
  return accepted === "json";
}

module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = Number.isInteger(err?.status) ? err.status : 500;
  const expose = typeof err?.expose === "boolean" ? err.expose : status < 500;
  const message = expose ? err?.message || "Error" : "Internal Server Error";

  // error logging
  console.error("[errorHandler]", {
    method: req.method,
    url: req.originalUrl,
    status,
    message: err?.message,
    stack: err?.stack,
  });

  if (wantsJson(req)) {
    return res.status(status).json({
      ok: false,
      error: { message },
      message,
    });
  }

  // HTML fallback
  const canRender = typeof res.render === "function";
  if (canRender) {
    return res.status(status).render("error", {
      title: status >= 500 ? "Something went wrong" : "Request error",
      status,
      message,
    });
  }

  return res.status(status).send(message);
};
