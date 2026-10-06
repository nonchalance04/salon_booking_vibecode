import assert from "node:assert/strict";
import { test } from "node:test";
import { validateChangeEligibility } from "../src/modules/appointments/appointment-changes.service.js";
import { changeSchema, changeSearchSchema } from "../src/modules/appointments/appointments.schema.js";
const startAt = new Date("2026-10-10T04:00:00Z");
const row = { status: "CONFIRMED", startAt, rescheduleCount: 0, recoveryAppointment: null,
  bookingPolicyVersion: { maxReschedules: 2, rescheduleCutoffHours: 4, noShowGraceHours: 72 } };
test("reschedule and recovery boundaries include equality and reject one millisecond late", () => {
  validateChangeEligibility(row, false, new Date(+startAt - 4 * 3_600_000));
  assert.throws(() => validateChangeEligibility(row, false, new Date(+startAt - 4 * 3_600_000 + 1)));
  const missed = { ...row, status: "NO_SHOW" };
  validateChangeEligibility(missed, true, new Date(+startAt + 72 * 3_600_000));
  assert.throws(() => validateChangeEligibility(missed, true, new Date(+startAt + 72 * 3_600_000 + 1)));
  assert.throws(() => validateChangeEligibility({ ...missed, recoveryAppointment: {} }, true, startAt));
  assert.throws(() => validateChangeEligibility({ ...row, rescheduleCount: 2 }, false, new Date(0)));
  assert.throws(() => validateChangeEligibility(row, true, startAt));
});
test("change validation prevents duplicate retained identities, recovery retention, and forged fields", () => {
  const selection = { serviceId: "00000000-0000-4000-8000-000000000001", appointmentServiceId: "00000000-0000-4000-8000-000000000002", assignmentMode: "ANY_AVAILABLE" };
  const input = { bookingCode: `SL-${"A".repeat(24)}`, token: "a".repeat(43), date: "2026-10-10", recovery: false, services: [selection] };
  assert.equal(changeSearchSchema.safeParse(input).success, true);
  assert.equal(changeSchema.safeParse({ ...input, startAt: startAt.toISOString() }).success, true);
  assert.equal(changeSchema.safeParse({ ...input, services: [selection, selection], startAt: startAt.toISOString() }).success, false);
  assert.equal(changeSearchSchema.safeParse({ ...input, recovery: true }).success, false);
  assert.equal(changeSearchSchema.safeParse({ ...input, priceSnapshot: "1.00" }).success, false);
  assert.equal(changeSearchSchema.safeParse({ ...input, services: [{ ...selection, assignmentMode: "SPECIFIC" }] }).success, false);
});
