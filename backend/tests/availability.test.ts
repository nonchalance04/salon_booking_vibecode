import assert from "node:assert/strict";
import { test } from "node:test";
import { availabilitySchema, type AvailabilityInput } from "../src/modules/availability/availability.schema.js";
import { calculateAvailability, planAt, isBlocking, localDay, policyBounds, type AvailabilityData, type Reservation } from "../src/modules/availability/availability.engine.js";
const at = (time: string) => new Date(`2026-10-05T${time}:00+08:00`);
const clock = (time: string) => new Date(`1970-01-01T${time}:00Z`);
const input: AvailabilityInput = { date: "2026-10-05", services: [{ serviceId: "s1", assignmentMode: "ANY_AVAILABLE" }] };
function data(): AvailabilityData {
  return { now: at("07:00"), timeZone: "Asia/Manila", policy: { defaultBufferMinutes: 15, minimumBookingLeadMinutes: 60, advanceBookingDays: 30 },
    services: [{ id: "s1", name: "Cut", durationMinutes: 30, bufferMinutes: null }, { id: "s2", name: "Color", durationMinutes: 60, bufferMinutes: 0 }],
    staff: [{ id: "a", firstName: "A", lastName: "Stylist" }, { id: "b", firstName: "B", lastName: "Stylist" }],
    qualifications: [{ staffId: "a", serviceId: "s1" }, { staffId: "b", serviceId: "s1" }, { staffId: "a", serviceId: "s2" }],
    hours: [{ dayOfWeek: "MONDAY", startTime: clock("08:00"), endTime: clock("18:00") }],
    schedules: ["a", "b"].map(staffId => ({ staffId, dayOfWeek: "MONDAY", startTime: clock("08:00"), endTime: clock("18:00") })),
    closures: [], unavailability: [], reservations: [] };
}
function reservation(status = "CONFIRMED", start = "09:00", end = "09:45"): Reservation {
  return { staffId: "a", scheduledStartAt: at(start), reservedUntilAt: at(end), membershipStatus: "ACTIVE", appointment: { status, holdExpiresAt: at("07:00") } };
}
const specific: AvailabilityInput = { ...input, services: [{ serviceId: "s1", assignmentMode: "SPECIFIC", staffId: "a" }] };

test("strict input requires a real local date, UUIDs, and explicit staff-selection modes", () => {
  const valid = { date: "2026-10-05", services: [{ serviceId: "12345678-1234-4234-8234-123456789abc", assignmentMode: "ANY_AVAILABLE" }] };
  assert.equal(availabilitySchema.safeParse(valid).success, true);
  for (const value of [{ ...valid, date: "2026-02-30" }, { ...valid, services: [] }, { ...valid, ignored: true },
    { ...valid, startAt: "2026-10-05T09:00:00" }, { ...valid, services: Array(21).fill(valid.services[0]) },
    { ...valid, services: [{ ...valid.services[0], assignmentMode: "SPECIFIC" }] }, { ...valid, services: [{ ...valid.services[0], staffId: "x" }] }]) {
    assert.equal(availabilitySchema.safeParse(value).success, false);
  }
});
test("buffers use policy fallback but preserve explicit zero and enforce closing time", () => {
  const d = data();
  assert.equal(planAt(input, at("17:15"), d)?.services[0]?.reservedUntilAt, at("18:00").toISOString());
  assert.equal(planAt(input, at("17:16"), d), null);
  d.services[0]!.bufferMinutes = 0;
  assert.ok(planAt(input, at("17:30"), d));
  assert.equal(planAt(input, at("17:31"), d), null);
  d.services[0]!.durationMinutes = 2_147_483_647;
  assert.equal(planAt(input, at("09:00"), d), null);
});
test("lead time and advance boundaries are inclusive and based on fresh now", () => {
  const d = data();
  assert.ok(planAt(input, at("08:00"), d));
  assert.equal(planAt(input, new Date(at("08:00").getTime() - 1), d), null);
  d.policy.minimumBookingLeadMinutes = 0; d.now = at("09:00");
  assert.ok(planAt(input, at("09:00"), d));
  assert.equal(planAt(input, at("08:59"), d), null);
  d.now = new Date("2026-09-05T09:00:00+08:00");
  assert.ok(planAt(input, at("09:00"), d));
  assert.equal(planAt(input, new Date(at("09:00").getTime() + 1), d), null);
});
test("full interval coverage includes split shifts, inclusive effective dates and time off", () => {
  const d = data(); d.schedules = [
    { staffId: "a", dayOfWeek: "MONDAY", startTime: clock("09:00"), endTime: clock("09:30"), effectiveFrom: new Date("2026-10-05"), effectiveTo: new Date("2026-10-05") },
    { staffId: "a", dayOfWeek: "MONDAY", startTime: clock("09:30"), endTime: clock("10:00") },
  ];
  assert.ok(planAt(specific, at("09:00"), d));
  d.schedules[1]!.startTime = clock("09:31"); assert.equal(planAt(specific, at("09:00"), d), null);
  d.schedules[1]!.startTime = clock("09:30"); d.schedules[0]!.effectiveFrom = new Date("2026-10-06");
  assert.equal(planAt(specific, at("09:00"), d), null);
  d.schedules = data().schedules;
  d.unavailability = [{ staffId: "a", startsAt: at("09:44"), endsAt: at("10:00") }];
  assert.equal(planAt(specific, at("09:00"), d), null);
  assert.equal(planAt(input, at("09:00"), d)?.services[0]?.staffId, "b");
  d.closures = [{ startsAt: at("09:45"), endsAt: at("10:00") }];
  assert.ok(planAt(input, at("09:00"), d));
  d.closures[0]!.startsAt = at("09:44"); assert.equal(planAt(input, at("09:00"), d), null);
});
test("reservation adjacency uses reserved end; other staff remain available", () => {
  const d = data(); d.reservations = [reservation()];
  assert.equal(planAt(specific, at("09:44"), d), null);
  assert.ok(planAt(specific, at("09:45"), d));
  assert.ok(planAt(specific, at("08:15"), d));
  assert.equal(planAt(input, at("09:00"), d)?.services[0]?.staffId, "b");
});
test("blocking includes hold deadline equality and early completion, excluding expired/removed rows", () => {
  const d = data();
  for (const status of ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"]) {
    const row = reservation(status); assert.equal(isBlocking(row, d.now), true);
    d.reservations = [row]; assert.equal(planAt(specific, at("09:00"), d), null);
  }
  const hold = reservation("PENDING_PAYMENT");
  assert.equal(isBlocking(hold, new Date(d.now.getTime() + 1)), false);
  hold.appointment.holdExpiresAt = null; assert.equal(isBlocking(hold, d.now), false);
  for (const status of ["CANCELLED", "NO_SHOW", "EXPIRED"]) assert.equal(isBlocking(reservation(status), d.now), false);
  assert.equal(isBlocking({ ...reservation(), membershipStatus: "REMOVED" }, d.now), false);
  assert.equal(isBlocking(reservation("COMPLETED"), at("09:45")), false);
});
test("ANY_AVAILABLE ranks clipped target-day workload then ID; completed intervals do not count as workload", () => {
  const d = data(); d.staff.reverse();
  assert.equal(planAt(input, at("10:00"), d)?.services[0]?.staffId, "a");
  d.reservations = [reservation("CONFIRMED", "15:00", "16:00")];
  assert.equal(planAt(input, at("10:00"), d)?.services[0]?.staffId, "b");
  d.reservations[0]!.appointment.status = "COMPLETED";
  assert.equal(planAt(input, at("10:00"), d)?.services[0]?.staffId, "a");
  d.reservations = [{ ...reservation(), scheduledStartAt: new Date("2026-10-04T00:00+08:00"), reservedUntilAt: at("00:15") },
    { ...reservation("CONFIRMED", "15:00", "15:30"), staffId: "b" }];
  assert.equal(planAt(input, at("10:00"), d)?.services[0]?.staffId, "a");
  d.reservations[0]!.appointment.status = "PENDING_PAYMENT";
  d.reservations[0]!.appointment.holdExpiresAt = new Date(d.now.getTime() - 1);
  assert.equal(planAt(input, at("10:00"), d)?.services[0]?.staffId, "a");
});
test("complete multi-service plan includes sequential buffers and qualified staff for every interval", () => {
  const d = data();
  const multi: AvailabilityInput = { ...input, services: [...input.services, { serviceId: "s2", assignmentMode: "ANY_AVAILABLE" }] };
  const plan = planAt(multi, at("09:00"), d)!;
  assert.equal(plan.services.length, 2); assert.equal(plan.services[1]!.startAt, at("09:45").toISOString());
  assert.equal(plan.endAt, at("10:45").toISOString()); assert.equal(plan.services[1]!.staffId, "a");
  d.unavailability = [{ staffId: "a", startsAt: at("10:00"), endsAt: at("11:00") }];
  assert.equal(planAt(multi, at("09:00"), d), null);
  d.qualifications.push({ staffId: "b", serviceId: "s2" });
  assert.equal(planAt(multi, at("09:00"), d)?.services[1]?.staffId, "b");
  d.staff = []; assert.equal(planAt(multi, at("09:00"), d), null);
});
test("enumeration stays within the salon date, supports exact times and DST days", () => {
  const d = data(); const slots = calculateAvailability(input, d);
  assert.equal(slots[0]?.startAt, at("08:00").toISOString()); assert.equal(slots.at(-1)?.startAt, at("17:15").toISOString());
  assert.equal(calculateAvailability({ ...input, startAt: "2026-10-05T09:00:30+08:00" }, d)[0]?.startAt, "2026-10-05T01:00:30.000Z");
  const spring = localDay("2026-03-08", "America/New_York"); assert.equal((+spring.end - +spring.start) / 3_600_000, 23);
  const fall = localDay("2026-11-01", "America/New_York"); assert.equal((+fall.end - +fall.start) / 3_600_000, 25);
  const bounds = policyBounds({ ...d, timeZone: "America/New_York", now: new Date("2026-03-07T12:00:00-05:00"), policy: { ...d.policy, advanceBookingDays: 1 } });
  assert.equal(bounds.latest.toISOString(), "2026-03-08T16:00:00.000Z");
});
