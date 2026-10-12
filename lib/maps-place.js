const { validateUrl } = require("./safe-http");

// Los enlaces compartidos pueden identificar un lugar sin incluir latitud/longitud.
function getMapsPlace(value) {
  try {
    const url = validateUrl(value);
    if (!/^\/maps(?:\/|$)/.test(url.pathname)) return null;
    const sources = [decodeURIComponent(url.pathname), url.searchParams.get("data") || ""];
    for (const source of sources) {
      const match = source.match(/!1s(0x[0-9a-f]{1,16}:(0x[0-9a-f]{1,16}))(?=!|\/|$)/i);
      if (!match) continue;
      const cid = BigInt(match[2]).toString();
      return {
        id: match[1].toLowerCase(),
        embedUrl: `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${cid}`,
      };
    }
  } catch {
    // Una URL o codificación incompleta no proporciona un lugar fiable.
  }
  return null;
}

function extractEmbeddedPlaceCoordinates(html, placeId) {
  const match = html.match(/\binitEmbed\s*\(\s*(\[[\s\S]*?\])\s*\);/);
  if (!match) return null;
  let data;
  try { data = JSON.parse(match[1]); } catch { return null; }

  // Se lee JSON, nunca se ejecuta JavaScript descargado. Sólo se acepta el
  // registro del lugar solicitado, no el centro genérico del mapa ni otros POI.
  const pending = [data];
  while (pending.length) {
    const item = pending.pop();
    if (!Array.isArray(item)) continue;
    if (typeof item[0] === "string" && item[0].toLowerCase() === placeId
        && Array.isArray(item[2]) && item[2].length === 2) {
      const [lat, lng] = item[2];
      if (Number.isFinite(lat) && Number.isFinite(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    for (const child of item) {
      if (Array.isArray(child)) pending.push(child);
    }
  }
  return null;
}

module.exports = { getMapsPlace, extractEmbeddedPlaceCoordinates };
