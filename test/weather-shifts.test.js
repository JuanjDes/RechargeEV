const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Cada archivo de node --test corre en su propio proceso.
process.env.TZ = "Europe/Madrid";
const source = readFileSync(path.join(__dirname, "../docs/app.js"), "utf8");

function frontend() {
  let now = new Date("2026-10-18T10:00:00").getTime();
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const nodes = new Map();
  function node() {
    return { hidden: true, value: "auto", handlers: {}, attributes: {}, html: "",
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      focus() {}, prepend() {},
      set innerHTML(value) { this.html = value; }, get innerHTML() { return this.html; },
      set textContent(value) { this.html = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },
      get textContent() { return this.html; },
    };
  }
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  let respond = async () => ({ hourly: { time: [], precipitation_probability: [] } });
  const context = vm.createContext({
    Date: ClockDate, URL, Intl,
    document: { title: "RechargeEV", getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    }, querySelector: node, createElement: node },
    navigator: { onLine: true },
    window: { location: { hostname: "localhost", hash: "#meteorologia" }, history: {}, scrollTo() {}, scrollY: 0 },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async url => { calls.push(new URL(url)); return { ok: true, json: async () => respond() }; },
  });
  vm.runInContext(source.replace(/initApp\(\);\s*$/, ""), context);
  vm.runInContext(`getCurrentUserCoordinates = async () => ({ lat: 40, lng: -3 }); refreshMapSize = () => {};`, context);
  const date = text => new ClockDate(text);
  return { context, nodes, calls, timers, date,
    setNow: text => { now = new Date(text).getTime(); },
    respond: fn => { respond = fn; },
    range: (text, shift = "auto") => context.getWorkShiftRange(date(text), shift),
  };
}

test("automático respeta los límites exactos y la noche que empezó ayer", () => {
  const f = frontend();
  for (const [time, id, start, end] of [
    ["00:00:00", "night", "17T22:00", "18T06:00"],
    ["05:59:59", "night", "17T22:00", "18T06:00"],
    ["06:00:00", "morning", "18T06:00", "18T14:00"],
    ["13:59:59", "morning", "18T06:00", "18T14:00"],
    ["14:00:00", "afternoon", "18T14:00", "18T22:00"],
    ["21:59:59", "afternoon", "18T14:00", "18T22:00"],
    ["22:00:00", "night", "18T22:00", "19T06:00"],
    ["23:59:59", "night", "18T22:00", "19T06:00"],
  ]) {
    const range = f.range(`2026-10-18T${time}`);
    assert.equal(range.id, id);
    assert.equal(+range.start, +f.date(`2026-10-${start}`));
    assert.equal(+range.end, +f.date(`2026-10-${end}`));
  }
});

test("selección manual muestra el turno en curso o su próxima aparición", () => {
  const f = frontend();
  for (const [now, shift, start] of [
    ["2026-10-18T02:00", "night", "2026-10-17T22:00"],
    ["2026-10-18T06:00", "night", "2026-10-18T22:00"],
    ["2026-10-18T10:00", "morning", "2026-10-18T06:00"],
    ["2026-10-18T14:00", "morning", "2026-10-19T06:00"],
    ["2026-10-18T10:00", "afternoon", "2026-10-18T14:00"],
    ["2026-10-18T22:00", "afternoon", "2026-10-19T14:00"],
  ]) assert.equal(+f.range(now, shift).start, +f.date(start));
});

test("noche atraviesa correctamente cambios de mes y año", () => {
  const f = frontend();
  assert.equal(+f.range("2027-01-01T02:00").start, +f.date("2026-12-31T22:00"));
  assert.equal(+f.range("2026-10-31T23:00").end, +f.date("2026-11-01T06:00"));
});

test("cambio de hora conserva 22–06 con siete o nueve intervalos reales", () => {
  const f = frontend();
  for (const [now, count] of [["2026-03-29T04:00", 7], ["2026-10-25T04:00", 9]]) {
    const range = f.range(now);
    assert.equal(range.start.getHours(), 22);
    assert.equal(range.end.getHours(), 6);
    assert.equal((range.end - range.start) / 3600000, count);
    const hours = Array.from({ length: count }, (_, i) => ({
      date: new f.context.Date(+range.start + (i + 1) * 3600000), probability: 20,
    }));
    assert.equal(f.context.calculateRainSummary(hours, range).isPartial, false);
  }
});

test("consulta incluye ayer y timestamps absolutos; null no se convierte en cero", async () => {
  const f = frontend();
  const end = +f.date("2026-10-18T07:00") / 1000;
  f.respond(async () => ({ hourly: { time: [end, end + 3600, null, end + 7200],
    precipitation_probability: [0, null, 40, "50"] } }));
  const hours = await f.context.fetchRainForecast({ lat: 40, lng: -3 });
  const params = f.calls[0].searchParams;
  assert.equal(params.get("past_days"), "1");
  assert.equal(params.get("forecast_days"), "2");
  assert.equal(params.get("timezone"), "Europe/Madrid");
  assert.equal(params.get("timeformat"), "unixtime");
  assert.equal(+hours[0].date, end * 1000);
  assert.equal(hours[0].probability, 0);
  assert.ok(Number.isNaN(hours[1].probability));
  assert.equal(hours[2].date, null);
  assert.ok(Number.isNaN(hours[3].probability));
});

test("resumen usa ocho intervalos del turno y avisa de datos parciales o ausentes", () => {
  const f = frontend();
  const range = f.range("2026-10-18T10:00");
  const hours = Array.from({ length: 10 }, (_, i) => ({
    date: new f.context.Date(+range.start + i * 3600000), probability: i === 0 || i === 9 ? 100 : 20,
  }));
  const summary = f.context.calculateRainSummary(hours, range);
  assert.equal(summary.shiftHours.length, 8);
  assert.equal(summary.maxProbability, 20);
  assert.equal(summary.averageProbability, 20);
  assert.equal(summary.isPartial, false);
  f.context.renderRainForecast(summary);
  assert.match(f.nodes.get("weatherResult").innerHTML, /06:00–07:00/);
  assert.match(f.nodes.get("weatherResult").innerHTML, /13:00–14:00/);
  hours[1].probability = NaN;
  const partial = f.context.calculateRainSummary(hours, range);
  assert.equal(partial.isPartial, true);
  f.context.renderRainForecast(partial);
  assert.match(f.nodes.get("weatherResult").innerHTML, /Datos parciales/);
  assert.throws(() => f.context.calculateRainSummary([], range), /turno seleccionado/);
});

test("selector descarta respuestas antiguas y mantiene el turno elegido", async () => {
  const f = frontend();
  const responses = [];
  f.respond(() => new Promise(resolve => responses.push(resolve)));
  const first = f.context.showRainForecastPanel();
  await new Promise(setImmediate);
  f.nodes.get("weatherShiftSelect").value = "afternoon";
  const second = f.nodes.get("weatherShiftSelect").handlers.change();
  await new Promise(setImmediate);
  const payload = (time, probability) => ({ hourly: { time: [+f.date(time) / 1000], precipitation_probability: [probability] } });
  responses[1](payload("2026-10-18T15:00", 30));
  await second;
  assert.match(f.nodes.get("weatherShiftLabel").textContent, /Próximo · Tarde/);
  assert.match(f.nodes.get("weatherResult").innerHTML, /30%/);
  responses[0](payload("2026-10-18T07:00", 99));
  await first;
  assert.doesNotMatch(f.nodes.get("weatherResult").innerHTML, /99%/);
  assert.equal(f.timers.size, 0);
});

test("automático cambia al siguiente turno y al volver a entrar descarta la selección manual", async () => {
  const f = frontend();
  f.nodes.get("weatherPanel").hidden = false;
  await f.context.showRainForecastPanel();
  const timer = [...f.timers.values()][0];
  assert.equal(timer.delay, 4 * 3600000);
  f.setNow("2026-10-18T14:00");
  timer.fn();
  await new Promise(setImmediate);
  assert.match(f.nodes.get("weatherShiftLabel").textContent, /En curso · Tarde/);
  f.context.window.location.hash = "";
  f.context.syncAppScreen();
  assert.equal(f.timers.size, 0);
  f.nodes.get("weatherShiftSelect").value = "night";
  f.context.window.location.hash = "#meteorologia";
  f.context.syncAppScreen();
  await new Promise(setImmediate);
  assert.equal(f.nodes.get("weatherShiftSelect").value, "auto");
  assert.match(f.nodes.get("weatherShiftLabel").textContent, /En curso · Tarde/);
});

test("errores de red o ubicación dejan un aviso y retiran el indicador de carga", async () => {
  const f = frontend();
  f.respond(async () => { throw new Error("Servicio no disponible"); });
  await f.context.showRainForecastPanel();
  assert.match(f.nodes.get("weatherResult").innerHTML, /Servicio no disponible/);
  assert.equal(f.nodes.get("weatherResult").attributes["aria-busy"], undefined);
  vm.runInContext('getCurrentUserCoordinates = async () => { throw new Error("Sin permiso de ubicación"); };', f.context);
  await f.context.showRainForecastPanel();
  assert.match(f.nodes.get("weatherResult").innerHTML, /Sin permiso de ubicación/);
});
