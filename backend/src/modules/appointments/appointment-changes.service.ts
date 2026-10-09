import { Prisma, type PrismaClient, type NotificationEventType } from "../../../generated/prisma/client.js";
import { ApiError } from "../../shared/http.js";
import { freshTime, lockStaff } from "../scheduling/coordination.js";
import { loadAvailabilityData } from "../availability/availability.data.js";
import { calculateAvailability, planAt, type AvailabilityData } from "../availability/availability.engine.js";
import type { AvailabilityInput } from "../availability/availability.schema.js";
import { createGuestCredentials, validGuestToken } from "./appointments.security.js";
import { guestSelect, guestView, reservationTransaction, RestartReservation } from "./appointments.service.js";
import { Temporal } from "@js-temporal/polyfill";
import type { AppointmentListQuery, ChangeInput, ChangeSearch } from "./appointments.schema.js";

type Tx = Prisma.TransactionClient;
const include = { bookingPolicyVersion: true, customer: true, appointmentServices: { orderBy: { sequenceNo: "asc" as const } }, recoveryAppointment: true };
type Row = Prisma.AppointmentGetPayload<{ include: typeof include }>;
const conflict = (message: string) => new ApiError(409, "CHANGE_NOT_ALLOWED", message);
export function validateChangeEligibility(row: { status: string; startAt: Date; rescheduleCount: number; recoveryAppointment: unknown;
  bookingPolicyVersion: { maxReschedules: number; rescheduleCutoffHours: number; noShowGraceHours: number } }, recovery: boolean, now: Date) {
  const policy = row.bookingPolicyVersion;
  if (row.rescheduleCount >= policy.maxReschedules) throw conflict("The maximum number of appointment changes has been reached.");
  if (recovery) {
    if (row.status !== "NO_SHOW" || row.recoveryAppointment) throw conflict("This appointment is not eligible for another recovery booking.");
    if (+now > +row.startAt + policy.noShowGraceHours * 3_600_000) throw conflict("The no-show recovery grace period has ended.");
  } else {
    if (row.status !== "CONFIRMED" || +now > +row.startAt - policy.rescheduleCutoffHours * 3_600_000) throw conflict("This appointment can no longer be rescheduled. Please contact the salon.");
  }
}
function pristine(row: Row) {
  if (row.completedAt || row.appointmentServices.some(s => s.membershipStatus === "ACTIVE" && (s.outcome !== "SCHEDULED" || s.outcomeFinalizedAt))) {
    throw conflict("Service outcomes have already been recorded. Please contact the salon.");
  }
}
async function admin(tx: Tx, actorId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actorId}::uuid FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: actorId } });
  if (!user?.isActive) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
}
async function lockAppointment(tx: Tx, bookingCode: string, token?: string) {
  const lockedIds = (await tx.staff.findMany({ select: { id: true } })).map(s => s.id);
  await lockStaff(tx, lockedIds);
  await tx.$queryRaw`SELECT id FROM "Appointment" WHERE "bookingCode" = ${bookingCode} FOR UPDATE`;
  const row = await tx.appointment.findUnique({ where: { bookingCode }, include });
  const valid = token === undefined || validGuestToken(token, row?.guestAccessTokenHash ?? "0".repeat(64));
  if (!row || !valid) throw new ApiError(404, "APPOINTMENT_NOT_FOUND", "The booking code or private access token is incorrect.");
  if (row.appointmentServices.some(s => !lockedIds.includes(s.staffId))) throw new RestartReservation();
  return { row, lockedIds };
}
function snapshot(row: Row): Prisma.InputJsonValue {
  // Explicit allowlist: no contact details, credentials, or provider metadata.
  return { id: row.id, bookingPolicyVersionId: row.bookingPolicyVersionId, status: row.status,
    startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(), appointmentFeeAmount: row.appointmentFeeAmount.toFixed(2),
    rescheduleCount: row.rescheduleCount, recoveryOfAppointmentId: row.recoveryOfAppointmentId,
    carriedAppointmentFeePaymentId: row.carriedAppointmentFeePaymentId,
    appointmentServices: row.appointmentServices.map(s => ({ id: s.id, serviceId: s.serviceId, staffId: s.staffId,
      assignmentMode: s.assignmentMode, membershipStatus: s.membershipStatus, sequenceNo: s.sequenceNo,
      serviceNameSnapshot: s.serviceNameSnapshot, priceSnapshot: s.priceSnapshot.toFixed(2), durationMinutesSnapshot: s.durationMinutesSnapshot,
      bufferMinutesSnapshot: s.bufferMinutesSnapshot, commissionRateSnapshot: s.commissionRateSnapshot.toFixed(4),
      scheduledStartAt: s.scheduledStartAt.toISOString(), scheduledEndAt: s.scheduledEndAt.toISOString(), reservedUntilAt: s.reservedUntilAt.toISOString(),
      outcome: s.outcome, removedAt: s.removedAt?.toISOString() ?? null })) };
}
async function notify(tx: Tx, row: Row, eventType: NotificationEventType, now: Date) {
  await tx.notificationQueue.create({ data: { appointmentId: row.id, customerId: row.customerId, eventType,
    channel: row.customer.email ? "EMAIL" : "SMS", recipient: row.customer.email ?? row.customer.phone,
    status: "PENDING", scheduledAt: now, payload: { schemaVersion: 1, bookingCode: row.bookingCode,
      appointmentStatus: row.status, startAt: row.startAt.toISOString(), recoveryOfAppointmentId: row.recoveryOfAppointmentId } } });
}
async function prepare(tx: Tx, row: Row, lockedIds: string[], input: ChangeSearch, timeZone: string, now: Date) {
  validateChangeEligibility(row, input.recovery, now); pristine(row);
  const retained = input.services.map(s => {
    if (!s.appointmentServiceId) return undefined;
    const old = row.appointmentServices.find(old => old.id === s.appointmentServiceId && old.membershipStatus === "ACTIVE" && old.serviceId === s.serviceId);
    if (input.recovery || !old) throw new ApiError(400, "INVALID_RETAINED_SERVICE", "A retained service must belong to this active appointment schedule.");
    return old;
  });
  if (new Set(retained.filter(Boolean).map(s => s!.id)).size !== retained.filter(Boolean).length) throw new ApiError(400, "INVALID_RETAINED_SERVICE", "A retained service cannot appear twice.");
  const selection: AvailabilityInput = { date: input.date, services: input.services.map(s => s.assignmentMode === "SPECIFIC"
    ? { serviceId: s.serviceId, assignmentMode: "SPECIFIC", staffId: s.staffId! } : { serviceId: s.serviceId, assignmentMode: "ANY_AVAILABLE" }) };
  const data = await loadAvailabilityData(tx, selection, timeZone, now, row.bookingPolicyVersion, {
    retainedServiceIds: retained.flatMap(s => s ? [s.serviceId] : []), excludeAppointmentId: input.recovery ? undefined : row.id,
  });
  // The loader allows inactive rows only to recover retained snapshots. An added
  // occurrence of that same service must still independently be active.
  input.services.forEach((s, i) => {
    if (!retained[i] && !data.services.find(item => item.id === s.serviceId)?.isActive) throw new ApiError(400, "SERVICE_UNAVAILABLE", "Inactive services cannot be added.");
  });
  if (data.staff.some(s => !lockedIds.includes(s.id))) throw new RestartReservation();
  const planning: AvailabilityData = { ...data, serviceOverrides: retained.map(s => s ? {
    name: s.serviceNameSnapshot, durationMinutes: s.durationMinutesSnapshot, bufferMinutes: s.bufferMinutesSnapshot,
  } : undefined) };
  return { selection, data, planning, retained };
}
export function createAppointmentChangesService(prisma: PrismaClient, timeZone: string) {
  return {
    async search(input: ChangeSearch) {
      return reservationTransaction(prisma, async tx => {
        const { row, lockedIds } = await lockAppointment(tx, input.bookingCode, input.token);
        const prepared = await prepare(tx, row, lockedIds, input, timeZone, await freshTime(tx));
        const now = await freshTime(tx); validateChangeEligibility(row, input.recovery, now);
        return { timeZone, generatedAt: now.toISOString(), slots: calculateAvailability(prepared.selection, { ...prepared.planning, now }) };
      });
    },
    async change(input: ChangeInput) {
      const credentials = createGuestCredentials();
      return reservationTransaction(prisma, async tx => {
        const { row, lockedIds } = await lockAppointment(tx, input.bookingCode, input.token);
        const prepared = await prepare(tx, row, lockedIds, input, timeZone, await freshTime(tx));
        // Lock every potential source payment before the fresh eligibility decision.
        // Only an original, successful obligation payment can supply this credit.
        if (input.recovery) await tx.$queryRaw`SELECT id FROM "Payment" WHERE "appointmentId" = ${row.id}::uuid ORDER BY id FOR UPDATE`;
        const now = await freshTime(tx); validateChangeEligibility(row, input.recovery, now);
        const plan = planAt(prepared.selection, new Date(input.startAt), { ...prepared.planning, now });
        if (!plan) throw new ApiError(409, "SLOT_UNAVAILABLE", "This visit is no longer available. Please choose another time.");
        const beforeSnapshot = snapshot(row);
        let targetId = row.id;
        if (input.recovery) {
          const credit = await tx.payment.findFirst({ where: { appointmentId: row.id, type: "APPOINTMENT_FEE", status: "SUCCEEDED",
            satisfiesObligation: true, currency: "PHP", amount: { gte: row.bookingPolicyVersion.appointmentFeeAmount },
            refundedAt: null, carriedByAppointment: null }, orderBy: { id: "asc" } });
          const replacement = await tx.appointment.create({ data: { customerId: row.customerId,
            bookingPolicyVersionId: row.bookingPolicyVersionId, bookingCode: credentials.bookingCode, guestAccessTokenHash: credentials.hash,
            recoveryOfAppointmentId: row.id, rescheduleCount: row.rescheduleCount + 1,
            status: credit ? "CONFIRMED" : "PENDING_PAYMENT", confirmedAt: credit ? now : null,
            carriedAppointmentFeePaymentId: credit?.id, appointmentFeeAmount: row.bookingPolicyVersion.appointmentFeeAmount,
            startAt: new Date(plan.startAt), endAt: new Date(plan.endAt),
            holdExpiresAt: credit ? null : new Date(+now + row.bookingPolicyVersion.bookingHoldMinutes * 60_000) } });
          targetId = replacement.id;
        } else {
          // Temporarily retire active rows so arbitrary reordering cannot collide
          // with the database's partial unique active-sequence index.
          await tx.appointmentService.updateMany({ where: { appointmentId: row.id, membershipStatus: "ACTIVE" }, data: { membershipStatus: "REMOVED", removedAt: now } });
          await tx.appointment.update({ where: { id: row.id }, data: { startAt: new Date(plan.startAt), endAt: new Date(plan.endAt), rescheduleCount: { increment: 1 } } });
        }
        for (const [i, part] of plan.services.entries()) {
          const timing = { staffId: part.staffId, assignmentMode: part.assignmentMode, sequenceNo: part.sequenceNo,
            scheduledStartAt: new Date(part.startAt), scheduledEndAt: new Date(part.endAt), reservedUntilAt: new Date(part.reservedUntilAt) };
          const old = prepared.retained[i];
          if (old) await tx.appointmentService.update({ where: { id: old.id }, data: { ...timing, membershipStatus: "ACTIVE", removedAt: null } });
          else {
            const item = prepared.data.services.find(s => s.id === part.serviceId)!;
            const q = prepared.data.qualifications.find(q => q.staffId === part.staffId && q.serviceId === part.serviceId)!;
            await tx.appointmentService.create({ data: { ...timing, appointmentId: targetId, serviceId: part.serviceId,
              serviceNameSnapshot: item.name, priceSnapshot: item.price, durationMinutesSnapshot: part.durationMinutes,
              bufferMinutesSnapshot: part.bufferMinutes, commissionRateSnapshot: q.commissionRate } });
          }
        }
        const updated = await tx.appointment.findUniqueOrThrow({ where: { id: targetId }, include });
        const eventType = input.recovery ? "NO_SHOW_RECOVERY_CREATED" : "ORDINARY_RESCHEDULE";
        await tx.appointmentRescheduleHistory.create({ data: { appointmentId: row.id, eventType,
          rescheduleNumber: row.rescheduleCount + 1, snapshotSchemaVersion: 1, actorType: "CUSTOMER", actorCustomerId: row.customerId,
          beforeSnapshot, afterSnapshot: snapshot(updated), reason: input.reason } });
        await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: row.customerId, action: eventType,
          entityType: "Appointment", entityId: row.id, beforeData: beforeSnapshot, afterData: snapshot(updated) } });
        await notify(tx, updated, input.recovery ? "NO_SHOW_RECOVERY_CREATED" : "BOOKING_RESCHEDULED", now);
        if (input.recovery && updated.status === "CONFIRMED") await notify(tx, updated, "BOOKING_CONFIRMED", now);
        const view = await tx.appointment.findUniqueOrThrow({ where: { id: targetId }, select: guestSelect });
        const finalTime = await freshTime(tx);
        validateChangeEligibility(row, input.recovery, finalTime);
        const finalPlan = planAt(prepared.selection, new Date(input.startAt), { ...prepared.planning, now: finalTime });
        if (!finalPlan || (updated.status === "PENDING_PAYMENT" && updated.holdExpiresAt! < finalTime)) throw conflict("The booking deadline passed. Please choose another time.");
        if (finalPlan.services.some((s, i) => s.staffId !== plan.services[i]!.staffId)) throw new RestartReservation();
        return { appointment: guestView(view, finalTime, timeZone), ...(input.recovery ? { guestToken: credentials.token } : {}) };
      });
    },
    async cancel(bookingCode: string, token: string, reason?: string) {
      return reservationTransaction(prisma, async tx => {
        const { row } = await lockAppointment(tx, bookingCode, token);
        if (row.status === "CANCELLED") return { cancelled: true };
        const check = (now: Date) => {
          if (row.status !== "CONFIRMED" || +now > +row.startAt - row.bookingPolicyVersion.cancellationCutoffHours * 3_600_000) throw conflict("This appointment can no longer be cancelled. Please contact the salon.");
          pristine(row);
        };
        const now = await freshTime(tx); check(now);
        const updated = await tx.appointment.update({ where: { id: row.id }, data: { status: "CANCELLED", cancelledAt: now }, include });
        await tx.auditLog.create({ data: { actorType: "CUSTOMER", actorCustomerId: row.customerId, action: "BOOKING_CANCELLED", entityType: "Appointment", entityId: row.id,
          beforeData: { status: row.status }, afterData: { status: updated.status, reason: reason ?? null } } });
        await notify(tx, updated, "BOOKING_CANCELLED", now);
        check(await freshTime(tx));
        return { cancelled: true };
      });
    },
    async markNoShow(actorId: string, bookingCode: string) {
      return reservationTransaction(prisma, async tx => {
        await admin(tx, actorId);
        const { row } = await lockAppointment(tx, bookingCode);
        if (row.status === "NO_SHOW") return { marked: true };
        const now = await freshTime(tx);
        if (row.status !== "CONFIRMED" || now < row.startAt) throw conflict("Only a confirmed appointment whose start time has arrived may be marked as a no-show.");
        pristine(row);
        await tx.appointment.update({ where: { id: row.id }, data: { status: "NO_SHOW", noShowAt: now,
          noShowGraceExpiresAt: new Date(+row.startAt + row.bookingPolicyVersion.noShowGraceHours * 3_600_000) } });
        await tx.auditLog.create({ data: { actorType: "ADMIN", actorUserId: actorId, action: "BOOKING_NO_SHOW", entityType: "Appointment", entityId: row.id,
          beforeData: { status: row.status }, afterData: { status: "NO_SHOW" } } });
        return { marked: true };
      });
    },
    async list(actorId: string, cursor?: string, filters: AppointmentListQuery = {}) {
      return prisma.$transaction(async tx => {
        await admin(tx, actorId);
        const now = await freshTime(tx);
        const where: Prisma.AppointmentWhereInput = {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.from || filters.to ? { startAt: {
            ...(filters.from ? { gte: new Date(Temporal.PlainDate.from(filters.from).toZonedDateTime(timeZone).epochMilliseconds) } : {}),
            ...(filters.to ? { lt: new Date(Temporal.PlainDate.from(filters.to).add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds) } : {}),
          } } : {}),
          ...(filters.staffId ? { appointmentServices: { some: { staffId: filters.staffId, membershipStatus: "ACTIVE" } } } : {}),
          ...(filters.search ? { OR: [
            { bookingCode: { contains: filters.search, mode: "insensitive" } },
            { customer: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { customer: { lastName: { contains: filters.search, mode: "insensitive" } } },
            { customer: { AND: filters.search.split(/\s+/).map(word => ({ OR: [ { firstName: { contains: word, mode: "insensitive" as const } }, { lastName: { contains: word, mode: "insensitive" as const } } ] })) } },
          ] } : {}),
        };
        if (filters.attention === "pending-fees") { where.status = "PENDING_PAYMENT"; where.holdExpiresAt = { gte: now }; }
        if (filters.attention === "unsettled") { where.status = "CONFIRMED"; where.AND = [{ startAt: { lte: now } }]; }
        const rows = await tx.appointment.findMany({ where, take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { id: "asc" }, select: { ...guestSelect, id: true } });
        return { appointments: rows.slice(0, 50).map(row => guestView(row, now, timeZone)), nextCursor: rows.length > 50 ? rows[49]!.id : null };
      });
    },
  };
}
