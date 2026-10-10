import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { before, after, beforeEach, test } from "node:test";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { createDatabasePool } from "../../src/database/pool.js";
import { createAppointmentOtpService } from "../../src/modules/appointments/appointment-otp.service.js";
import { createGuestCredentials, validGuestAccess } from "../../src/modules/appointments/appointments.security.js";
import { createTestNotificationProvider, type NotificationMessage } from "../../src/modules/notifications/notification-provider.js";
import { createAppointmentOtpRouter } from "../../src/modules/appointments/appointment-otp.routes.js";
import { createAppointmentsRouter } from "../../src/modules/appointments/appointments.routes.js";
import { createApp } from "../../src/app/app.js";
import { Router } from "express";
import { parseEnv } from "../../src/config/env.schema.js";
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL required for disposable database tests.");
const dbName = `salon_otp_${randomUUID().replaceAll("-", "")}`;
const url = new URL(adminUrl); url.pathname = `/${dbName}`; url.searchParams.delete("schema");
const admin = new Pool({ connectionString: adminUrl });
const pool = createDatabasePool(url.toString());
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const sent: NotificationMessage[] = [];
const provider = createTestNotificationProvider(message => sent.push(message));
const service = createAppointmentOtpService(prisma, "s".repeat(32), provider);
const run = promisify(execFile);
let created = false;
before(async () => {
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"], { env: { ...process.env, DATABASE_URL: url.toString() } });
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: url.toString(), SEED_ADMIN_EMAIL: "otp-admin@example.test", SEED_ADMIN_PASSWORD: "otp-admin-fixture-password", SEED_CASHIER_EMAIL: "otp-cashier@example.test", SEED_CASHIER_PASSWORD: "otp-cashier-fixture-password" } });
});
beforeEach(async () => {
  sent.length = 0;
  await prisma.appointmentOtpChallenge.deleteMany();
  await prisma.appointmentGuestSession.deleteMany();
  await prisma.appointmentOtpRate.deleteMany();
});
after(async () => {
  await prisma.$disconnect(); await pool.end();
  if (created) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [dbName]);
      if (!active.rowCount) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await admin.query(`DROP DATABASE "${dbName}"`);
  }
  await admin.end();
});
async function fixture() {
  const credentials = createGuestCredentials();
  const policy = await prisma.bookingPolicyVersion.findFirstOrThrow();
  const appointment = await prisma.appointment.create({ data: { bookingCode: credentials.bookingCode, guestAccessTokenHash: credentials.hash,
    customer: { create: { firstName: "OTP", lastName: "Guest", phone: "09171234567" } },
    bookingPolicyVersion: { connect: { id: policy.id } }, status: "CONFIRMED", appointmentFeeAmount: "100", startAt: new Date(Date.now()+86400000), endAt: new Date(Date.now()+90000000),
  } });
  return { appointment, credentials };
}
function lastCode() { return sent.at(-1)!.text.match(/\b\d{6}\b/)![0]; }
const rejected = (operation: Promise<unknown>, code = "INVALID_OTP") => assert.rejects(operation, (err: { code?: string }) => err.code === code);

test("OTP issues an appointment-scoped session without rotating the private link; single use", async () => {
  const { appointment, credentials } = await fixture();
  const other = await fixture();
  const requested = await service.request(appointment.bookingCode, "+63 (917) 123-4567", "ip");
  assert.equal(sent.length, 1); assert.equal(sent[0]!.recipient, "+639171234567");
  const session = await service.verify(requested.challengeId, lastCode(), "ip");
  assert.equal(await service.session(session.token), appointment.bookingCode);
  assert.equal(await validGuestAccess(prisma, session.token, appointment), true);
  assert.equal(await validGuestAccess(prisma, session.token, other.appointment), false);
  assert.equal(await validGuestAccess(prisma, credentials.token, appointment), true);
  await rejected(service.verify(requested.challengeId, lastCode(), "ip"));
  await service.logout(session.token);
  assert.equal(await validGuestAccess(prisma, session.token, appointment), false);
});
test("unknown booking and wrong phone return the same neutral shape without SMS", async () => {
  const { appointment } = await fixture();
  const a = await service.request(createGuestCredentials().bookingCode, "09181234567", "a");
  const b = await service.request(appointment.bookingCode, "09181234568", "b");
  assert.equal(a.message, b.message); assert.equal(a.retryAfterSeconds, b.retryAfterSeconds); assert.equal(sent.length, 0);
  await rejected(service.verify(a.challengeId, "000000", "a"));
});
test("wrong codes persist attempt limits and cannot be reset by parallel verification", async () => {
  const { appointment } = await fixture();
  const request = await service.request(appointment.bookingCode, "09171234567", "ip");
  const good = lastCode(), bad = good === "000000" ? "111111" : "000000";
  await Promise.all(Array.from({ length: 5 }, () => rejected(service.verify(request.challengeId, bad, "ip"))));
  await rejected(service.verify(request.challengeId, good, "ip"));
});
test("expired codes and sessions are rejected", async () => {
  const { appointment } = await fixture();
  const request = await service.request(appointment.bookingCode, "09171234567", "ip");
  await prisma.appointmentOtpChallenge.update({ where: { id: request.challengeId }, data: { expiresAt: new Date(0) } });
  await rejected(service.verify(request.challengeId, lastCode(), "ip"));
  await prisma.appointmentOtpChallenge.update({ where: { id: request.challengeId }, data: { expiresAt: new Date(Date.now()+60000) } });
  const session = await service.verify(request.challengeId, lastCode(), "ip");
  await prisma.appointmentGuestSession.updateMany({ data: { expiresAt: new Date(0) } });
  assert.equal(await service.session(session.token), null);
  assert.equal(await validGuestAccess(prisma, session.token, appointment), false);
});
test("concurrent correct verification consumes a code once", async () => {
  const { appointment } = await fixture();
  const request = await service.request(appointment.bookingCode, "09171234567", "ip");
  const results = await Promise.allSettled([service.verify(request.challengeId, lastCode(), "ip"), service.verify(request.challengeId, lastCode(), "ip")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await prisma.appointmentGuestSession.count(), 1);
});
test("resend cooldown and per-phone budget apply across different IPs", async () => {
  const { appointment } = await fixture();
  const request = await service.request(appointment.bookingCode, "09171234567", "ip");
  await rejected(service.request(appointment.bookingCode, "09171234567", "other"), "OTP_LIMIT");
  await prisma.appointmentOtpChallenge.update({ where: { id: request.challengeId }, data: { createdAt: new Date(Date.now()-61000) } });
  const old = lastCode();
  await service.request(appointment.bookingCode, "09171234567", "third");
  await rejected(service.verify(request.challengeId, old, "ip"));
  await rejected(service.request(createGuestCredentials().bookingCode, "09171234567", "fourth"), "OTP_LIMIT");
});
test("provider failures invalidate codes and retain neutral responses", async () => {
  const { appointment } = await fixture();
  let code = "";
  const failing = createAppointmentOtpService(prisma, "s".repeat(32), { async send(message) { code = message.text.match(/\b\d{6}\b/)![0]; throw new Error("private provider failure"); } });
  const request = await failing.request(appointment.bookingCode, "09171234567", "ip");
  assert.ok(request.message.startsWith("If the booking details match"));
  await rejected(failing.verify(request.challengeId, code, "ip"));
});
test("HTTP flow sets HttpOnly cookie, restores appointment, authorizes access, and logs out", async () => {
  const { appointment } = await fixture();
  const config = parseEnv({ DATABASE_URL: url.toString(), JWT_SECRET: "s".repeat(32), APPOINTMENT_OTP_PROVIDER: "textbee", TEXTBEE_API_KEY: "test", TEXTBEE_DEVICE_ID: "a".repeat(24), APPOINTMENT_OTP_SECRET: "s".repeat(32) });
  const router = Router(); router.use(createAppointmentOtpRouter(prisma, config, provider)); router.use(createAppointmentsRouter(prisma, config));
  const server = createApp(router).listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const headers = { Origin: "http://localhost:5173", "Content-Type": "application/json" };
  try {
    const request = await fetch(`${base}/appointments/otp/request`, { method: "POST", headers, body: JSON.stringify({ bookingCode: appointment.bookingCode, phone: "09171234567" }) });
    assert.equal(request.status, 200); const challenge = await request.json();
    const verify = await fetch(`${base}/appointments/otp/verify`, { method: "POST", headers, body: JSON.stringify({ challengeId: challenge.challengeId, code: lastCode() }) });
    assert.equal(verify.status, 200);
    const cookie = verify.headers.get("set-cookie")!; assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
    const result = await verify.json(); assert.equal(result.appointment.bookingCode, appointment.bookingCode); assert.equal(result.token, undefined);
    const privateToken = cookie.split(";")[0]!.split("=")[1]!;
    const linked = await fetch(`${base}/appointments/link`, { method: "POST", headers, body: JSON.stringify({ token: privateToken }) });
    assert.equal(linked.status, 200); assert.equal((await linked.json()).appointment.bookingCode, appointment.bookingCode);
    const invalidLink = await fetch(`${base}/appointments/link`, { method: "POST", headers, body: JSON.stringify({ token: "x".repeat(43) }) });
    assert.equal(invalidLink.status, 404);
    const sessionHeaders = { ...headers, Cookie: cookie.split(";")[0]! };
    const restored = await fetch(`${base}/appointments/otp/session`, { headers: sessionHeaders }); assert.equal(restored.status, 200);
    const access = await fetch(`${base}/appointments/access`, { method: "POST", headers: sessionHeaders, body: JSON.stringify({ bookingCode: appointment.bookingCode, token: "" }) }); assert.equal(access.status, 200);
    const csrf = await fetch(`${base}/appointments/otp/logout`, { method: "POST", headers: { ...sessionHeaders, Origin: "https://attacker.test" } }); assert.equal(csrf.status, 403);
    const logout = await fetch(`${base}/appointments/otp/logout`, { method: "POST", headers: sessionHeaders }); assert.equal(logout.status, 204);
    assert.equal((await fetch(`${base}/appointments/otp/session`, { headers: sessionHeaders })).status, 401);
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
});
