import assert from "node:assert/strict";
import { test } from "node:test";
import type { NotificationQueue } from "../generated/prisma/client.js";
import { parseEnv } from "../src/config/env.schema.js";
import { createResendProvider, createTwilioProvider, NotificationFailure, smsRecipient, type NotificationMessage } from "../src/modules/notifications/notification-provider.js";
import { renderNotification } from "../src/modules/notifications/templates.js";

const message: NotificationMessage = { id: "stable-queue-id", channel: "EMAIL", recipient: "guest@example.test", subject: "Booking confirmed", text: "Your booking was confirmed." };
const signal = new AbortController().signal;
test("Resend sends stable idempotency, exact text and safe transport options", async () => {
  const requests: RequestInit[] = [];
  const request: typeof fetch = async (url, init) => { assert.equal(url, "https://api.resend.com/emails"); requests.push(init!); return Response.json({ id: "accepted" }); };
  const provider = createResendProvider("secret", "salon@example.test", request);
  await provider.send(message, signal); await provider.send(message, signal);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(new Headers(requests[0]!.headers).get("Idempotency-Key"), message.id);
  assert.deepEqual(JSON.parse(String(requests[0]!.body)), { from: "salon@example.test", to: [message.recipient], subject: message.subject, text: message.text });
  assert.equal(requests[0]!.signal, signal); assert.equal(requests[0]!.redirect, "error");
});
test("Twilio validates and normalizes Philippine numbers and sends form data", async () => {
  assert.equal(smsRecipient("0917 123 4567"), "+639171234567");
  assert.equal(smsRecipient("+63 (917) 123-4567"), "+639171234567");
  assert.throws(() => smsRecipient("0"), NotificationFailure);
  const request: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.twilio.com/2010-04-01/Accounts/account/Messages.json");
    assert.equal(new Headers(init!.headers).get("Authorization"), `Basic ${Buffer.from("account:secret").toString("base64")}`);
    assert.deepEqual(Object.fromEntries(new URLSearchParams(String(init!.body))), { To: "+639171234567", MessagingServiceSid: "service", Body: message.text });
    return Response.json({ sid: "accepted", status: "queued" });
  };
  await createTwilioProvider("account", "secret", "service", request).send({ ...message, channel: "SMS", recipient: "09171234567" }, signal);
});
test("provider failures classify retryable statuses and hide response bodies", async () => {
  for (const status of [400, 401, 403, 408, 409, 422, 429, 500, 503]) {
    const provider = createResendProvider("secret", "salon@example.test", async () => new Response("private contact secret", { status }));
    await assert.rejects(provider.send(message, signal), (e: NotificationFailure) => {
      assert.equal(e.code, `PROVIDER_HTTP_${status}`);
      assert.equal(e.retryable, [408, 409, 429, 500, 503].includes(status));
      assert.ok(!e.message.includes("secret")); return true;
    });
  }
  await assert.rejects(createResendProvider("secret", "from", async () => Response.json({})).send(message, signal), /INVALID_PROVIDER_RESPONSE/);
  await assert.rejects(createTwilioProvider("account", "secret", "service", async () => Response.json({ sid: "id", status: "failed" })).send({ ...message, channel: "SMS", recipient: "+639171234567" }, signal), /PROVIDER_REJECTED/);
});
test("all existing outbox events render without secure tokens or unsupported payment claims", () => {
  const base = { id: "id", recipient: "guest@example.test", channel: "EMAIL" as const, payload: { schemaVersion: 1, bookingCode: "BOOK-123", guestAccessToken: "private", paymentId: "private" } };
  for (const eventType of ["BOOKING_CONFIRMED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED", "NO_SHOW_RECOVERY_CREATED", "PAYMENT_RECEIVED", "APPOINTMENT_COMPLETED"] as const) {
    const rendered = renderNotification({ ...base, eventType }, "Asia/Manila");
    assert.ok(rendered.text.includes("BOOK-123")); assert.ok(!rendered.text.includes("private"));
  }
  const render = (eventType: NotificationQueue["eventType"], data: object) => renderNotification({ ...base, eventType, payload: { ...base.payload, ...data } }, "Asia/Manila").text;
  assert.match(render("PAYMENT_RECEIVED", { reconciliationRequired: true }), /does not confirm/);
  assert.match(render("NO_SHOW_RECOVERY_CREATED", { appointmentStatus: "PENDING_PAYMENT" }), /still required/);
  assert.match(render("APPOINTMENT_COMPLETED", { completionType: "NO_SERVICE_CLOSURE" }), /No service payment/);
  assert.match(render("APPOINTMENT_REMINDER", { startAt: "2026-10-05T01:00:00.000Z", rescheduleCount: 0 }), /9:00 AM.*Asia\/Manila/);
  assert.throws(() => render("APPOINTMENT_REMINDER", {}), /INVALID_PAYLOAD/);
  assert.throws(() => render("BOOKING_CONFIRMED", { bookingCode: "hello\nmalicious" }), /INVALID_PAYLOAD/);
});
test("notification configuration validates credentials, bounds and production restrictions", () => {
  const base = { DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "a".repeat(32) };
  assert.equal(parseEnv(base).NOTIFICATION_EMAIL_PROVIDER, "disabled");
  for (const bad of [
    { NOTIFICATION_EMAIL_PROVIDER: "resend" }, { NOTIFICATION_SMS_PROVIDER: "twilio" },
    { NOTIFICATION_LEASE_MS: 5000, NOTIFICATION_TIMEOUT_MS: 10000 }, { NOTIFICATION_MAX_ATTEMPTS: 0 },
    { NOTIFICATION_REMINDER_HOURS: -1 }, { NODE_ENV: "production", TRUSTED_ORIGINS: "https://salon.test", NOTIFICATION_EMAIL_PROVIDER: "test" },
    { NODE_ENV: "production", TRUSTED_ORIGINS: "https://salon.test", NOTIFICATION_SMS_PROVIDER: "test" },
  ]) assert.throws(() => parseEnv({ ...base, ...bad }), /Invalid environment/);
});
