const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { clientKey, createMapsRateLimit, getTrustProxyHops } = require("../lib/rate-limit");

function attempt(limiter, ip) {
  const result = { accepted: false, headers: {} };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; },
  };
  limiter({ ip }, res, () => { result.accepted = true; });
  return result;
}

test("la cuota por cliente se agota sin bloquear otra IP", () => {
  const limit = createMapsRateLimit({ perClient: 2, now: () => 0 });
  assert.ok(attempt(limit, "192.0.2.1").accepted);
  assert.ok(attempt(limit, "192.0.2.1").accepted);
  const rejected = attempt(limit, "192.0.2.1");
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.found, false);
  assert.equal(rejected.body.retryAfter, 60);
  assert.equal(rejected.headers["Retry-After"], "60");
  assert.equal(rejected.headers["Cache-Control"], "no-store");
  assert.ok(attempt(limit, "192.0.2.2").accepted);
});

test("el tope global impide eludir la protección rotando IP", () => {
  const limit = createMapsRateLimit({ globalLimit: 2, now: () => 0 });
  assert.ok(attempt(limit, "192.0.2.1").accepted);
  assert.ok(attempt(limit, "192.0.2.2").accepted);
  assert.equal(attempt(limit, "192.0.2.3").status, 429);
  assert.equal(attempt(limit, "192.0.2.1").status, 429);
});

test("la cuota se recupera al expirar y los rechazos no alargan el bloqueo", () => {
  let time = 0;
  const limit = createMapsRateLimit({ perClient: 1, globalLimit: 1, now: () => time });
  assert.ok(attempt(limit, "192.0.2.1").accepted);
  time = 59001;
  assert.equal(attempt(limit, "192.0.2.1").body.retryAfter, 1);
  time = 60000;
  assert.ok(attempt(limit, "192.0.2.2").accepted);
  assert.equal(attempt(limit, "192.0.2.1").status, 429);
  time = 120000;
  assert.ok(attempt(limit, "192.0.2.1").accepted);
});

test("normaliza IPv4 mapeada e IPv6 y agrupa direcciones temporales por /64", () => {
  assert.equal(clientKey("::ffff:192.0.2.1"), clientKey("192.0.2.1"));
  assert.equal(clientKey("::ffff:c000:201"), clientKey("192.0.2.1"));
  assert.equal(clientKey("2001:db8:abcd:1::1"), clientKey("2001:0db8:abcd:0001:0:0:0:abcd"));
  assert.notEqual(clientKey("2001:db8:abcd:1::1"), clientKey("2001:db8:abcd:2::1"));
  assert.equal(clientKey("::"), "0:0:0:0::/64");
  assert.equal(clientKey("not-an-ip"), "unknown");
  const limit = createMapsRateLimit({ perClient: 1 });
  assert.ok(attempt(limit, "2001:db8::1").accepted);
  assert.equal(attempt(limit, "2001:db8::abcd").status, 429);
});

test("configura proxy sólo en Render o mediante un número explícito de saltos", () => {
  assert.equal(getTrustProxyHops({}), 0);
  assert.equal(getTrustProxyHops({ RENDER: "true" }), 1);
  assert.equal(getTrustProxyHops({ RENDER: "true", TRUST_PROXY_HOPS: "0" }), 0);
  assert.equal(getTrustProxyHops({ TRUST_PROXY_HOPS: "2" }), 2);
  for (const value of ["true", "-1", "1.5", "6", ""]) {
    assert.throws(() => getTrustProxyHops({ TRUST_PROXY_HOPS: value }));
  }
});

test("configuración inválida de cuotas no desactiva silenciosamente la protección", () => {
  for (const options of [{ perClient: 0 }, { globalLimit: -1 }, { windowMs: NaN }]) {
    assert.throws(() => createMapsRateLimit(options));
  }
});

for (const hops of [0, 1]) test(`Express no acepta IP suplantada a la izquierda con ${hops} saltos de confianza`, async (t) => {
  const app = express();
  app.set("trust proxy", hops);
  app.post("/", createMapsRateLimit({ perClient: 1 }), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const endpoint = `http://127.0.0.1:${server.address().port}/`;
  const post = (xff) => fetch(endpoint, { method: "POST", headers: { "X-Forwarded-For": xff } });
  assert.equal((await post("198.51.100.1, 192.0.2.1")).status, 200);
  assert.equal((await post("198.51.100.2, 192.0.2.1")).status, 429);
  assert.equal((await post("198.51.100.2, 192.0.2.2")).status, hops === 1 ? 200 : 429);
});
