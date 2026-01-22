const normalizeText = (value, options = {}) => {
  const opts =
    typeof options === "number" ? { maxLen: options } : (options ?? {});

  if (value === null || typeof value === "undefined") return null;

  const text = value.toString().trim();
  if (!text.length) return null;

  const maxLen = opts.maxLen;
  if (typeof maxLen === "number" && maxLen > 0) {
    return text.slice(0, maxLen);
  }

  return text;
};

module.exports = {
  normalizeText,
};
