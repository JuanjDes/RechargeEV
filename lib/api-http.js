const { OutboundError } = require("./safe-http");

const PUBLIC_ORIGINS = ["https://juanjdes.github.io", "https://rechargeev-backend.onrender.com"];
const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000",
  "http://localhost:8080", "http://127.0.0.1:8080"];

function getAllowedOrigins(env = process.env) {
  const defaults = env.NODE_ENV === "production" || env.RENDER === "true"
    ? PUBLIC_ORIGINS : [...PUBLIC_ORIGINS, ...LOCAL_ORIGINS];
  const entries = env.CORS_ALLOWED_ORIGINS === undefined
    ? defaults : env.CORS_ALLOWED_ORIGINS.split(",").map(value => value.trim());
  return new Set(entries.map(value => {
    let url;
    try { url = new URL(value); } catch { /* Se valida abajo. */ }
    if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password
        || url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*")) {
      throw new Error("CORS_ALLOWED_ORIGINS debe contener orígenes HTTP/HTTPS separados por comas, sin rutas ni comodines");
    }
    return url.origin;
  }));
}

function sendApiError(res, status, code, message, extra = {}) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ found: false, code, message, ...extra });
}

function createApiCors(origins = getAllowedOrigins()) {
  return (req, res, next) => {
    res.vary("Origin");
    res.setHeader("Cache-Control", "no-store");
    const origin = req.get("Origin");
    // Sin Origin se permiten clientes directos, siempre sujetos a la cuota.
    if (origin !== undefined && !origins.has(origin)) {
      return sendApiError(res, 403, "ORIGIN_NOT_ALLOWED", "El origen de esta aplicación no está autorizado.");
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Expose-Headers", "Retry-After");
    }
    if (req.method !== "OPTIONS") return next();
    res.vary("Access-Control-Request-Method");
    res.vary("Access-Control-Request-Headers");
    const method = req.get("Access-Control-Request-Method");
    const headers = req.get("Access-Control-Request-Headers");
    if (method && method !== "POST") {
      return sendApiError(res, 405, "METHOD_NOT_ALLOWED", "Sólo se admite POST para analizar ubicaciones.");
    }
    if (headers && headers.split(",").some(value => value.trim().toLowerCase() !== "content-type")) {
      return sendApiError(res, 403, "HEADERS_NOT_ALLOWED", "La petición contiene cabeceras no admitidas.");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  };
}

function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    return sendApiError(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Envía la petición como application/json.");
  }
  next();
}

function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return sendApiError(res, 413, "PAYLOAD_TOO_LARGE", "La petición supera el tamaño permitido de 20 KiB.");
  }
  if (error.type === "entity.parse.failed" || error.type === "request.size.invalid" || error.type === "request.aborted") {
    return sendApiError(res, 400, "INVALID_JSON", "La petición no contiene un JSON válido y completo.");
  }
  if (error.type === "encoding.unsupported" || error.type === "charset.unsupported") {
    return sendApiError(res, 415, "UNSUPPORTED_ENCODING", "Usa JSON UTF-8 sin compresión.");
  }
  if (error instanceof OutboundError) {
    if (error.code === "TIMEOUT") {
      return sendApiError(res, 504, "UPSTREAM_TIMEOUT", "El servicio de ubicación ha tardado demasiado. Vuelve a intentarlo.");
    }
    if (error.code === "INVALID_URL") {
      return sendApiError(res, 400, "INVALID_MAPS_URL", "El enlace de Maps redirige a un destino no permitido.");
    }
    return sendApiError(res, 502, "UPSTREAM_ERROR", "No se pudo consultar el servicio de ubicación. Vuelve a intentarlo.");
  }
  return sendApiError(res, 500, "INTERNAL_ERROR", "No se pudo completar la petición. Vuelve a intentarlo.");
}

module.exports = { getAllowedOrigins, createApiCors, sendApiError, requireJson, apiErrorHandler };
