const express = require("express");
const path = require("path");
const { LIMITS, OutboundError, validateUrl, withTimeout, createSafeHttpClient } = require("./lib/safe-http");
const { getMapsPlace, extractEmbeddedPlaceCoordinates } = require("./lib/maps-place");

const app = express();
const PORT = process.env.PORT || 3000;
const outbound = createSafeHttpClient();

// Acepta cuerpos JSON pequeños en las peticiones a la API.
app.use(express.json({ limit: "20kb" }));

// Permite consumir la API desde GitHub Pages u otros dominios.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

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

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coordinates.lat));
  url.searchParams.set("lon", String(coordinates.lng));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  try {
    const result = await outbound.getNominatimJson(url.href, { signal });
    return buildAddressPayload(result);
  } catch {
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

app.post("/api/analyze-maps-url", async (req, res) => {
  const mapsUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!mapsUrl) {
    return res.status(400).json({ found: false, message: "La URL de Google Maps es obligatoria" });
  }

  let parsedUrl;

  try {
    parsedUrl = validateUrl(mapsUrl);
  } catch {
    return res.status(400).json({ found: false, message: "Usa un enlace HTTPS de Google Maps permitido, sin credenciales ni puertos especiales" });
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
      return { found: false, finalUrl, message: "No se encontraron coordenadas en la URL analizada" };
    });
    return res.json(result);
  } catch (error) {
    return res.status(error instanceof OutboundError ? error.status : 502).json({
      found: false,
      message: error instanceof OutboundError ? error.message : "No se pudo analizar la URL de Google Maps",
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Aplicación disponible en http://localhost:${PORT}`);
  });
}

module.exports = app;
