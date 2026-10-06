import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { before, after, test } from 'node:test';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { Temporal } from '@js-temporal/polyfill';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { createDatabasePool } from '../../src/database/pool.js';
import { createApp } from '../../src/app/app.js';
import { createApiRouter } from '../../src/app/routes.js';
import { parseEnv } from '../../src/config/env.schema.js';
import { bootstrapAdmin } from '../../src/modules/users/bootstrap.service.js';
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) throw new Error('TEST_DATABASE_ADMIN_URL is required.');
const name = `salon_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(adminUrl); url.pathname = `/${name}`; url.searchParams.delete('schema');
const admin = new Pool({ connectionString: adminUrl });
const pool = createDatabasePool(url.toString());
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const run = promisify(execFile);
const fixtureEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url.toString(), SEED_ADMIN_EMAIL: 'admin@example.test', SEED_ADMIN_PASSWORD: 'release-test-password', SEED_CASHIER_EMAIL: 'cashier@example.test', SEED_CASHIER_PASSWORD: 'release-test-password' };
let created = false;
before(async () => {
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'prisma7.config.ts'], { env: fixtureEnv });
});
after(async () => {
  await prisma.$disconnect(); await pool.end();
  if (created) {
    for (let i = 0; i < 100 && (await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1', [name])).rowCount; i++) await delay(20);
    await admin.query(`DROP DATABASE "${name}"`);
  }
  await admin.end();
});

test('first Admin bootstrap validates inputs, serializes concurrent runs and refuses existing users', async () => {
  const input = { email: ' FIRST@example.test ', password: 'release-bootstrap-password', firstName: 'First', lastName: 'Admin' };
  await assert.rejects(bootstrapAdmin(prisma, { ...input, password: 'short' }));
  assert.equal(await prisma.user.count(), 0);
  const attempts = await Promise.allSettled([bootstrapAdmin(prisma, input), bootstrapAdmin(prisma, input)]);
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await prisma.user.count(), 1);
  const first = await prisma.user.findFirstOrThrow();
  assert.equal(first.email, 'first@example.test'); assert.equal(first.role, 'ADMIN');
  assert.ok(await bcrypt.compare(input.password, first.passwordHash));
  const audit = await prisma.auditLog.findFirstOrThrow();
  assert.equal(audit.action, 'ADMIN_BOOTSTRAPPED');
  assert.doesNotMatch(JSON.stringify(audit), /password|\$2b\$/);
  await assert.rejects(bootstrapAdmin(prisma, { ...input, email: 'second@example.test' }));
  // Only this suite's disposable bootstrap records, before normal development seeding.
  await prisma.auditLog.deleteMany(); await prisma.user.deleteMany();
  await run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { env: fixtureEnv });
});

test('integrated HTTP acceptance: 20 competing bookings, authenticated collections, idempotent settlement and reports', { timeout: 90000 }, async () => {
  const origin = 'https://salon.example.test';
  const config = parseEnv({ NODE_ENV: 'production', DATABASE_URL: url.toString(), JWT_SECRET: 'release-test-jwt-secret-at-least-32-characters', TRUSTED_ORIGINS: origin });
  const server = createApp(createApiRouter(prisma, config)).listen(0, '127.0.0.1');
  await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  async function request(path: string, body?: unknown, cookie = '', requestOrigin = origin) {
    return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function ok(path: string, body?: unknown, cookie = '') {
    const response = await request(path, body, cookie); const data = await response.json();
    assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`); return data;
  }
  async function login(email: string) {
    const response = await request('/auth/login', { email, password: fixtureEnv.SEED_ADMIN_PASSWORD }); assert.equal(response.status, 200);
    const header = response.headers.get('set-cookie')!;
    assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Lax/);
    return header.split(';')[0]!;
  }
  try {
    assert.equal((await request('/ready')).status, 200);
    const cashier = await login(fixtureEnv.SEED_CASHIER_EMAIL); const manager = await login(fixtureEnv.SEED_ADMIN_EMAIL);
    assert.equal((await request('/reports/audit?from=2026-10-01&to=2026-10-31', undefined, cashier)).status, 403);
    assert.equal((await request('/auth/logout', {}, cashier, 'https://untrusted.example')).status, 403);
    const service = await prisma.service.findFirstOrThrow({ where: { name: 'Ladies Haircut' } });
    const staff = await prisma.staff.findFirstOrThrow({ orderBy: { id: 'asc' } });
    const date = Temporal.Now.zonedDateTimeISO('Asia/Manila').add({ days: 3 }).toPlainDate().toString();
    const services = [{ serviceId: service.id, staffId: staff.id, assignmentMode: 'SPECIFIC' }];
    const available = await ok('/availability', { date, services }); assert.ok(available.slots.length);
    const body = { date, services, startAt: available.slots[0].startAt, customer: { firstName: 'Release', lastName: 'Guest', phone: '09000000000' } };
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: 20 }, () => request('/appointments', body)));
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.ok(responses.every(r => r.status === 201 || r.status === 409));
    console.info(`Release booking burst: 20 requests, one winner, ${Math.round(performance.now() - started)} ms`);
    const booked = await responses.find(r => r.status === 201)!.json();
    const bookingCode = booked.appointment.bookingCode;
    assert.equal(await prisma.appointment.count(), 1); assert.equal(await prisma.customer.count(), 1);
    assert.equal((await request('/appointments/access', { bookingCode, token: 'a'.repeat(43) })).status, 404);
    await ok('/payments/manual', { bookingCode, amount: '100.00', currency: 'PHP', method: 'CASH', idempotencyKey: randomUUID(), externalReference: 'acceptance-fee' }, cashier);
    const access = await ok('/appointments/access', { bookingCode, token: booked.guestToken }); assert.equal(access.appointment.status, 'CONFIRMED');
    const review = (await ok('/settlement/lookup', { bookingCode }, cashier)).appointment;
    const saved = (await ok('/settlement/outcomes', { bookingCode, revision: review.revision, services: review.services.map((s: { id: string }) => ({ id: s.id, outcome: 'PERFORMED' })) }, cashier)).appointment;
    const payment = { bookingCode, revision: saved.revision, amount: saved.amountDue, currency: 'PHP', method: 'CASH', idempotencyKey: randomUUID(), externalReference: 'acceptance-service' };
    assert.equal((await request('/settlement/pay', payment, manager)).status, 403);
    const settled = await Promise.all(Array.from({ length: 10 }, () => ok('/settlement/pay', payment, cashier)));
    assert.ok(settled.every(r => r.appointment.status === 'COMPLETED'));
    assert.equal(await prisma.payment.count(), 2); assert.equal(await prisma.receipt.count(), 2); assert.equal(await prisma.commissionRecord.count(), 1);
    const today = Temporal.Now.zonedDateTimeISO('Asia/Manila').toPlainDate().toString();
    const report = await ok(`/reports/collections?from=${today}&to=${today}`, undefined, cashier);
    assert.equal(report.totals[0].captured, '220.00');
    assert.equal((await request('/auth/logout', {}, cashier)).status, 204);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
