import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { before, after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { createDatabasePool } from "../../src/database/pool.js";
import { createReportsService } from "../../src/modules/reports/reports.service.js";
import { reportQuery } from "../../src/modules/reports/reports.schema.js";
import { createApp } from "../../src/app/app.js";
import { createApiRouter } from "../../src/app/routes.js";
import { createTokenService } from "../../src/modules/auth/auth.token.js";
import { parseEnv } from "../../src/config/env.schema.js";
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL is required for disposable PostgreSQL tests.");
const dbName = `salon_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(adminUrl); url.pathname = `/${dbName}`; url.searchParams.delete("schema");
const adminPool = new Pool({ connectionString: adminUrl });
const pool = createDatabasePool(url.toString());
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let created = false;
before(async () => {
  await adminPool.query(`CREATE DATABASE "${dbName}"`); created = true;
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url.toString(), SEED_ADMIN_EMAIL: "admin@example.test", SEED_ADMIN_PASSWORD: "phase9-test-password", SEED_CASHIER_EMAIL: "cashier@example.test", SEED_CASHIER_PASSWORD: "phase9-test-password" };
  const run = promisify(execFile);
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"], { env });
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env });
}, { timeout: 90_000 });
after(async () => {
  await prisma.$disconnect(); await pool.end();
  try {
    if (created) {
      for (let i = 0; i < 100 && (await adminPool.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [dbName])).rowCount; i++) await delay(20);
      await adminPool.query(`DROP DATABASE "${dbName}"`);
    }
  } finally { await adminPool.end(); }
});
const reports = createReportsService(prisma, "Asia/Manila");
const q = reportQuery.parse({ from: "2026-10-04", to: "2026-10-04" });
const day = new Date("2026-10-04T00:00:00Z");
async function actor(role: "ADMIN" | "CASHIER" = "ADMIN") { return prisma.user.findFirstOrThrow({ where: { role } }); }
async function appointment(extra: object = {}) {
  const policy = await prisma.bookingPolicyVersion.findFirstOrThrow();
  return prisma.appointment.create({ data: { bookingCode: randomUUID(), customer: { create: { firstName: "Test", lastName: "Guest", phone: "0" } }, bookingPolicyVersion: { connect: { id: policy.id } }, status: "CONFIRMED", startAt: day, endAt: new Date(+day + 1800000), appointmentFeeAmount: "100.00", guestAccessTokenHash: "never-expose", ...extra } });
}
async function payment(appointmentId: string, amount: string, extra: object = {}) {
  return prisma.payment.create({ data: { appointmentId, amount, type: "APPOINTMENT_FEE", method: "CASH", status: "SUCCEEDED", provider: "manual", idempotencyKey: randomUUID(), externalReference: randomUUID(), paidAt: day, createdAt: day, ...extra } });
}

test("collections reconcile exact capture/refund movement without counting carried credits or failed attempts", async () => {
  const admin = await actor(); const original = await appointment({ status: "NO_SHOW" });
  const fee = await payment(original.id, "100.10", { satisfiesObligation: true });
  await appointment({ recoveryOfAppointment: { connect: { id: original.id } }, carriedAppointmentFeePayment: { connect: { id: fee.id } } });
  await payment(original.id, "20.20", { reconciliationStatus: "REQUIRED", reconciliationReason: "Late capture" });
  await payment(original.id, "3.03", { reconciliationStatus: "RESOLVED" });
  await payment(original.id, "500.00", { status: "FAILED", paidAt: null });
  await payment(original.id, "600.00", { status: "PENDING", paidAt: null });
  await payment(original.id, "4.04", { status: "REFUNDED", refundedAt: day });
  await payment(original.id, "5.05", { status: "REFUNDED", paidAt: new Date("2026-10-02T00:00Z"), refundedAt: day });
  await payment(original.id, "6.06", { status: "REFUNDED", refundedAt: new Date("2026-10-06T00:00Z") });
  // Inclusive local start, exclusive next-day start.
  await payment(original.id, "0.01", { paidAt: new Date("2026-10-03T16:00Z") });
  await payment(original.id, "900.00", { paidAt: new Date("2026-10-04T16:00Z") });
  await payment(original.id, "800.00", { paidAt: new Date("2026-10-03T15:59:59.999Z") });
  const result = await reports.collections(admin.id, q);
  assert.deepEqual(result.totals, [{ currency: "PHP", captured: "133.44", refunded: "9.09", netCashMovement: "124.35", successfulApplied: "100.10", successfulUnapplied: "23.24", reconciliationRequired: "20.20" }]);
  const cashier = await actor("CASHIER");
  assert.deepEqual(await reports.collections(cashier.id, q), result);
  assert.equal(JSON.stringify(result).includes("never-expose"), false);
});

test("reports preserve service, receipt and commission snapshots after catalog changes", async () => {
  const admin = await actor(); const a = await appointment();
  const staff = await prisma.staff.create({ data: { firstName: "Historical", lastName: "Staff" } });
  const service = await prisma.service.create({ data: { name: "Old service", price: "50.00", durationMinutes: 30 } });
  const item = await prisma.appointmentService.create({ data: { appointmentId: a.id, staffId: staff.id, serviceId: service.id, assignmentMode: "SPECIFIC", sequenceNo: 1, serviceNameSnapshot: "Old service", priceSnapshot: "50.00", durationMinutesSnapshot: 30, bufferMinutesSnapshot: 0, commissionRateSnapshot: "0.4", scheduledStartAt: a.startAt, scheduledEndAt: a.endAt, reservedUntilAt: a.endAt, outcome: "PERFORMED", actualChargedAmount: "50.00" } });
  const p = await payment(a.id, "50.00", { type: "SERVICE_PAYMENT", satisfiesObligation: true, paidAt: new Date("2026-11-01T00:00Z") });
  await prisma.receipt.create({ data: { paymentId: p.id, receiptNumber: randomUUID(), issuedByUserId: admin.id, issuedAt: day, receiptSnapshot: { name: "Old service", amount: "50.00" } } });
  await prisma.commissionRecord.create({ data: { appointmentId: a.id, appointmentServiceId: item.id, staffId: staff.id, sourcePaymentId: p.id, serviceAmount: "50.00", allocatedAppointmentFee: "0.00", commissionBase: "50.00", commissionRate: "0.4", commissionAmount: "20.00", finalizedByUserId: admin.id, finalizedAt: day } });
  await prisma.service.update({ where: { id: service.id }, data: { name: "New name", price: "999.00", isActive: false } });
  for (const kind of ["appointments", "receipts", "commissions"] as const) {
    const result = await reports.list(admin.id, kind, q);
    assert.match(JSON.stringify(result.rows), /Old service/); assert.doesNotMatch(JSON.stringify(result.rows), /New name|never-expose|999/);
  }
  const dashboard = await reports.dashboard(admin.id, q);
  assert.equal(dashboard.finalizedCommissions, "20.00");
  const first = await reports.list(admin.id, "payments", { ...q, pageSize: 1 });
  const second = await reports.list(admin.id, "payments", { ...q, pageSize: 1, page: 2 });
  assert.equal(first.rows.length, 1); assert.notDeepEqual(first.rows, second.rows); assert.equal(first.total, second.total);
});

test("Admin audit view redacts legacy secrets and report services reject Cashier/private access", async () => {
  const admin = await actor(); const cashier = await actor("CASHIER");
  await prisma.auditLog.create({ data: { actorType: "ADMIN", actorUserId: admin.id, action: "TEST", entityType: "Appointment", entityId: randomUUID(), createdAt: day, beforeData: { guestAccessTokenHash: "secret", nested: { passwordHash: "secret", amount: "1.00" } } } });
  const audit = await reports.list(admin.id, "audit", q);
  assert.doesNotMatch(JSON.stringify(audit), /secret|passwordHash|guestAccessToken/);
  for (const kind of ["appointments", "payments", "receipts", "commissions", "audit"] as const) await assert.rejects(reports.list(cashier.id, kind, q), { code: "FORBIDDEN" });
  await assert.rejects(reports.dashboard(cashier.id, q), { code: "FORBIDDEN" });
  await prisma.user.update({ where: { id: cashier.id }, data: { isActive: false } });
  try { await assert.rejects(reports.collections(cashier.id, q), { code: "UNAUTHORIZED" }); } finally { await prisma.user.update({ where: { id: cashier.id }, data: { isActive: true } }); }
});

test("report HTTP authorization, cache controls, validation and public chatbot boundary", async () => {
  const config = parseEnv({ NODE_ENV: "test", DATABASE_URL: url.toString(), JWT_SECRET: "phase10-test-secret-with-at-least-32-characters", TRUSTED_ORIGINS: "http://localhost:5173" });
  const server = createApp(createApiRouter(prisma, config)).listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}/api`;
  const admin = await actor(); const cashier = await actor("CASHIER"); const tokens = createTokenService(config.JWT_SECRET);
  const cookie = async (id: string, role: "ADMIN" | "CASHIER") => `salon_session=${await tokens.sign({ userId: id, role })}`;
  const adminCookie = await cookie(admin.id, "ADMIN");
  // Stale ADMIN claim must never promote a current Cashier.
  const cashierCookie = await cookie(cashier.id, "ADMIN");
  const query = "?from=2026-10-04&to=2026-10-04";
  try {
    assert.equal((await fetch(`${base}/reports/collections${query}`)).status, 401);
    for (const kind of ["dashboard", "appointments", "payments", "receipts", "commissions", "audit"]) assert.equal((await fetch(`${base}/reports/${kind}${query}`, { headers: { Cookie: cashierCookie } })).status, 403);
    const summary = await fetch(`${base}/reports/collections${query}`, { headers: { Cookie: cashierCookie } }); assert.equal(summary.status, 200); assert.equal(summary.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(`${base}/reports/payments?from=bad`, { headers: { Cookie: adminCookie } })).status, 400);
    const chat = await fetch(`${base}/chatbot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "services and prices" }) });
    assert.equal(chat.status, 200); const reply = await chat.json(); assert.equal(reply.mode, "guided"); assert.doesNotMatch(reply.answer, /New name/);
    const counts = await prisma.appointment.count();
    await fetch(`${base}/chatbot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "confirm an available booking without payment" }) });
    assert.equal(await prisma.appointment.count(), counts);
    const invalid = await fetch(`${base}/chatbot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "hi", guestToken: "secret" }) }); assert.equal(invalid.status, 400);
  } finally { server.close(); await once(server, "close"); }
});
