import { Temporal } from "@js-temporal/polyfill";
import { coversIntervals, reservationWindows, overlaps, type WeeklyWindow } from "../scheduling/coverage.js";
import type { AvailabilityInput } from "./availability.schema.js";

export type Reservation = {
  staffId: string; scheduledStartAt: Date; reservedUntilAt: Date; membershipStatus: string;
  appointment: { status: string; holdExpiresAt: Date | null };
};
export type AvailabilityData = {
  now: Date; timeZone: string;
  policy: { defaultBufferMinutes: number; minimumBookingLeadMinutes: number; advanceBookingDays: number };
  services: { id: string; name: string; durationMinutes: number; bufferMinutes: number | null }[];
  serviceOverrides?: ({ name: string; durationMinutes: number; bufferMinutes: number } | undefined)[];
  staff: { id: string; firstName: string; lastName: string }[];
  qualifications: { staffId: string; serviceId: string }[];
  hours: WeeklyWindow[];
  schedules: (WeeklyWindow & { staffId: string })[];
  closures: { startsAt: Date; endsAt: Date }[];
  unavailability: { staffId: string; startsAt: Date; endsAt: Date }[];
  reservations: Reservation[];
};
export function isBlocking(row: Reservation, now: Date) {
  return row.membershipStatus === "ACTIVE" && (row.appointment.status === "CONFIRMED" ||
    (row.appointment.status === "COMPLETED" && row.reservedUntilAt > now) ||
    (row.appointment.status === "PENDING_PAYMENT" && row.appointment.holdExpiresAt !== null && row.appointment.holdExpiresAt >= now));
}
export function localDay(date: string, timeZone: string) {
  const day = Temporal.PlainDate.from(date).toZonedDateTime(timeZone);
  return { start: new Date(day.epochMilliseconds), end: new Date(day.add({ days: 1 }).epochMilliseconds) };
}
export function policyBounds(data: Pick<AvailabilityData, "now" | "timeZone" | "policy">) {
  const now = Temporal.Instant.fromEpochMilliseconds(data.now.getTime()).toZonedDateTimeISO(data.timeZone);
  // Policy days are salon-local calendar days; lead minutes are elapsed time.
  return { earliest: new Date(data.now.getTime() + data.policy.minimumBookingLeadMinutes * 60_000),
    latest: new Date(now.add({ days: data.policy.advanceBookingDays }).epochMilliseconds) };
}
function planner(input: AvailabilityInput, data: AvailabilityData) {
  const bounds = policyBounds(data);
  const day = localDay(input.date, data.timeZone);
  const hours = reservationWindows(day.start, day.end, data.hours, data.timeZone);
  const schedules = new Map(data.staff.map(s => [s.id, reservationWindows(day.start, day.end, data.schedules.filter(w => w.staffId === s.id), data.timeZone)]));
  const blocking = data.reservations.filter(r => isBlocking(r, data.now));
  const workload = (staffId: string) => blocking.filter(r => r.staffId === staffId &&
    ["CONFIRMED", "PENDING_PAYMENT"].includes(r.appointment.status)).reduce((sum, r) =>
    sum + Math.max(0, Math.min(r.reservedUntilAt.getTime(), day.end.getTime()) - Math.max(r.scheduledStartAt.getTime(), day.start.getTime())), 0);
  const workloads = new Map(data.staff.map(s => [s.id, workload(s.id)]));
  return (start: Date) => {
    if (start < data.now || start < bounds.earliest || start > bounds.latest || start < day.start || start >= day.end) return null;
    let cursor = start;
    const plan = [];
    for (const [index, selection] of input.services.entries()) {
      const current = data.services.find(s => s.id === selection.serviceId);
      const service = current && { ...current, ...data.serviceOverrides?.[index] };
      if (!service) return null;
      const buffer = service.bufferMinutes ?? data.policy.defaultBufferMinutes;
      const end = new Date(cursor.getTime() + service.durationMinutes * 60_000);
      const reservedUntil = new Date(end.getTime() + buffer * 60_000);
      // Current weekly windows cannot span midnight (open < close, no 24:00).
      // Bound coverage work even when configuration contains enormous durations.
      if (!Number.isFinite(reservedUntil.getTime()) || reservedUntil > day.end ||
        !coversIntervals(cursor, reservedUntil, hours) ||
        data.closures.some(c => overlaps(cursor, reservedUntil, c.startsAt, c.endsAt))) return null;
      const candidates = data.staff.filter(staff =>
        (selection.assignmentMode === "ANY_AVAILABLE" || staff.id === selection.staffId) &&
        data.qualifications.some(q => q.staffId === staff.id && q.serviceId === service.id) &&
        coversIntervals(cursor, reservedUntil, schedules.get(staff.id)!) &&
        !data.unavailability.some(u => u.staffId === staff.id && overlaps(cursor, reservedUntil, u.startsAt, u.endsAt)) &&
        !blocking.some(r => r.staffId === staff.id && overlaps(cursor, reservedUntil, r.scheduledStartAt, r.reservedUntilAt))
      ).sort((a, b) => workloads.get(a.id)! - workloads.get(b.id)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      if (!candidates.length) return null;
      plan.push({ sequenceNo: index + 1, serviceId: service.id, serviceName: service.name,
        assignmentMode: selection.assignmentMode, candidates, startAt: cursor.toISOString(), endAt: end.toISOString(),
        reservedUntilAt: reservedUntil.toISOString(), durationMinutes: service.durationMinutes, bufferMinutes: buffer });
      cursor = reservedUntil;
    }
    // Under the MVP rules every interval is fixed before assignment and sequential
    // including its buffer. Choices cannot overlap or constrain later choices, so
    // the Cartesian product of these nonempty candidate lists is a feasible plan.
    // Resolve only after checking ALL intervals; no exponential search is needed.
    return { startAt: start.toISOString(), endAt: plan.at(-1)!.endAt,
      services: plan.map(({ candidates, ...row }) => ({ ...row, staffId: candidates[0]!.id,
        staffName: `${candidates[0]!.firstName} ${candidates[0]!.lastName}` })) };
  };
}
export function planAt(input: AvailabilityInput, start: Date, data: AvailabilityData) {
  return planner(input, data)(start);
}
export function calculateAvailability(input: AvailabilityInput, data: AvailabilityData) {
  const resolve = planner(input, data);
  if (input.startAt) {
    const plan = resolve(new Date(input.startAt));
    return plan ? [plan] : [];
  }
  const day = localDay(input.date, data.timeZone);
  const { earliest, latest } = policyBounds(data);
  const result = [];
  // Offer quarter-hour starts anchored to the salon-local day. Round up so a
  // lead-time boundary never offers a start earlier than the policy permits.
  // Exact startAt checks remain available for existing appointment schedules.
  const intervalMs = 15 * 60_000;
  const firstStart = day.start.getTime() + Math.ceil(Math.max(0, earliest.getTime() - day.start.getTime()) / intervalMs) * intervalMs;
  for (let ms = firstStart;
    ms < day.end.getTime() && ms <= latest.getTime(); ms += intervalMs) {
    const plan = resolve(new Date(ms));
    if (plan) result.push(plan);
  }
  return result;
}
