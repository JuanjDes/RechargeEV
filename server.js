const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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
  const city = address.city || address.town || address.village || address.municipality || "";
  const province = address.province || address.county || address.state || "";

  return {
    road,
    houseNumber,
    postcode: address.postcode || "",
    city,
    province,
    country: address.country || "",
    displayName: nominatimResult?.display_name || "",
  };
}

async function reverseGeocodeCoordinates(coordinates) {
  if (!coordinates) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coordinates.lat));
  url.searchParams.set("lon", String(coordinates.lng));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  try {
    const response = await fetch(url.href, {
      headers: {
        "User-Agent": "RecargasVoltio/1.0 (reverse-geocoding)",
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const result = await response.json();
    return buildAddressPayload(result);
  } catch {
    return null;
  }
}

async function buildMapsAnalysisResponse(coordinates, finalUrl) {
  const address = await reverseGeocodeCoordinates(coordinates);

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
    parsedUrl = new URL(mapsUrl);
  } catch {
    return res.status(400).json({ found: false, message: "La URL no tiene un formato válido" });
  }

  if (parsedUrl.protocol !== "https:") {
    return res.status(400).json({ found: false, message: "La URL debe empezar por https://" });
  }

  try {
    // Sigue redirecciones de URLs cortas para llegar a la URL final de Maps.
    const response = await fetch(parsedUrl.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 RecargasVoltio/1.0",
      },
    });

    const finalUrl = response.url || parsedUrl.href;
    const finalUrlCoordinates = extractCoordinates(finalUrl);

    // Primero intenta extraer coordenadas desde la URL final.
    if (finalUrlCoordinates) {
      return res.json(await buildMapsAnalysisResponse(finalUrlCoordinates, finalUrl));
    }

    // Si la URL no las contiene, busca también dentro del HTML recibido.
    const body = await response.text();
    const bodyCoordinates = extractCoordinates(body);

    if (bodyCoordinates) {
      return res.json(await buildMapsAnalysisResponse(bodyCoordinates, finalUrl));
    }

    return res.json({ found: false, finalUrl, message: "No se encontraron coordenadas en la URL analizada" });
  } catch (error) {
    return res.status(502).json({
      found: false,
      message: "No se pudo analizar la URL de Google Maps",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Aplicación disponible en http://localhost:${PORT}`);
});