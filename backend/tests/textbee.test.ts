import assert from "node:assert/strict";
import { test } from "node:test";
import { createTextBeeProvider, NotificationFailure } from "../src/modules/notifications/notification-provider.js";
import { parseEnv } from "../src/config/env.schema.js";
import { guestSessionCookie } from "../src/modules/appointments/appointment-otp.routes.js";
const message = { id: "test", channel: "SMS" as const, recipient: "0917 123 4567", subject: "OTP", text: "Your code is 123456" };
test("TextBee uses documented endpoint, E.164 recipient, device and backend key", async () => {
  const signal = AbortSignal.timeout(1000);
  await createTextBeeProvider("secret", "a".repeat(24), async (url, init) => {
    assert.equal(url, "https://api.textbee.dev/api/v1/gateway/send-sms");
    assert.equal(new Headers(init!.headers).get("x-api-key"), "secret");
    assert.equal(init!.redirect, "error"); assert.equal(init!.signal, signal);
    assert.deepEqual(JSON.parse(String(init!.body)), { deviceId: "a".repeat(24), recipients: ["+639171234567"], message: message.text });
    return Response.json({ data: { success: true, smsBatchId: "batch" } });
  }).send(message, signal);
});
test("TextBee rejects malformed success, HTTP failures and transport errors without leaking secrets", async () => {
  for (const body of [{}, { data: { success: false, smsBatchId: "id" } }, { data: { success: true } }]) {
    await assert.rejects(createTextBeeProvider("secret", "device", async () => Response.json(body)).send(message, AbortSignal.timeout(1000)), /INVALID_PROVIDER_RESPONSE/);
  }
  for (const status of [400, 401, 429, 500]) {
    await assert.rejects(createTextBeeProvider("secret", "device", async () => new Response("sensitive", { status })).send(message, AbortSignal.timeout(1000)), (err: NotificationFailure) => {
      assert.equal(err.code, `PROVIDER_HTTP_${status}`); assert.equal(err.retryable, status >= 429); return true;
    });
  }
  await assert.rejects(createTextBeeProvider("secret", "device", async () => { throw new Error("private"); }).send(message, AbortSignal.timeout(1000)), /PROVIDER_UNAVAILABLE/);
});
test("TextBee OTP requires complete configuration and cookie parser rejects duplicates", () => {
  const base = { DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "a".repeat(32), APPOINTMENT_OTP_PROVIDER: "textbee" };
  assert.throws(() => parseEnv(base));
  assert.throws(() => parseEnv({ ...base, TEXTBEE_API_KEY: "secret", TEXTBEE_DEVICE_ID: "bad", APPOINTMENT_OTP_SECRET: "b".repeat(32) }));
  assert.equal(parseEnv({ ...base, TEXTBEE_API_KEY: "secret", TEXTBEE_DEVICE_ID: "a".repeat(24), APPOINTMENT_OTP_SECRET: "b".repeat(32) }).APPOINTMENT_OTP_PROVIDER, "textbee");
  const token = "a".repeat(43);
  assert.equal(guestSessionCookie(`salon_appointment_session=${token}`), token);
  assert.equal(guestSessionCookie(`salon_appointment_session=${token}; salon_appointment_session=${token}`), "");
});
