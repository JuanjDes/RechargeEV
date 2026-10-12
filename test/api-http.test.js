const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getAllowedOrigins, apiErrorHandler } = require("../lib/api-http");

test("orígenes exactos de producción, con desarrollo local separado", () => {
  for (const env of [{ NODE_ENV: "production" }, { RENDER: "true" }]) {
    const origins = getAllowedOrigins(env);
    assert.deepEqual([...origins], ["https://juanjdes.github.io", "https://rechargeev-backend.onrender.com"]);
    assert.equal(origins.has("http://localhost:3000"), false);
  }
  assert.ok(getAllowedOrigins({}).has("http://localhost:3000"));
  assert.ok(getAllowedOrigins({}).has("http://127.0.0.1:8080"));
});

test("la lista configurada sustituye los valores predeterminados y falla ante comodines o rutas", () => {
  assert.deepEqual([...getAllowedOrigins({ CORS_ALLOWED_ORIGINS: "https://app.example/, https://other.example" })],
    ["https://app.example", "https://other.example"]);
  for (const value of ["*", "null", "", "https://*.example", "https://app.example/path",
    "https://app.example?key=value", "https://user:pass@app.example", "file:///app", "https://app.example,"]) {
    assert.throws(() => getAllowedOrigins({ CORS_ALLOWED_ORIGINS: value }));
  }
});

test("error interno desconocido no filtra su mensaje y respeta respuestas ya iniciadas", () => {
  const error = new Error("private-value /server/path");
  let result;
  const res = { setHeader() {}, status(status) { this.statusCode = status; return this; }, json(body) { result = body; } };
  apiErrorHandler(error, {}, res, () => assert.fail("No debe delegar"));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(Object.keys(result), ["found", "code", "message"]);
  assert.equal(result.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(result), /private-value|server\/path|stack/);
  apiErrorHandler(error, {}, { headersSent: true }, forwarded => assert.equal(forwarded, error));
});
