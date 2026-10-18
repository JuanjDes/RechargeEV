const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const base = "https://example.test/RechargeEV/";
const source = readFileSync(path.join(__dirname, "../docs/service-worker.js"), "utf8");
const html = readFileSync(path.join(__dirname, "../docs/index.html"), "utf8");

function worker() {
  const handlers = {};
  const stored = new Map();
  const installed = [];
  const calls = [];
  let offline = false;
  const cache = {
    async addAll(requests) { installed.push(...requests); },
    async put(request, response) { stored.set(request.url, response); },
  };
  vm.runInNewContext(source, {
    URL,
    Request: class extends Request { constructor(url, options) { super(new URL(url, base), options); } },
    self: { location: new URL(base), addEventListener: (type, callback) => { handlers[type] = callback; }, skipWaiting() {} },
    caches: { open: async () => cache, match: async request => stored.get(request.url)?.clone() },
    fetch: async (request, options) => {
      calls.push({ request, options });
      if (offline) throw new Error("offline");
      return new Response(options.cache === "no-cache" ? "fresh" : "stale-http-cache");
    },
  });
  return {
    handlers, installed, calls, stored,
    offline() { offline = true; },
    request(url, method = "GET") {
      let response;
      handlers.fetch({ request: new Request(new URL(url, base), { method }), respondWith(value) { response = value; } });
      return response;
    },
  };
}

test("la instalación descarga recursos frescos y las mismas versiones de CSS/JS que usa el HTML", async () => {
  const w = worker();
  let install;
  w.handlers.install({ waitUntil(promise) { install = promise; } });
  await install;
  const assets = [...html.matchAll(/(?:href|src)="((?:styles\.css|app\.js)\?v=\d+)"/g)].map(match => match[1]);
  assert.equal(assets.length, 2);
  assert.equal(new URL(assets[0], base).search, new URL(assets[1], base).search);
  for (const asset of assets) {
    assert.ok(w.installed.some(request => request.url === new URL(asset, base).href));
  }
  assert.ok(w.installed.every(request => request.cache === "reload"));
});

test("HTML, CSS y JS se revalidan aunque la caché HTTP conserve la versión anterior", async () => {
  const w = worker();
  for (const asset of ["index.html", "styles.css?v=9", "app.js?v=9"]) {
    assert.equal(await (await w.request(asset)).text(), "fresh");
  }
  assert.ok(w.calls.every(call => call.options.cache === "no-cache"));
});

test("sin red se recuperan los recursos versionados ya cacheados", async () => {
  const w = worker();
  await w.request("app.js?v=9");
  w.offline();
  assert.equal(await (await w.request("app.js?v=9")).text(), "fresh");
  await assert.rejects(w.request("app.js?v=999"), /offline/);
});

test("no se interceptan POST ni se cambia la política HTTP de servicios externos", async () => {
  const w = worker();
  assert.equal(w.request("/api/analyze-maps-url", "POST"), undefined);
  assert.equal(w.calls.length, 0);
  await w.request("https://tiles.example.test/map.png");
  assert.equal(w.calls[0].options.cache, undefined);
});
