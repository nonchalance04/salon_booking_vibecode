import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import { z } from "zod";
import { app } from "../src/app/app.js";
import { parseEnv } from "../src/config/env.schema.js";
import { errorHandler, requestContext, validateRequest } from "../src/shared/http.js";

async function withServer(application: typeof app, run: (url: string) => Promise<void>) {
  const server = application.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health is public liveness, unknown routes and malformed JSON use safe API errors", async () => {
  await withServer(app, async (url) => {
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");
    assert.ok(health.headers.get("x-request-id"));
    assert.equal(health.headers.get("x-powered-by"), null);
    const missing = await fetch(`${url}/not-a-route?token=secret`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "NOT_FOUND");
    const malformed = await fetch(`${url}/api/health`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"secret":',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, "VALIDATION_ERROR");
    const large = await fetch(`${url}/api/health`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(110_000) }),
    });
    assert.equal(large.status, 413);
    assert.equal((await large.json()).error.code, "PAYLOAD_TOO_LARGE");
  });
});

test("validation supplies parsed body, params, and query; rejects invalid requests", async () => {
  const application = express();
  application.use(express.json());
  const schema = z.object({
    body: z.object({ name: z.string().trim().min(1) }),
    params: z.object({ id: z.uuid() }),
    query: z.object({ page: z.coerce.number().int().positive() }),
  });
  application.post("/:id", validateRequest(schema), (_req, res) => res.json(res.locals.validated));
  application.use(errorHandler);
  await withServer(application, async (url) => {
    const valid = await fetch(`${url}/10000000-0000-4000-8000-000000000001?page=2`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":" Salon "}',
    });
    assert.equal(valid.status, 200);
    const parsed = await valid.json();
    assert.equal(parsed.body.name, "Salon");
    assert.equal(parsed.query.page, 2);
    const invalid = await fetch(`${url}/invalid?page=0`, { method: "POST" });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
  });
});

test("unexpected failures do not expose secrets in responses or operational logs", async (context) => {
  const application = express();
  const log = context.mock.method(console, "error", () => {});
  application.use(requestContext);
  application.get("/fail", () => { throw new Error("database-password-secret"); });
  application.use(errorHandler);
  await withServer(application, async (url) => {
    const response = await fetch(`${url}/fail?token=guest-secret`, {
      headers: { Authorization: "Bearer header-secret" },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
    assert.equal(log.mock.callCount(), 1);
    const output = String(log.mock.calls[0]?.arguments[0]);
    assert.ok(!output.includes("secret"));
    assert.equal(JSON.parse(output).requestId, response.headers.get("x-request-id"));
  });
});

test("environment validation rejects invalid configuration without disclosing values", () => {
  const valid = { DATABASE_URL: "postgresql://local:password@localhost/salon", JWT_SECRET: "a".repeat(32) };
  assert.equal(parseEnv(valid).PORT, 3000);
  assert.equal(parseEnv({ ...valid, PORT: "4000" }).PORT, 4000);
  for (const input of [
    { ...valid, PORT: "0" }, { ...valid, PORT: "65536" },
    { ...valid, DATABASE_URL: "https://user:secret@example.com/salon" },
    { ...valid, DATABASE_URL: "postgresql://localhost" },
    { ...valid, JWT_SECRET: "secret" }, { ...valid, NODE_ENV: "invalid" },
  ]) {
    assert.throws(() => parseEnv(input), (error: Error) => {
      assert.ok(error.message.startsWith("Invalid environment configuration:"));
      assert.ok(!error.message.includes("secret"));
      return true;
    });
  }
});
