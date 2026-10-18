const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const safe = require("../lib/safe-http");

const MAPS = "https://www.google.com/maps/place/Madrid";
const SHORT = "https://maps.app.goo.gl/Example123";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse?lat=40&lon=-3&format=jsonv2";

// Simula DNS y el transporte HTTPS; nunca conecta con los destinos del fixture.
function fixture(steps = [], addresses = [{ address: "142.250.184.14", family: 4 }]) {
  const calls = [];
  const lookups = [];
  const responses = [];
  const client = safe.createSafeHttpClient({
    lookup: async (hostname) => {
      lookups.push(hostname);
      return addresses;
    },
    request: (url, options, callback) => {
      assert.equal(options.agent, false);
      assert.equal(options.rejectUnauthorized, true);
      assert.equal(options.servername, url.hostname);
      assert.equal(options.headers["Accept-Encoding"], "identity");
      const step = steps[calls.length] || {};
      const req = new EventEmitter();
      let response;
      const abort = () => {
        req.emit("error", options.signal.reason);
        response?.destroy();
      };
      options.signal.addEventListener("abort", abort, { once: true });
      req.end = () => options.lookup(url.hostname, { all: true }, (error, records) => {
        if (error) return req.emit("error", error);
        calls.push({ url: url.href, records });
        if (step.hangHeaders) return;
        queueMicrotask(() => {
          response = new PassThrough();
          response.statusCode = step.status || 200;
          response.headers = step.headers || {};
          responses.push(response);
          response.once("close", () => options.signal.removeEventListener("abort", abort));
          callback(response);
          if (step.stall) return;
          for (const chunk of step.chunks || [Buffer.from(step.body || "")]) {
            if (response.destroyed) break;
            response.write(chunk);
          }
          if (!response.destroyed) response.end();
        });
      });
      return req;
    },
  });
  return { client, calls, lookups, responses };
}

for (const url of [
  MAPS, SHORT, "https://goo.gl/maps/Example123", "https://maps.google.com/?q=40,-3",
  "https://maps.google.es/", "https://www.google.es/maps?q=40,-3", "https://google.com/maps",
  "https://google.es/maps/", "https://www.google.com:443/maps",
]) test(`acepta formato Maps: ${url}`, () => assert.ok(safe.validateUrl(url)));

for (const url of [
  "https://example.com/maps", "http://www.google.com/maps", "https://www.google.com:8443/maps",
  "https://user:pass@www.google.com/maps", "https://www.google.com.evil.test/maps",
  "https://evilgoogle.com/maps", "https://evil.google.com/maps", "https://www.google.com/url?q=anything",
  "https://www.google.com/maps-evil", "https://goo.gl/anything", "https://maps.app.goo.gl/",
  "https://127.0.0.1/maps", "https://2130706433/maps", "https://[::1]/maps",
  "https://www.google.com./maps", "https://www.google.com/maps/../../url", "https://www.google.com\\@evil.test/maps",
  "https://www.google.com/\nmaps", MAPS + "a".repeat(safe.LIMITS.urlLength),
]) test(`rechaza URL no permitida: ${url.slice(0, 80)}`, async () => {
  const f = fixture();
  await assert.rejects(f.client.getMapsPage(url), { code: "INVALID_URL" });
  assert.equal(f.lookups.length, 0);
  assert.equal(f.calls.length, 0);
});

test("bloquea IP privadas, reservadas, IPv6 y representaciones mapeadas", () => {
  for (const address of ["0.0.0.0", "10.1.2.3", "100.100.100.200", "127.1.2.3", "169.254.169.254",
    "172.16.1.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1",
    "224.0.0.1", "255.255.255.255", "::", "::1", "fc00::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1", "invalid"]) {
    assert.equal(safe.isPublicAddress(address), false, address);
  }
  for (const address of ["8.8.8.8", "142.250.184.14", "2607:f8b0:4005:805::200e", "2001:4860:4860::8888"]) {
    assert.equal(safe.isPublicAddress(address), true, address);
  }
});

test("rechaza DNS vacío o mixto público/privado antes de conectar", async () => {
  for (const addresses of [[], [{ address: "127.0.0.1", family: 4 }],
    [{ address: "8.8.8.8", family: 4 }, { address: "fc00::1", family: 6 }]]) {
    const f = fixture([], addresses);
    await assert.rejects(f.client.getMapsPage(MAPS), { code: "BLOCKED_ADDRESS" });
    assert.equal(f.calls.length, 0);
  }
});

test("la conexión usa la IP pública validada sin una segunda resolución", async () => {
  const f = fixture([{ body: "contenido" }]);
  assert.equal((await f.client.getMapsPage(MAPS)).body, "contenido");
  assert.equal(f.lookups.length, 1);
  assert.deepEqual(f.calls[0].records, [{ address: "142.250.184.14", family: 4 }]);
});

test("vuelve a comprobar DNS en cada salto y bloquea un cambio a IP interna", async () => {
  const addresses = [{ address: "8.8.8.8", family: 4 }];
  const f = fixture([{ status: 302, headers: { get location() {
    addresses[0] = { address: "127.0.0.1", family: 4 };
    return "/maps/otro";
  } } }], addresses);
  await assert.rejects(f.client.getMapsPage(MAPS), { code: "BLOCKED_ADDRESS" });
  assert.equal(f.lookups.length, 2);
  assert.equal(f.calls.length, 1);
});

test("puede fijar una conexión IPv6 pública", async () => {
  const address = { address: "2001:4860:4860::8888", family: 6 };
  const f = fixture([{ body: "ok" }], [address]);
  await f.client.getMapsPage(MAPS);
  assert.deepEqual(f.calls[0].records, [address]);
});

test("sigue redirecciones de Maps, incluidas relativas", async () => {
  const f = fixture([
    { status: 302, headers: { location: MAPS } },
    { status: 307, headers: { location: "/maps/place/Barcelona" } },
    { body: "40.416,-3.703" },
  ]);
  const result = await f.client.getMapsPage(SHORT);
  assert.equal(result.finalUrl, "https://www.google.com/maps/place/Barcelona");
  assert.equal(f.calls.length, 3);
});

test("rechaza una redirección prohibida sin consultar su DNS", async () => {
  for (const destination of ["https://127.0.0.1/", "https://evil.test/", "http://www.google.com/maps",
    "https://www.google.com:444/maps", "https://user@www.google.com/maps", "/url?next=anything"]) {
    const f = fixture([{ status: 302, headers: { location: destination } }]);
    await assert.rejects(f.client.getMapsPage(MAPS), { code: "INVALID_URL" });
    assert.equal(f.lookups.length, 1);
  }
});

test("detecta bucles y limita a cinco saltos", async () => {
  const loop = fixture([{ status: 302, headers: { location: MAPS } }]);
  await assert.rejects(loop.client.getMapsPage(MAPS), { code: "REDIRECT_LOOP" });
  const chain = fixture(Array.from({ length: 6 }, (_, i) => ({ status: 302, headers: { location: `/maps/${i}` } })));
  await assert.rejects(chain.client.getMapsPage(MAPS), { code: "REDIRECT_LIMIT" });
  assert.equal(chain.calls.length, 6);
  const allowed = fixture([...Array.from({ length: 5 }, (_, i) => ({ status: 302, headers: { location: `/maps/${i}` } })), { body: "ok" }]);
  assert.equal((await allowed.client.getMapsPage(MAPS)).body, "ok");
});

test("coordenadas en URL evitan descargar Maps, tras validar el destino", async () => {
  const f = fixture();
  assert.equal((await f.client.getMapsPage(MAPS, { stopAtUrl: () => true })).body, "");
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.client.getMapsPage("https://evil.test/", { stopAtUrl: () => true }), { code: "INVALID_URL" });
  const redirect = fixture([{ status: 302, headers: { location: "https://evil.test/maps/place/!1s0x1:0x2" } }]);
  await assert.rejects(redirect.client.getMapsPage(SHORT, { stopAtUrl: (url) => url.includes("!1s") }), { code: "INVALID_URL" });
  assert.equal(redirect.calls.length, 1);
});

test("corta descargas grandes tanto con Content-Length como sin él", async () => {
  for (const step of [
    { headers: { "content-length": String(safe.LIMITS.mapsBytes + 1) } },
    { headers: { "content-length": "1" }, chunks: [Buffer.alloc(safe.LIMITS.mapsBytes), Buffer.from("x")] },
    { chunks: [Buffer.alloc(safe.LIMITS.mapsBytes + 1)] },
  ]) {
    const f = fixture([step]);
    await assert.rejects(f.client.getMapsPage(MAPS), { code: "TOO_LARGE" });
    assert.equal(f.responses[0].destroyed, true);
  }
});

test("rechaza compresión inesperada y estados HTTP de error", async () => {
  const compressed = fixture([{ headers: { "content-encoding": "gzip" } }]);
  await assert.rejects(compressed.client.getMapsPage(MAPS), { code: "ENCODING" });
  const failed = fixture([{ status: 503 }]);
  await assert.rejects(failed.client.getMapsPage(MAPS), { code: "UPSTREAM_STATUS" });
});

test("el plazo aborta cabeceras y cuerpos bloqueados", async () => {
  for (const step of [{ hangHeaders: true }, { stall: true }]) {
    const f = fixture([step]);
    await assert.rejects(safe.withTimeout(20, (signal) => f.client.getMapsPage(MAPS, { signal })), { code: "TIMEOUT" });
    if (f.responses.length) assert.equal(f.responses[0].destroyed, true);
  }
});

test("DNS lento expira y su resolución tardía nunca abre una conexión", async () => {
  let resolveDns;
  let calls = 0;
  const client = safe.createSafeHttpClient({
    lookup: () => new Promise((resolve) => { resolveDns = resolve; }),
    request: () => { calls += 1; },
  });
  await assert.rejects(safe.withTimeout(20, (signal) => client.getMapsPage(MAPS, { signal })), { code: "TIMEOUT" });
  resolveDns([{ address: "8.8.8.8", family: 4 }]);
  await new Promise(setImmediate);
  assert.equal(calls, 0);
});

test("Nominatim tiene política, límites y prohibición de redirección propios", async () => {
  const ok = fixture([{ body: '{"address":{"road":"Prueba"}}' }]);
  assert.equal((await ok.client.getNominatimJson(NOMINATIM)).address.road, "Prueba");
  await assert.rejects(ok.client.getNominatimJson(MAPS), { code: "INVALID_URL" });
  const redirect = fixture([{ status: 302, headers: { location: NOMINATIM } }]);
  await assert.rejects(redirect.client.getNominatimJson(NOMINATIM), { code: "REDIRECT_BLOCKED" });
  assert.equal(redirect.calls.length, 1);
  const large = fixture([{ chunks: [Buffer.alloc(safe.LIMITS.nominatimBytes + 1)] }]);
  await assert.rejects(large.client.getNominatimJson(NOMINATIM), { code: "TOO_LARGE" });
  const privateDns = fixture([], [{ address: "169.254.169.254", family: 4 }]);
  await assert.rejects(privateDns.client.getNominatimJson(NOMINATIM), { code: "BLOCKED_ADDRESS" });
  const stalled = fixture([{ stall: true }]);
  await assert.rejects(safe.withTimeout(20, (signal) => stalled.client.getNominatimJson(NOMINATIM, { signal })), { code: "TIMEOUT" });
  assert.equal(stalled.responses[0].destroyed, true);
});

async function startTestApi(client, t, logs = []) {
  const filename = path.resolve(__dirname, "../server.js");
  const realRequire = createRequire(filename);
  const moduleObject = { exports: {} };
  const loadServer = new Function("require", "module", "__dirname", "console", readFileSync(filename, "utf8"));
  loadServer(
    (name) => name === "./lib/safe-http" ? { ...safe, createSafeHttpClient: () => client } : realRequire(name),
    moduleObject, path.dirname(filename), { warn: line => logs.push(JSON.parse(line)) }
  );
  const server = moduleObject.exports.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/analyze-maps-url`;
  const post = (url) => fetch(endpoint, { method: "POST", headers: {
    "Content-Type": "application/json", Origin: "https://juanjdes.github.io",
  }, body: JSON.stringify({ url }) });
  post.endpoint = endpoint;
  return post;
}

test("fallos de Nominatim conservan coordenadas y registran HTTP, JSON inválido y ausencia de dirección", async (t) => {
  const logs = [];
  const f = fixture([
    { status: 429 }, { status: 403 }, { status: 503 },
    { body: "private-value invalid json" }, { body: '{"error":"private-value"}' },
    { body: '{}' }, { body: '{"display_name":"   "}' },
    { body: '{"address":{"road":"Recuperada"}}' },
  ]);
  const post = await startTestApi(f.client, t, logs);
  const url = "https://www.google.com/maps?q=40.4168,-3.7038";
  for (const [code, status] of [["UPSTREAM_STATUS", 429], ["UPSTREAM_STATUS", 403], ["UPSTREAM_STATUS", 503],
    ["INVALID_JSON", null], ["NO_ADDRESS", null], ["NO_ADDRESS", null], ["NO_ADDRESS", null]]) {
    const response = await post(url);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.found, true);
    assert.equal(body.address, null);
    assert.deepEqual(body.coordinates, { lat: 40.4168, lng: -3.7038 });
    const log = logs.at(-1);
    assert.equal(log.event, "reverse_geocode_failed");
    assert.equal(log.service, "nominatim");
    assert.equal(log.code, code);
    assert.equal(log.upstreamStatus, status);
    assert.ok(log.durationMs >= 0);
    assert.ok(Number.isFinite(Date.parse(log.timestamp)));
  }
  assert.equal((await (await post(url)).json()).address.road, "Recuperada");
  assert.equal(logs.length, 7);
  assert.doesNotMatch(JSON.stringify(logs), /private-value|40\.4168|-3\.7038|https:|stack/);
  assert.ok(f.calls.every(call => call.url.startsWith("https://nominatim.openstreetmap.org/reverse?")));
});

test("registro distingue timeout y DNS sin exponer mensajes ni códigos desconocidos", async (t) => {
  const logs = [];
  const errors = [new safe.OutboundError("TIMEOUT", "private-value"),
    Object.assign(new Error("private-value"), { code: "EAI_AGAIN" }),
    Object.assign(new Error("private-value"), { code: "private-value" })];
  const post = await startTestApi({
    getMapsPage: async url => ({ finalUrl: url }),
    getNominatimJson: async () => { throw errors.shift(); },
  }, t, logs);
  for (const code of ["TIMEOUT", "EAI_AGAIN", "UNKNOWN"]) {
    assert.equal((await (await post("https://www.google.com/maps?q=40,-3")).json()).address, null);
    assert.equal(logs.at(-1).code, code);
  }
  assert.doesNotMatch(JSON.stringify(logs), /private-value/);
});

test("API conserva coordenadas y dirección opcional, y rechaza URLs inválidas", async (t) => {
  const f = fixture([
    { body: '{"address":{"road":"Prueba"}}' }, { status: 503 },
    { body: "<html>40.123,-3.456</html>" }, { body: "{}" },
    { status: 302, headers: { location: "https://www.google.com/maps?q=40.4168,-3.7038" } }, { body: "{}" },
  ]);
  const post = await startTestApi(f.client, t);
  const bad = await post("https://127.0.0.1/");
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).found, false);
  assert.equal(f.calls.length, 0);
  const validUrl = "https://www.google.com/maps?q=40.4168,-3.7038";
  const good = await post(validUrl);
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.deepEqual(body.coordinates, { lat: 40.4168, lng: -3.7038 });
  assert.equal(body.address.road, "Prueba");
  assert.equal(f.calls[0].url.startsWith("https://nominatim.openstreetmap.org/reverse?"), true);
  const noAddress = await (await post(validUrl)).json();
  assert.equal(noAddress.found, true);
  assert.equal(noAddress.address, null);
  const htmlLocation = await (await post(MAPS)).json();
  assert.equal(htmlLocation.found, true);
  assert.deepEqual(htmlLocation.coordinates, { lat: 40.123, lng: -3.456 });
  const shortLink = await (await post(SHORT)).json();
  assert.equal(shortLink.found, true);
  assert.equal(shortLink.finalUrl, validUrl);
});

for (const [shortId, placeId, cid, lat, lng] of [
  ["x2USLymKWoJrFcpp9", "0xd42299ca0250903:0x2e486396300bd83f", "3335025020770179135", 40.4826811, -3.7078931],
  ["NMjg9Z3cz4fXXQtD6", "0xd422665b24cfcbf:0x72647358f236b224", "8242840043852837412", 40.3808697, -3.67579],
]) test(`API resuelve el enlace móvil ${shortId} por su lugar, sin descargar la página genérica`, async (t) => {
  const finalUrl = `https://www.google.com/maps/place/Prueba/data=!4m2!3m1!1s${placeId}!18m1!1e1?entry=gps`;
  const f = fixture([
    { status: 302, headers: { location: finalUrl } },
    // Fragmento mínimo del formato initEmbed observado en las respuestas reales.
    { body: `initEmbed([[[3000,-4.57,41.34]],null,[["${placeId}","Prueba",[${lat},${lng}]]]]);` },
    { body: '{"address":{"road":"Prueba"}}' },
  ]);
  const post = await startTestApi(f.client, t);
  const response = await post(`https://maps.app.goo.gl/${shortId}`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.found, true);
  assert.deepEqual(result.coordinates, { lat, lng });
  assert.equal(result.finalUrl, finalUrl);
  assert.equal(result.address.road, "Prueba");
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[1].url, `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${cid}`);
  assert.ok(f.calls[2].url.startsWith("https://nominatim.openstreetmap.org/reverse?"));
});

test("API no asigna el centro del mapa si Google no devuelve el lugar solicitado", async (t) => {
  const f = fixture([{ body: 'initEmbed([[[3000,-4.57,41.34]],[["0x1:0x2","Otro",[40,-3]]]]);' }]);
  const post = await startTestApi(f.client, t);
  const result = await (await post("https://www.google.com/maps/place/Prueba/data=!1s0x1:0x3")).json();
  assert.equal(result.found, false);
  assert.equal(f.calls.length, 1);
});

test("API valida las redirecciones del mapa incrustado", async (t) => {
  const f = fixture([{ status: 302, headers: { location: "https://127.0.0.1/maps" } }]);
  const post = await startTestApi(f.client, t);
  const response = await post("https://www.google.com/maps/place/Prueba/data=!1s0x1:0x3");
  assert.equal(response.status, 400);
  assert.equal((await response.json()).found, false);
  assert.equal(f.lookups.length, 1);
  assert.equal(f.calls.length, 1);
});

test("API limita antes de parsear JSON o conectar, con CORS y sin bloquear la web ni OPTIONS", async (t) => {
  const f = fixture();
  const post = await startTestApi(f.client, t);
  let response;
  for (let index = 0; index < 20; index += 1) {
    response = await post("https://example.com/");
    assert.equal(response.status, 400);
  }
  response = await post("https://www.google.com/maps?q=40,-3");
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://juanjdes.github.io");
  assert.ok(Number(response.headers.get("Retry-After")) > 0);
  assert.match((await response.json()).message, /Espera/);
  assert.equal(f.calls.length, 0);
  const malformed = await fetch(response.url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalid",
  });
  assert.equal(malformed.status, 429);
  assert.equal((await malformed.json()).found, false);
  assert.equal((await fetch(response.url, { method: "OPTIONS" })).status, 204);
  assert.equal((await fetch(new URL("/", response.url))).status, 200);
});

test("CORS admite Pages/Render, rechaza otros orígenes y conserva clientes sin Origin", async (t) => {
  const f = fixture();
  const post = await startTestApi(f.client, t);
  const request = (origin, method = "POST", extra = {}) => fetch(post.endpoint, {
    method, headers: { ...(origin === undefined ? {} : { Origin: origin }), "Content-Type": "application/json", ...extra },
    ...(method === "POST" ? { body: JSON.stringify({ url: "https://example.com/" }) } : {}),
  });
  for (const origin of ["https://juanjdes.github.io", "https://rechargeev-backend.onrender.com"]) {
    const response = await request(origin);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.match(response.headers.get("Vary"), /Origin/);
    assert.equal(response.headers.get("Access-Control-Expose-Headers"), "Retry-After");
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
  for (const origin of ["https://evil.test", "null", "https://juanjdes.github.io.evil.test", "https://juanjdes.github.io/RechargeEV/"]) {
    for (const method of ["POST", "OPTIONS"]) {
      const response = await request(origin, method);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
      assert.equal((await response.json()).code, "ORIGIN_NOT_ALLOWED");
    }
  }
  const direct = await request(undefined);
  assert.equal(direct.status, 400);
  assert.equal(direct.headers.get("Access-Control-Allow-Origin"), null);
  const preflight = await request("https://juanjdes.github.io", "OPTIONS", {
    "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal((await request("https://juanjdes.github.io", "OPTIONS", { "Access-Control-Request-Method": "DELETE" })).status, 405);
  assert.equal((await request("https://juanjdes.github.io", "OPTIONS", { "Access-Control-Request-Headers": "content-type,x-secret" })).status, 403);
  assert.equal(f.calls.length, 0);
});

test("errores de entrada devuelven JSON seguro con CORS y código estable", async (t) => {
  const f = fixture();
  const post = await startTestApi(f.client, t);
  for (const [body, contentType, encoding, status, code] of [
    ['{"private-value":', "application/json", null, 400, "INVALID_JSON"],
    [JSON.stringify({ url: "x".repeat(21 * 1024) }), "application/json", null, 413, "PAYLOAD_TOO_LARGE"],
    ['{"url":"private-value"}', "text/plain", null, 415, "UNSUPPORTED_MEDIA_TYPE"],
    ["{}", "application/json; charset=iso-8859-1", null, 415, "UNSUPPORTED_ENCODING"],
    ["private-value", "application/json", "gzip", 415, "UNSUPPORTED_ENCODING"],
    ["{}", "application/json", null, 400, "MISSING_MAPS_URL"],
  ]) {
    const response = await fetch(post.endpoint, { method: "POST", headers: {
      Origin: "https://juanjdes.github.io", "Content-Type": contentType,
      ...(encoding ? { "Content-Encoding": encoding } : {}),
    }, body });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://juanjdes.github.io");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const text = await response.text();
    assert.doesNotMatch(text, /private-value|SyntaxError|stack|node_modules|<!DOCTYPE/i);
    assert.equal(JSON.parse(text).code, code);
    assert.equal(JSON.parse(text).found, false);
  }
  const wrongMethod = await fetch(post.endpoint);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("Allow"), "POST, OPTIONS");
  assert.equal((await wrongMethod.json()).code, "METHOD_NOT_ALLOWED");
  const missing = await fetch(new URL("/api/missing", post.endpoint));
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "NOT_FOUND");
  assert.equal(f.calls.length, 0);
});

test("los fallos externos no exponen mensajes internos y conservan CORS", async (t) => {
  const errors = [new Error("private-value /internal/path"),
    new safe.OutboundError("TIMEOUT", "private-value"),
    new safe.OutboundError("BLOCKED_ADDRESS", "private-value")];
  const post = await startTestApi({ getMapsPage: async () => { throw errors.shift(); } }, t);
  for (const [status, code] of [[502, "UPSTREAM_ERROR"], [504, "UPSTREAM_TIMEOUT"], [502, "UPSTREAM_ERROR"]]) {
    const response = await post(MAPS);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://juanjdes.github.io");
    const text = await response.text();
    assert.doesNotMatch(text, /private-value|internal\/path|stack/);
    assert.equal(JSON.parse(text).code, code);
  }
});
