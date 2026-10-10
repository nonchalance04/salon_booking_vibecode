import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingLinkToken, confirmationSms, suppressRoutineSms } from "../src/modules/notifications/minimal-sms.js";
import { parseEnv } from "../src/config/env.schema.js";
test("combined confirmation is ASCII, one segment, and contains a stable private link", () => {
  const token = bookingLinkToken("s".repeat(32), "queue-id");
  assert.equal(token.length, 43);
  assert.equal(token, bookingLinkToken("s".repeat(32), "queue-id"));
  assert.notEqual(token, bookingLinkToken("s".repeat(32), "other-id"));
  const message = confirmationSms({ id: "queue-id", recipient: "09171234567" }, new Date("2026-10-15T06:00:00Z"), "Asia/Manila", "https://salon.example.com", token);
  assert.ok(message.text.length <= 160, message.text);
  assert.match(message.text, /Fee paid.*Confirmed.*Oct 15.*2:00 PM/);
  assert.ok(message.text.includes(`https://salon.example.com/a#${token}`));
  assert.match(message.text, /^[\x20-\x7E]+$/);
  assert.throws(() => confirmationSms({ id: "id", recipient: "09171234567" }, new Date(), "Asia/Manila", `https://${"a".repeat(100)}.test`, token), /SMS_LINK_TOO_LONG/);
});
test("minimal policy suppresses routine SMS while keeping changes, exceptions and email", () => {
  for (const eventType of ["PAYMENT_RECEIVED", "APPOINTMENT_COMPLETED", "APPOINTMENT_REMINDER"] as const) {
    assert.equal(suppressRoutineSms({ channel: "SMS", eventType, payload: {} }), true);
    assert.equal(suppressRoutineSms({ channel: "EMAIL", eventType, payload: {} }), false);
  }
  for (const eventType of ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED"] as const) assert.equal(suppressRoutineSms({ channel: "SMS", eventType, payload: {} }), false);
  assert.equal(suppressRoutineSms({ channel: "SMS", eventType: "PAYMENT_RECEIVED", payload: { reconciliationRequired: true } }), false);
});
test("public link origins must be trusted, without credentials, paths or query parameters", () => {
  const base = { DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "s".repeat(32), TRUSTED_ORIGINS: "https://salon.example.com" };
  assert.equal(parseEnv(base).NOTIFICATION_SMS_POLICY, "minimal");
  assert.equal(parseEnv({ ...base, PUBLIC_SITE_URL: "https://salon.example.com" }).PUBLIC_SITE_URL, "https://salon.example.com");
  for (const url of ["https://attacker.test", "https://secret@salon.example.com", "https://salon.example.com/path", "https://salon.example.com?key=value"]) assert.throws(() => parseEnv({ ...base, PUBLIC_SITE_URL: url }));
});
