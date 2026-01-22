const toNumber = (value) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") return value;
  const asString = typeof value === "string" ? value : value.toString();
  const parsed = Number.parseFloat(asString);
  return Number.isFinite(parsed) ? parsed : null;
};

const decimalToNumber = (d) => {
  if (d === null || typeof d === "undefined") return 0;
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const n = Number.parseFloat(d);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof d?.toString === "function") {
    const n = Number.parseFloat(d.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const parseIntSafe = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

module.exports = {
  toNumber,
  decimalToNumber,
  parseIntSafe,
};
