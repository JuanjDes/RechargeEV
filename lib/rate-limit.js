const { isIP } = require("node:net");
const { sendApiError } = require("./api-http");

const RATE_LIMITS = Object.freeze({ windowMs: 60000, perClient: 20, global: 60 });

function getTrustProxyHops(env = process.env) {
  const value = env.TRUST_PROXY_HOPS ?? (env.RENDER === "true" ? "1" : "0");
  if (!/^[0-5]$/.test(value)) throw new Error("TRUST_PROXY_HOPS debe ser un entero entre 0 y 5");
  return Number(value);
}

function clientKey(address) {
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6 || address.includes("%")) return "unknown";
  // URL normaliza IPv6 y convierte las direcciones IPv4 mapeadas a hexadecimal.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = normalized.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const words = right === undefined ? start
    : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  const values = words.map((word) => Number.parseInt(word, 16));
  if (values.slice(0, 5).every((value) => value === 0) && values[5] === 0xffff) {
    return [values[6] >> 8, values[6] & 255, values[7] >> 8, values[7] & 255].join(".");
  }
  // Las direcciones temporales de la misma red IPv6 comparten cuota.
  return `${values.slice(0, 4).map((value) => value.toString(16)).join(":")}::/64`;
}

function createMapsRateLimit({ windowMs = RATE_LIMITS.windowMs,
  perClient = RATE_LIMITS.perClient, globalLimit = RATE_LIMITS.global, now = Date.now } = {}) {
  for (const value of [windowMs, perClient, globalLimit]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Límite de peticiones no válido");
  }
  const clients = new Map();
  let total = 0;
  let resetAt = 0;

  return (req, res, next) => {
    const time = now();
    if (time >= resetAt) {
      clients.clear();
      total = 0;
      resetAt = time + windowMs;
    }
    const key = clientKey(req.ip || req.socket?.remoteAddress || "");
    const used = clients.get(key) || 0;
    if (used >= perClient || total >= globalLimit) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - time) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return sendApiError(res, 429, "RATE_LIMITED",
        `Demasiadas consultas de ubicación. Espera ${retryAfter} segundos y vuelve a intentarlo.`, { retryAfter });
    }
    // Se cuenta antes de analizar el cuerpo o consultar servicios externos.
    // El tope global también limita el tamaño del Map a globalLimit entradas.
    clients.set(key, used + 1);
    total += 1;
    next();
  };
}

module.exports = { RATE_LIMITS, getTrustProxyHops, clientKey, createMapsRateLimit };
