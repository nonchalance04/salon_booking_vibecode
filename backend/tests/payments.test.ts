import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { TestPaymentProvider } from "../src/modules/payments/payment-provider.js";
import { parseEnv } from "../src/config/env.schema.js";
import { manualPaymentSchema } from "../src/modules/payments/payments.schema.js";
const secret = "test-only-payment-secret-32-characters";
test("test provider authenticates raw bytes and rejects forged or malformed captured events", async () => {
  const provider = new TestPaymentProvider(secret, "test");
  const event = { paymentId: randomUUID(), appointmentId: randomUUID(), reference: "test_reference", amount: "100.00", currency: "PHP", status: "SUCCEEDED", paidAt: new Date().toISOString() };
  const raw = Buffer.from(JSON.stringify(event));
  const sign = (body: Buffer) => createHmac("sha256", secret).update(body).digest("hex");
  assert.deepEqual(await provider.verifyPayment(raw, sign(raw)), event);
  await assert.rejects(provider.verifyPayment(raw, undefined));
  await assert.rejects(provider.verifyPayment(raw, "0".repeat(64)));
  await assert.rejects(provider.verifyPayment(Buffer.from(raw.toString().replace("100.00", "900.00")), sign(raw)));
  for (const changes of [{ paidAt: null }, { status: "AUTHORIZED" }]) {
    const invalid = Buffer.from(JSON.stringify({ ...event, ...changes }));
    await assert.rejects(provider.verifyPayment(invalid, sign(invalid)));
  }
});
test("test payments fail closed in production, are opt-in, and require a secret", () => {
  const base = { DATABASE_URL: "postgresql://test@localhost/test", JWT_SECRET: "x".repeat(32) };
  assert.equal(parseEnv(base).PAYMENT_PROVIDER, "disabled");
  assert.equal(parseEnv({ ...base, PAYMENT_TEST_SECRET: "" }).PAYMENT_PROVIDER, "disabled");
  assert.throws(() => parseEnv({ ...base, PAYMENT_PROVIDER: "test" }));
  assert.throws(() => parseEnv({ ...base, NODE_ENV: "production", TRUSTED_ORIGINS: "https://salon.test", PAYMENT_PROVIDER: "test", PAYMENT_TEST_SECRET: secret }));
  assert.throws(() => new TestPaymentProvider(secret, "production"));
});
test("manual money inputs reject floats, excess precision, unknown fields and non-PHP currency", () => {
  const input = { bookingCode: "SL-test", idempotencyKey: randomUUID(), amount: "100.00", currency: "PHP", method: "CASH", externalReference: "cash-001" };
  assert.ok(manualPaymentSchema.safeParse(input).success);
  for (const changes of [{ amount: 100 }, { amount: "100.001" }, { currency: "USD" }, { status: "SUCCEEDED" }, { externalReference: " " }]) assert.equal(manualPaymentSchema.safeParse({ ...input, ...changes }).success, false);
});
