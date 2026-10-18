const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../docs/app.js"), "utf8");
const key = "recargasVoltio.vehiculos";
const vehicle = { id: "one", matricula: "1234ABC", mapsUrl: "https://maps.app.goo.gl/Example",
  coordinates: { lat: 40.4168, lng: -3.7038 }, address: null, estado: "pendiente",
  notas: "Original", createdAt: "2026-10-18", updatedAt: "2026-10-18" };

function frontend() {
  const elements = new Map();
  const storage = new Map([[key, JSON.stringify([vehicle])]]);
  function element() {
    return { handlers: {}, children: [], hidden: true,
      addEventListener(type, fn) { this.handlers[type] = fn; },
      appendChild(child) { this.children.push(child); },
      set innerHTML(value) { this.html = value; this.children = []; },
      get innerHTML() { return this.html || ""; },
      set textContent(value) { this.html = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },
    };
  }
  const messages = [];
  const calls = [];
  let respond = async () => ({ found: true, coordinates: vehicle.coordinates, address: { road: "Recuperada" } });
  const context = vm.createContext({
    document: { title: "RechargeEV", getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, querySelector: () => element(), createElement: element },
    window: { location: { hostname: "localhost" } }, navigator: { onLine: true },
    localStorage: { getItem: name => storage.get(name) || null, setItem: (name, value) => storage.set(name, value) },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const result = await respond();
      return { ok: true, json: async () => result };
    },
    messages,
  });
  // Se omite sólo el arranque de Leaflet; se ejecutan las funciones y eventos reales de la app.
  vm.runInContext(source.replace(/initApp\(\);\s*$/, ""), context);
  vm.runInContext(`renderVehicleMarkers = () => {}; showAppMessage = (text, type) => messages.push({ text, type });`, context);
  const read = () => JSON.parse(storage.get(key));
  const write = data => storage.set(key, JSON.stringify(data));
  const click = () => elements.get("vehicleList").handlers.click({
    target: { closest: () => ({ dataset: { id: "one", retryAddress: "true" } }) },
  });
  const html = () => elements.get("vehicleList").children.map(child => child.innerHTML).join("");
  return { context, calls, messages, read, write, click, html,
    render: () => context.loadVehicles(), respond: fn => { respond = fn; } };
}

test("tarjeta pendiente y reintento recuperan la dirección conservando los datos y el marcador", async () => {
  const f = frontend();
  f.render();
  assert.match(f.html(), /Dirección pendiente/);
  assert.match(f.html(), /Reintentar dirección/);
  await f.click();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].body.url, "https://www.google.com/maps?q=40.4168,-3.7038");
  const result = f.read()[0];
  assert.equal(result.address.road, "Recuperada");
  for (const field of ["id", "matricula", "mapsUrl", "coordinates", "estado", "notas", "createdAt"]) {
    assert.deepEqual(result[field], vehicle[field]);
  }
  assert.doesNotMatch(f.html(), /Dirección pendiente|Reintentar dirección/);
  assert.match(f.html(), /Recuperada/);
  assert.equal(f.messages.at(-1).type, "success");
});

test("fallo externo o respuesta vacía mantienen pendiente y permiten volver a intentar", async () => {
  for (const respond of [async () => { throw new Error("network"); },
    async () => ({ found: true, coordinates: vehicle.coordinates, address: null })]) {
    const f = frontend();
    f.respond(respond);
    await f.click();
    assert.deepEqual(f.read(), [vehicle]);
    assert.match(f.html(), /Dirección pendiente/);
    assert.doesNotMatch(f.html(), /disabled aria-busy/);
    assert.equal(f.messages.at(-1).type, "error");
    await f.click();
    assert.equal(f.calls.length, 2);
  }
});

test("sin conexión no consulta ni altera vehículos", async () => {
  const f = frontend();
  f.context.navigator.onLine = false;
  await f.click();
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.read(), [vehicle]);
  assert.match(f.messages[0].text, /sin conexión/);
});

test("doble pulsación no duplica consultas y conserva cambios de estado y notas durante la espera", async () => {
  const f = frontend();
  let finish;
  f.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.click();
  assert.match(f.html(), /Consultando dirección/);
  assert.match(f.html(), /disabled aria-busy="true"/);
  await f.click();
  assert.equal(f.calls.length, 1);
  f.write([{ ...vehicle, estado: "cargando", notas: "Editadas" }]);
  finish({ found: true, coordinates: vehicle.coordinates, address: { road: "Nueva" } });
  await pending;
  assert.equal(f.read()[0].estado, "cargando");
  assert.equal(f.read()[0].notas, "Editadas");
  assert.equal(f.read()[0].address.road, "Nueva");
});

test("respuesta tardía no restaura vehículos borrados ni asigna direcciones a ubicaciones cambiadas", async () => {
  for (const replacement of [[], [{ ...vehicle, mapsUrl: "https://maps.app.goo.gl/Changed" }],
    [{ ...vehicle, coordinates: { lat: 41, lng: -4 } }]]) {
    const f = frontend();
    let finish;
    f.respond(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.click();
    f.write(replacement);
    finish({ found: true, coordinates: vehicle.coordinates, address: { road: "Obsoleta" } });
    await pending;
    assert.deepEqual(f.read(), replacement);
    assert.equal(f.messages.at(-1).type, "error");
  }
});

test("direcciones existentes no se reconsultan y textos externos se escapan al mostrarlos", async () => {
  const f = frontend();
  f.write([{ ...vehicle, address: { road: "<img src=x onerror=alert(1)>" } }]);
  f.render();
  assert.doesNotMatch(f.html(), /<img|Reintentar dirección/);
  assert.match(f.html(), /&lt;img/);
  await f.click();
  assert.equal(f.calls.length, 0);
});
