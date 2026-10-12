const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getMapsPlace, extractEmbeddedPlaceCoordinates } = require("../lib/maps-place");

const ID = "0xd42299ca0250903:0x2e486396300bd83f";
const DATA = `!4m2!3m1!1s${ID}!18m1!1e1`;
const placeUrl = `https://www.google.com/maps/place/Prueba/data=${DATA}`;
const embed = (data) => `<script>function onEmbedLoad() { initEmbed(${JSON.stringify(data)}); }</script>`;

test("extrae el lugar compartido y convierte su CID sin perder precisión", () => {
  const expected = {
    id: ID,
    embedUrl: "https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s3335025020770179135",
  };
  assert.deepEqual(getMapsPlace(placeUrl), expected);
  assert.deepEqual(getMapsPlace(`https://www.google.es/maps?data=${encodeURIComponent(DATA)}`), expected);
  assert.deepEqual(getMapsPlace(`https://www.google.com/maps/place/Prueba/data=${encodeURIComponent(DATA)}`), expected);
});

test("ignora identificadores malformados, destinos ajenos y parámetros de seguimiento", () => {
  for (const url of [
    "https://maps.app.goo.gl/Example123", "https://www.google.com/maps?q=40,-3",
    placeUrl.replace("www.google.com", "evil.test"),
    placeUrl.replace(ID, "0x1:0x12345678901234567"),
    placeUrl.replace(ID, `${ID}garbage`),
    placeUrl.replace("Prueba", "%invalid"),
    `https://www.google.com/maps?tracking=${encodeURIComponent(DATA)}`,
  ]) assert.equal(getMapsPlace(url), null);
});

test("lee las coordenadas del lugar exacto, sin confundirlas con el centro u otro lugar", () => {
  const html = embed([[[3000, -4.57, 41.34]], [
    [ID, "Calle con comillas \" y acentos", [40.4826811, -3.7078931]],
    ["0x1:0x2", "Otro lugar", [50, 10]],
  ]]);
  assert.deepEqual(extractEmbeddedPlaceCoordinates(html, ID), { lat: 40.4826811, lng: -3.7078931 });
});

test("no acepta un mapa genérico, un lugar distinto, ni coordenadas inválidas", () => {
  for (const data of [
    [[[3000, -4.57, 41.34]]], [["0x1:0x2", "Otro", [40, -3]]],
    [[ID, "Prueba", [91, -3]]], [[ID, "Prueba", [40, -181]]],
    [[ID, "Prueba", ["40", "-3"]]], [[ID, "Prueba", [null, 0]]],
    [[ID, "Prueba", [40, -3, 5]]],
  ]) assert.equal(extractEmbeddedPlaceCoordinates(embed(data), ID), null);
  assert.equal(extractEmbeddedPlaceCoordinates("<html>40.4826811,-3.7078931</html>", ID), null);
});

test("el contenido del mapa se interpreta como JSON y nunca se ejecuta", () => {
  const html = `<script>initEmbed([(()=>{ throw new Error('No ejecutar'); })()]);</script>`;
  assert.equal(extractEmbeddedPlaceCoordinates(html, ID), null);
});
