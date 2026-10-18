const express = require("express");
const path = require("path");
const { LIMITS, OutboundError, validateUrl, withTimeout, createSafeHttpClient } = require("./lib/safe-http");
const { getMapsPlace, extractEmbeddedPlaceCoordinates } = require("./lib/maps-place");
const { createMapsRateLimit, getTrustProxyHops } = require("./lib/rate-limit");
const { createApiCors, sendApiError, requireJson, apiErrorHandler } = require("./lib/api-http");

const app = express();
const PORT = process.env.PORT || 3000;
const outbound = createSafeHttpClient();

// En local no se confía en cabeceras de proxy; Render usa un salto por defecto.
app.set("trust proxy", getTrustProxyHops());

app.use("/api", createApiCors());

// Sirve el frontend estático ubicado en docs/.
app.use(express.static(path.join(__dirname, "docs")));

function extractCoordinates(text) {
  if (typeof text !== "string" || !text) return null;

  // Patrones habituales de coordenadas en enlaces y páginas de Google Maps.
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /(?:^|[^\d.-])(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})(?:[^\d.]|$)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    const lat = Number.parseFloat(match[1]);
    const lng = Number.parseFloat(match[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

function buildAddressPayload(nominatimResult) {
  const address = nominatimResult?.address || {};
  const road = address.road || address.pedestrian || address.footway || address.path || address.cycleway || "";
  const houseNumber = address.house_number || "";
  const locality =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.village ||
    address.town ||
    address.municipality ||
    address.city ||
    "";
  const city = address.city || address.town || address.village || address.municipality || "";
  const province = address.province || address.county || address.state || "";

  return {
    road,
    houseNumber,
    postcode: address.postcode || "",
    locality,
    suburb: address.suburb || "",
    neighbourhood: address.neighbourhood || "",
    quarter: address.quarter || "",
    cityDistrict: address.city_district || "",
    city,
    province,
    country: address.country || "",
    displayName: nominatimResult?.display_name || "",
    rawAddress: address,
  };
}

async function reverseGeocodeCoordinates(coordinates, signal) {
  if (!coordinates) return null;
  const startedAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coordinates.lat));
  url.searchParams.set("lon", String(coordinates.lng));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  try {
    const result = await outbound.getNominatimJson(url.href, { signal });
    const address = buildAddressPayload(result);
    if (result?.error || ![address.road, address.postcode, address.displayName]
      .some(value => typeof value === "string" && value.trim())) {
      throw new OutboundError("NO_ADDRESS", "No se obtuvo una dirección útil");
    }
    return address;
  } catch (error) {
    // Sólo metadatos de diagnóstico: nunca URLs, coordenadas ni mensajes externos.
    const knownCodes = new Set(["TIMEOUT", "UPSTREAM_STATUS", "NO_ADDRESS", "BLOCKED_ADDRESS",
      "REDIRECT_BLOCKED", "ENCODING", "TOO_LARGE", "TRUNCATED", "ENOTFOUND", "EAI_AGAIN",
      "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH"]);
    console.warn(JSON.stringify({
      event: "reverse_geocode_failed",
      service: "nominatim",
      timestamp: new Date().toISOString(),
      code: knownCodes.has(error?.code) ? error.code : error instanceof SyntaxError ? "INVALID_JSON" : "UNKNOWN",
      upstreamStatus: Number.isInteger(error?.upstreamStatus) ? error.upstreamStatus : null,
      durationMs: Date.now() - startedAt,
    }));
    return null;
  }
}

async function buildMapsAnalysisResponse(coordinates, finalUrl, signal) {
  const address = await reverseGeocodeCoordinates(coordinates, signal);

  return {
    found: true,
    coordinates,
    finalUrl,
    address,
  };
}

app.post("/api/analyze-maps-url", createMapsRateLimit(), requireJson,
  express.json({ limit: "20kb", inflate: false }), async (req, res, next) => {
  const mapsUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!mapsUrl) {
    return sendApiError(res, 400, "MISSING_MAPS_URL", "La URL de Google Maps es obligatoria");
  }

  let parsedUrl;

  try {
    parsedUrl = validateUrl(mapsUrl);
  } catch {
    return sendApiError(res, 400, "INVALID_MAPS_URL", "Usa un enlace HTTPS de Google Maps permitido, sin credenciales ni puertos especiales");
  }

  try {
    const result = await withTimeout(LIMITS.totalMs, async (signal) => {
      const { finalUrl, body } = await outbound.getMapsPage(parsedUrl.href, {
        signal,
        stopAtUrl: (url) => Boolean(extractCoordinates(url) || getMapsPlace(url)),
      });
      let coordinates = extractCoordinates(finalUrl);
      const place = getMapsPlace(finalUrl);
      if (!coordinates && place) {
        const embedded = await outbound.getMapsPage(place.embedUrl, { signal });
        coordinates = extractEmbeddedPlaceCoordinates(embedded.body, place.id);
      } else if (!coordinates) {
        coordinates = extractCoordinates(body);
      }
      if (coordinates) return buildMapsAnalysisResponse(coordinates, finalUrl, signal);
      return { found: false, code: "COORDINATES_NOT_FOUND", finalUrl, message: "No se encontraron coordenadas en la URL analizada" };
    });
    return res.json(result);
  } catch (error) {
    return next(error instanceof OutboundError ? error
      : new OutboundError("UPSTREAM_ERROR", "No se pudo analizar la URL de Google Maps"));
  }
});

app.all("/api/analyze-maps-url", (req, res) => {
  res.setHeader("Allow", "POST, OPTIONS");
  return sendApiError(res, 405, "METHOD_NOT_ALLOWED", "Sólo se admite POST para analizar ubicaciones.");
});
app.use("/api", (req, res) => sendApiError(res, 404, "NOT_FOUND", "El endpoint solicitado no existe."));
app.use(apiErrorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Aplicación disponible en http://localhost:${PORT}`);
  });
}

module.exports = app;
