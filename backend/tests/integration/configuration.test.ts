import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { before, after, afterEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { createDatabasePool } from "../../src/database/pool.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Temporal } from "@js-temporal/polyfill";
import { PrismaClient } from "../../generated/prisma/client.js";
import { createConfigurationService } from "../../src/modules/configuration/configuration.service.js";
import { createApiRouter } from "../../src/app/routes.js";
import { createApp } from "../../src/app/app.js";
import { createTokenService } from "../../src/modules/auth/auth.token.js";
import { parseEnv } from "../../src/config/env.schema.js";
import { ApiError } from "../../src/shared/http.js";
import { days } from "../../src/modules/configuration/configuration.schema.js";
import { SALON_COORDINATION_KEY, freshTime } from "../../src/modules/scheduling/coordination.js";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error("TEST_DATABASE_ADMIN_URL is required for disposable PostgreSQL tests.");
const dbName = `salon_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(adminUrl); url.pathname = `/${dbName}`; url.searchParams.delete("schema");
const adminPool = new Pool({ connectionString: adminUrl });
const pool = createDatabasePool(url.toString(), { application_name: "phase3-configuration" });
const observer = new Pool({ connectionString: url.toString(), application_name: "phase3-observer" });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const service = createConfigurationService(prisma, "Asia/Manila");
const run = promisify(execFile);
let adminId = "";
let cashierId = "";
let created = false;
before(async () => {
  await adminPool.query(`CREATE DATABASE "${dbName}"`); created = true;
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: url.toString(), SEED_ADMIN_EMAIL: "admin@example.test", SEED_ADMIN_PASSWORD: "phase3-admin-password", SEED_CASHIER_EMAIL: "cashier@example.test", SEED_CASHIER_PASSWORD: "phase3-cashier-password" };
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "prisma7.config.ts"], { env });
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env });
  adminId = (await prisma.user.findUniqueOrThrow({ where: { email: env.SEED_ADMIN_EMAIL } })).id;
  cashierId = (await prisma.user.findUniqueOrThrow({ where: { email: env.SEED_CASHIER_EMAIL } })).id;
}, { timeout: 90_000 });
afterEach(async () => { await prisma.appointment.updateMany({ data: { status: "CANCELLED" } }); });
after(async () => {
  await prisma.$disconnect(); await pool.end(); await observer.end();
  try {
    if (created) {
      // Pool.end() can resolve before PostgreSQL observes each socket closing.
      // Wait for disconnection instead of force-terminating closing clients.
      await waitUntil(async () => (await adminPool.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [dbName])).rowCount === 0);
      await adminPool.query(`DROP DATABASE "${dbName}"`);
    }
  }
  finally { await adminPool.end(); }
});

async function fixture(status: "CONFIRMED" | "PENDING_PAYMENT" = "CONFIRMED", holdExpiresAt = new Date(Date.now() + 60_000)) {
  const staff = await prisma.staff.create({ data: { firstName: "Fixture", lastName: randomUUID() } });
  const item = await prisma.service.create({ data: { name: "Fixture service", price: "120.00", durationMinutes: 30, bufferMinutes: 15 } });
  const qualification = await prisma.staffService.create({ data: { staffId: staff.id, serviceId: item.id, commissionRate: "0.4000" } });
  const day = Temporal.Now.zonedDateTimeISO("Asia/Manila").add({ days: 7 }).with({ hour: 9, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  const startAt = new Date(day.epochMilliseconds);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);
  const reservedUntilAt = new Date(startAt.getTime() + 45 * 60_000);
  const weekday = days[day.dayOfWeek - 1]!;
  const schedule = await prisma.staffSchedule.create({ data: { staffId: staff.id, dayOfWeek: weekday, startTime: new Date("1970-01-01T08:00Z"), endTime: new Date("1970-01-01T22:00Z") } });
  const policy = await prisma.bookingPolicyVersion.findFirstOrThrow({ orderBy: { version: "asc" } });
  const booking = await prisma.appointment.create({ data: {
    bookingCode: randomUUID(), customer: { create: { firstName: "Test", lastName: "Guest", phone: "0" } },
    bookingPolicyVersion: { connect: { id: policy.id } }, status, startAt, endAt, appointmentFeeAmount: "100.00", holdExpiresAt, guestAccessTokenHash: "test",
    appointmentServices: { create: { serviceId: item.id, staffId: staff.id, assignmentMode: "SPECIFIC", sequenceNo: 1, serviceNameSnapshot: item.name,
      priceSnapshot: "120.00", durationMinutesSnapshot: 30, bufferMinutesSnapshot: 15, commissionRateSnapshot: "0.4000", scheduledStartAt: startAt, scheduledEndAt: endAt, reservedUntilAt } },
  }, include: { appointmentServices: true } });
  return { staff, item, qualification, schedule, weekday, policy, booking, startAt, endAt, reservedUntilAt };
}
async function expectConflict(operation: Promise<unknown>, bookingId: string) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof ApiError); assert.equal(error.code, "RESERVATION_CONFLICT");
    assert.ok(JSON.stringify(error.details).includes(bookingId)); return true;
  });
}
async function waitUntil(check: () => Promise<boolean>, limit = 3000) {
  const end = Date.now() + limit;
  while (!await check()) { if (Date.now() >= end) throw new Error("Database coordination test timed out."); await delay(20); }
}
async function writerBlocked() {
  await waitUntil(async () => (await observer.query("SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND application_name = 'phase3-configuration' AND wait_event_type = 'Lock'", [dbName])).rowCount! > 0);
}

test("profile stays singular and configuration changes keep historical snapshots", async () => {
  const f = await fixture();
  const old = await prisma.salonProfile.findFirstOrThrow();
  await Promise.all([
    service.saveProfile(adminId, { name: "Salon A", address: "Address", phone: null, email: null }),
    service.saveProfile(adminId, { name: "Salon B", address: "Address", phone: null, email: null }),
  ]);
  assert.equal(await prisma.salonProfile.count(), 1);
  assert.equal((await prisma.salonProfile.findFirstOrThrow()).id, old.id);
  await service.saveService(adminId, { name: "New name", description: null, price: "200.00", durationMinutes: 60, bufferMinutes: 0, isActive: true }, f.item.id);
  await service.saveQualification(adminId, { staffId: f.staff.id, serviceId: f.item.id, commissionRate: "0.5000", isActive: true }, f.qualification.id);
  const historical = await prisma.appointmentService.findUniqueOrThrow({ where: { id: f.booking.appointmentServices[0]!.id } });
  assert.equal(historical.priceSnapshot.toFixed(2), "120.00");
  assert.equal(historical.bufferMinutesSnapshot, 15); assert.equal(historical.durationMinutesSnapshot, 30);
  assert.equal(historical.commissionRateSnapshot.toFixed(4), "0.4000");
  assert.equal(historical.serviceNameSnapshot, "Fixture service");
  assert.ok(await prisma.auditLog.count({ where: { entityId: f.item.id } }));
});

test("staff, service, and qualification deactivation roll back when reservations would be invalidated", async () => {
  const f = await fixture(); const count = await prisma.auditLog.count();
  await expectConflict(service.saveStaff(adminId, { firstName: "Fixture", lastName: "Changed", phone: null, isActive: false }, f.staff.id), f.booking.id);
  await expectConflict(service.saveService(adminId, { name: f.item.name, description: null, price: "120.00", durationMinutes: 30, bufferMinutes: 15, isActive: false }, f.item.id), f.booking.id);
  await expectConflict(service.saveQualification(adminId, { staffId: f.staff.id, serviceId: f.item.id, commissionRate: "0.4000", isActive: false }, f.qualification.id), f.booking.id);
  assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id: f.staff.id } })).isActive, true);
  assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: f.item.id } })).isActive, true);
  assert.equal(await prisma.auditLog.count(), count);
});

test("hours and schedules cover the full reservation including buffer, dates, and alternative shifts", async () => {
  const f = await fixture();
  const hours = await prisma.salonOperatingHour.findFirstOrThrow({ where: { dayOfWeek: f.weekday } });
  await expectConflict(service.saveHours(adminId, { dayOfWeek: f.weekday, openTime: "08:00", closeTime: "09:30", isActive: true }, hours.id), f.booking.id);
  const input = { staffId: f.staff.id, dayOfWeek: f.weekday, startTime: "08:00", endTime: "09:30", effectiveFrom: null, effectiveTo: null, isActive: true };
  await expectConflict(service.saveSchedule(adminId, input, f.schedule.id), f.booking.id);
  await service.saveSchedule(adminId, { ...input, startTime: "09:30", endTime: "10:00" });
  await service.saveSchedule(adminId, input, f.schedule.id);
  await expectConflict(service.saveSchedule(adminId, { ...input, effectiveFrom: "9999-01-01" }, f.schedule.id), f.booking.id);
});

test("closures/time off reject buffer overlaps but permit adjacent periods; removal preserves audit history", async () => {
  const f = await fixture();
  const input = { startsAt: new Date(f.endAt.getTime() + 60_000), endsAt: new Date(f.reservedUntilAt.getTime() + 60_000), reason: "Test closure" };
  await expectConflict(service.saveClosure(adminId, input), f.booking.id);
  await expectConflict(service.saveUnavailability(adminId, { ...input, staffId: f.staff.id }), f.booking.id);
  const row = await service.saveClosure(adminId, { ...input, startsAt: f.reservedUntilAt });
  await service.removeClosure(adminId, row.id);
  assert.equal(await prisma.salonClosure.findUnique({ where: { id: row.id } }), null);
  assert.equal(await prisma.auditLog.count({ where: { entityId: row.id } }), 2);
  const absence = await service.saveUnavailability(adminId, { ...input, startsAt: f.reservedUntilAt, staffId: f.staff.id });
  await service.removeUnavailability(adminId, absence.id);
  assert.equal(await prisma.auditLog.count({ where: { entityId: absence.id } }), 2);
});

test("expired holds and terminal/removed reservations do not prevent prospective configuration", async () => {
  const f = await fixture("PENDING_PAYMENT", new Date(Date.now() - 1000));
  await service.saveStaff(adminId, { firstName: f.staff.firstName, lastName: f.staff.lastName, phone: null, isActive: false }, f.staff.id);
  const g = await fixture();
  await prisma.appointmentService.updateMany({ where: { appointmentId: g.booking.id }, data: { membershipStatus: "REMOVED", removedAt: new Date() } });
  await service.saveStaff(adminId, { firstName: "Removed", lastName: "History", phone: null, isActive: false }, g.staff.id);
  assert.equal(await prisma.appointmentService.count({ where: { appointmentId: g.booking.id } }), 1);
});

test("fresh database clock preserves the instant in a non-UTC PostgreSQL session", async () => {
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Manila'`;
    const time = await freshTime(tx);
    const actual = (await observer.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
    assert.ok(Math.abs(actual.getTime() - time.getTime()) < 2000);
  });
});

test("Prisma persists the actual instant rather than a server-local wall time", async () => {
  const f = await fixture();
  const stored = (await observer.query('SELECT "startAt", "holdExpiresAt" FROM "Appointment" WHERE id=$1', [f.booking.id])).rows[0];
  assert.equal(stored.startAt.toISOString(), f.startAt.toISOString());
  assert.equal(stored.holdExpiresAt.toISOString(), f.booking.holdExpiresAt!.toISOString());
  assert.equal((await pool.query('SHOW TimeZone')).rows[0].TimeZone, "UTC");
});

test("an active payment hold prevents configuration changes before its deadline", async () => {
  const f = await fixture("PENDING_PAYMENT", new Date(Date.now() + 60_000));
  await expectConflict(service.saveClosure(adminId, { startsAt: f.startAt, endsAt: f.reservedUntilAt, reason: null }), f.booking.id);
});

test("policy versions are prospective, fixed-fee, unique, and leave existing references unchanged", async () => {
  const f = await fixture(); const original = f.booking.bookingPolicyVersionId;
  const input = { appointmentFeeType: "FIXED" as const, appointmentFeeAmount: "150.00", bookingHoldMinutes: 10, defaultBufferMinutes: 20, maxReschedules: 2, rescheduleCutoffHours: 4, cancellationCutoffHours: 4, noShowGraceHours: 72, advanceBookingDays: 30, minimumBookingLeadMinutes: 60, effectiveFrom: null };
  const row = await service.createPolicy(adminId, input);
  assert.ok(row.version > f.policy.version);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: f.booking.id } })).bookingPolicyVersionId, original);
  await assert.rejects(service.createPolicy(adminId, { ...input, effectiveFrom: new Date(0) }), { code: "POLICY_IN_PAST" });
  const when = new Date(Date.now() + 60_000);
  await service.createPolicy(adminId, { ...input, effectiveFrom: when });
  await assert.rejects(service.createPolicy(adminId, { ...input, effectiveFrom: when }), { code: "CONFIGURATION_EXISTS" });
});

test("an exclusive configuration writer waits for a reservation and sees its committed state", async () => {
  const f = await fixture();
  await prisma.appointment.update({ where: { id: f.booking.id }, data: { status: "CANCELLED" } });
  const blocker = await observer.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock_shared($1)", [SALON_COORDINATION_KEY]);
    await blocker.query('SELECT id FROM "Staff" WHERE id=$1 FOR UPDATE', [f.staff.id]);
    await blocker.query('UPDATE "Appointment" SET status=\'CONFIRMED\' WHERE id=$1', [f.booking.id]);
    pending = expectConflict(service.saveClosure(adminId, { startsAt: f.startAt, endsAt: f.reservedUntilAt, reason: "Concurrent" }), f.booking.id);
    await writerBlocked(); await blocker.query("COMMIT"); await pending;
  } finally { await blocker.query("ROLLBACK"); blocker.release(); if (pending) await pending; }
});

test("Staff lock waits use a fresh database clock after hold expiration", async () => {
  const f = await fixture("PENDING_PAYMENT");
  const blocker = await observer.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("BEGIN"); await blocker.query("SELECT pg_advisory_xact_lock_shared($1)", [SALON_COORDINATION_KEY]);
    await blocker.query('SELECT id FROM "Staff" WHERE id=$1 FOR UPDATE', [f.staff.id]);
    await prisma.appointment.update({ where: { id: f.booking.id }, data: { holdExpiresAt: new Date(Date.now() + 1500) } });
    pending = service.saveStaff(adminId, { firstName: "Expired", lastName: "Hold", phone: null, isActive: false }, f.staff.id);
    await writerBlocked();
    assert.equal((await observer.query('SELECT "holdExpiresAt" > clock_timestamp() AS active FROM "Appointment" WHERE id=$1', [f.booking.id])).rows[0].active, true);
    await waitUntil(async () => (await observer.query('SELECT "holdExpiresAt" < clock_timestamp() AS expired FROM "Appointment" WHERE id=$1', [f.booking.id])).rows[0].expired);
    await blocker.query("COMMIT"); await pending;
    assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id: f.staff.id } })).isActive, false);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); if (pending) await pending; }
});

test("public APIs expose only public configuration; Admin API enforces roles, CSRF, and immutable policies", async () => {
  const config = parseEnv({ DATABASE_URL: url.toString(), JWT_SECRET: "phase3-test-secret-at-least-32-characters", NODE_ENV: "test" });
  const tokens = createTokenService(config.JWT_SECRET);
  const adminCookie = `salon_session=${await tokens.sign({ userId: adminId, role: "ADMIN" })}`;
  const cashierCookie = `salon_session=${await tokens.sign({ userId: cashierId, role: "CASHIER" })}`;
  const server = createApp(createApiRouter(prisma, config)).listen(0, "127.0.0.1");
  await once(server, "listening"); const address = server.address(); assert.ok(address && typeof address !== "string");
  const request = (path: string, method = "GET", cookie = "", body?: unknown, origin = "http://localhost:5173") => fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const catalog = await request("/services"); assert.equal(catalog.status, 200);
    const publicData = await catalog.text(); assert.ok(!publicData.includes("commissionRate"));
    const salon = await (await request("/salon")).json(); assert.equal(salon.timeZone, "Asia/Manila"); assert.ok(!JSON.stringify(salon).includes("createdByUserId"));
    assert.equal((await request("/configuration")).status, 401);
    assert.equal((await request("/configuration", "GET", cashierCookie)).status, 403);
    assert.equal((await request("/configuration", "GET", adminCookie)).status, 200);
    const body = { name: "API service", price: "120.00", description: null, durationMinutes: 30, bufferMinutes: 0, isActive: true };
    assert.equal((await request("/configuration/services", "POST", cashierCookie, body)).status, 403);
    assert.equal((await request("/configuration/services", "POST", adminCookie, body, "https://evil.example")).status, 403);
    assert.equal((await request("/configuration/services", "POST", adminCookie, { ...body, price: 120 })).status, 400);
    const created = await request("/configuration/services", "POST", adminCookie, body); assert.equal(created.status, 201);
    const id = (await created.json()).record.id;
    assert.equal((await request(`/configuration/services/${id}`, "PUT", adminCookie, { ...body, isActive: false })).status, 200);
    assert.ok(!(await (await request("/services")).json()).services.some((s: { id: string }) => s.id === id));
    assert.equal((await request(`/configuration/services/${id}`, "DELETE", adminCookie)).status, 404);
    const policy = await prisma.bookingPolicyVersion.findFirstOrThrow();
    assert.equal((await request(`/configuration/policies/${policy.id}`, "PUT", adminCookie, {})).status, 404);
    const f = await fixture();
    const conflict = await request("/configuration/closures", "POST", adminCookie, { startsAt: f.startAt.toISOString(), endsAt: f.reservedUntilAt.toISOString(), reason: null });
    assert.equal(conflict.status, 409); assert.ok((await conflict.json()).error.details.appointments.some((a: { appointmentId: string }) => a.appointmentId === f.booking.id));
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
