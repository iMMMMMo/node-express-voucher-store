const FLASH_KEY = "__flash";

const normalizeBucket = (bucket) => {
  const out = { error: [], success: [], info: [], warning: [] };
  if (!bucket || typeof bucket !== "object") return out;

  for (const [type, value] of Object.entries(bucket)) {
    if (!Object.prototype.hasOwnProperty.call(out, type)) continue;

    if (Array.isArray(value)) {
      out[type] = value.map((v) => (v ?? "").toString()).filter(Boolean);
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const s = (value ?? "").toString();
      if (s) out[type] = [s];
    }
  }

  return out;
};

module.exports = function flashMiddleware(req, res, next) {
  const session = req.session;

  const existing = session ? session[FLASH_KEY] : null;
  if (session && typeof session[FLASH_KEY] !== "undefined") delete session[FLASH_KEY];
  res.locals.flash = normalizeBucket(existing);

  req.flash = (type, message) => {
    if (!req.session) return;
    if (!type) return;

    const t = type.toString();
    if (!Object.prototype.hasOwnProperty.call(res.locals.flash, t)) return;

    const m = (message ?? "").toString();
    if (!m) return;

    if (!req.session[FLASH_KEY]) req.session[FLASH_KEY] = { error: [], success: [], info: [], warning: [] };
    if (!Array.isArray(req.session[FLASH_KEY][t])) req.session[FLASH_KEY][t] = [];
    req.session[FLASH_KEY][t].push(m);
  };

  req.flashRedirect = (url) => {
    if (!req.session || typeof req.session.save !== "function") {
      return res.redirect(url);
    }

    return req.session.save(() => res.redirect(url));
  };

  return next();
};
