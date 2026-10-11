const dns = require("node:dns/promises");
const https = require("node:https");
const { BlockList, isIP } = require("node:net");

const LIMITS = Object.freeze({
  urlLength: 4096,
  redirects: 5,
  totalMs: 15000,
  nominatimMs: 5000,
  mapsBytes: 2 * 1024 * 1024,
  nominatimBytes: 256 * 1024,
});
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const GOOGLE_HOSTS = new Set(["google.com", "www.google.com", "google.es", "www.google.es"]);
const MAPS_HOSTS = new Set(["maps.google.com", "maps.google.es"]);
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
]) blocked.addSubnet(address, prefix, "ipv6");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");

class OutboundError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function validateUrl(value, service = "maps") {
  const invalid = () => new OutboundError("INVALID_URL", "El enlace no pertenece a un destino permitido", 400);
  if (typeof value !== "string" || value.length > LIMITS.urlLength || /[\s\\]/.test(value)) throw invalid();
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname)) throw invalid();

  const { hostname, pathname } = url;
  const mapsPath = /^\/maps(?:\/|$)/.test(pathname);
  const allowed = service === "nominatim"
    ? hostname === "nominatim.openstreetmap.org" && pathname === "/reverse"
    : (GOOGLE_HOSTS.has(hostname) && mapsPath)
      || (MAPS_HOSTS.has(hostname) && (pathname === "/" || mapsPath))
      || (hostname === "maps.app.goo.gl" && /^\/[A-Za-z0-9_-]+\/?$/.test(pathname))
      || (hostname === "goo.gl" && /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(pathname));
  if (!allowed) throw invalid();
  url.hash = "";
  return url;
}

function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  // Sólo unicast global; excluye también IPv4 mapeada, NAT64, ULA y link-local.
  return family === 6 && !address.includes("%")
    && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function withTimeout(ms, task, parentSignal) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(parentSignal.reason);
  parentSignal?.addEventListener("abort", forwardAbort, { once: true });
  if (parentSignal?.aborted) forwardAbort();
  const timer = setTimeout(() => controller.abort(
    new OutboundError("TIMEOUT", "Se agotó el tiempo para consultar la ubicación", 504)
  ), ms);
  try {
    controller.signal.throwIfAborted();
    return await abortable(task(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", forwardAbort);
  }
}

// Las dependencias se pueden sustituir en las pruebas, nunca desde una petición HTTP.
function createSafeHttpClient({ lookup = dns.lookup, request = https.request } = {}) {
  async function readResponse(url, { signal, maxBytes, accept }) {
    signal.throwIfAborted();
    const addresses = await abortable(lookup(url.hostname, { all: true, verbatim: true }), signal);
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new OutboundError("BLOCKED_ADDRESS", "El destino de red no está permitido");
    }
    const pinned = addresses.find(({ family }) => family === 4) || addresses[0];

    return new Promise((resolve, reject) => {
      const req = request(url, {
        method: "GET",
        agent: false,
        signal,
        family: pinned.family,
        servername: url.hostname,
        rejectUnauthorized: true,
        maxHeaderSize: 16 * 1024,
        // Conserva hostname/SNI para TLS pero evita una segunda resolución DNS.
        lookup: (_hostname, options, callback) => {
          if (signal.aborted) return callback(signal.reason);
          if (options.all) return callback(null, [pinned]);
          callback(null, pinned.address, pinned.family);
        },
        headers: {
          "User-Agent": "RecargasVoltio/1.0 (maps-analysis; reverse-geocoding)",
          Accept: accept,
          "Accept-Encoding": "identity",
        },
      }, (response) => {
        response.on("error", reject);
        response.on("aborted", () => reject(new OutboundError("TRUNCATED", "La respuesta externa quedó incompleta")));
        const status = response.statusCode;
        if (REDIRECTS.has(status)) {
          resolve({ status, location: response.headers.location });
          response.destroy();
          return;
        }
        const fail = (code, message) => {
          reject(new OutboundError(code, message));
          response.destroy();
        };
        if (status < 200 || status >= 300) return fail("UPSTREAM_STATUS", "El servicio externo no devolvió una respuesta válida");
        if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
          return fail("ENCODING", "El servicio externo devolvió una compresión no admitida");
        }
        if (Number(response.headers["content-length"]) > maxBytes) return fail("TOO_LARGE", "La respuesta externa supera el tamaño permitido");
        const chunks = [];
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > maxBytes) return fail("TOO_LARGE", "La respuesta externa supera el tamaño permitido");
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
      });
      req.on("error", (error) => reject(signal.aborted ? signal.reason : error));
      req.end();
    });
  }

  async function getMapsPage(value, { signal, hasCoordinates = () => false } = {}) {
    return withTimeout(LIMITS.totalMs, async (requestSignal) => {
      let url = validateUrl(value);
      const visited = new Set();
      for (let redirects = 0; ; redirects += 1) {
        if (visited.has(url.href)) throw new OutboundError("REDIRECT_LOOP", "El enlace contiene un bucle de redirecciones");
        visited.add(url.href);
        if (hasCoordinates(url.href)) return { finalUrl: url.href, body: "" };
        const result = await readResponse(url, { signal: requestSignal, maxBytes: LIMITS.mapsBytes, accept: "text/html" });
        if (!REDIRECTS.has(result.status)) return { finalUrl: url.href, body: result.body };
        if (redirects >= LIMITS.redirects) throw new OutboundError("REDIRECT_LIMIT", "El enlace tiene demasiadas redirecciones");
        if (!result.location) throw new OutboundError("REDIRECT_LOCATION", "La redirección no contiene un destino");
        // Valida cada salto, incluso los relativos, antes de resolver DNS o conectar.
        url = validateUrl(new URL(result.location, url).href);
      }
    }, signal);
  }

  async function getNominatimJson(value, { signal } = {}) {
    return withTimeout(LIMITS.nominatimMs, async (requestSignal) => {
      const url = validateUrl(value, "nominatim");
      const result = await readResponse(url, { signal: requestSignal, maxBytes: LIMITS.nominatimBytes, accept: "application/json" });
      if (REDIRECTS.has(result.status)) throw new OutboundError("REDIRECT_BLOCKED", "Nominatim no admite redirecciones");
      return JSON.parse(result.body);
    }, signal);
  }

  return { getMapsPage, getNominatimJson };
}

module.exports = { LIMITS, OutboundError, validateUrl, isPublicAddress, withTimeout, createSafeHttpClient };
