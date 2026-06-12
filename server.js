const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(path.join(__dirname, "docs")));

function extractCoordinates(text) {
  if (typeof text !== "string" || !text) return null;

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
    const response = await fetch(parsedUrl.href, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 RecargasVoltio/1.0",
      },
    });

    const finalUrl = response.url || parsedUrl.href;
    const finalUrlCoordinates = extractCoordinates(finalUrl);

    if (finalUrlCoordinates) {
      return res.json({ found: true, coordinates: finalUrlCoordinates, finalUrl });
    }

    const body = await response.text();
    const bodyCoordinates = extractCoordinates(body);

    if (bodyCoordinates) {
      return res.json({ found: true, coordinates: bodyCoordinates, finalUrl });
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