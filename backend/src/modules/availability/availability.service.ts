import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../shared/http.js";
import { lockSalon, lockStaff, freshTime } from "../scheduling/coordination.js";
import { calculateAvailability, localDay, policyBounds } from "./availability.engine.js";
import { loadAvailabilityData } from "./availability.data.js";
import type { AvailabilityInput } from "./availability.schema.js";

export function createAvailabilityService(prisma: PrismaClient, timeZone: string) {
  return {
    async catalog() {
      const staff = await prisma.staff.findMany({ where: { isActive: true }, select: {
        id: true, firstName: true, lastName: true,
        staffServices: { where: { isActive: true, service: { isActive: true } }, select: { serviceId: true } },
      }, orderBy: { id: "asc" } });
      return { timeZone, staff: staff.map(({ staffServices, ...row }) => ({ ...row, serviceIds: staffServices.map(q => q.serviceId) })) };
    },
    async search(input: AvailabilityInput) {
      const day = localDay(input.date, timeZone);
      if (input.startAt && (new Date(input.startAt) < day.start || new Date(input.startAt) >= day.end)) {
        throw new ApiError(400, "INVALID_DATE", "The starting time must fall on the selected salon-local date.");
      }
      try {
        return await prisma.$transaction(async tx => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          await lockSalon(tx, "shared");
          // Small-salon MVP: lock the existing staff set in universal order, then
          // reload all inputs. This also serializes staff-specific config writes.
          const staffIds = (await tx.staff.findMany({ select: { id: true } })).map(s => s.id);
          await lockStaff(tx, staffIds);
          const now = await freshTime(tx);
          const policy = await tx.bookingPolicyVersion.findFirst({ where: { effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" } });
          if (!policy) throw new ApiError(503, "POLICY_UNAVAILABLE", "Booking availability is not configured yet.");
          const data = await loadAvailabilityData(tx, input, timeZone, now, policy);
          return { date: input.date, timeZone, advisory: true, generatedAt: now.toISOString(), policyVersion: policy.version,
            ...policyBounds(data), slots: calculateAvailability(input, data) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2028", "P2034"].includes(error.code) || String(error.meta?.code) === "55P03")) {
          throw new ApiError(409, "AVAILABILITY_BUSY", "The salon schedule is being updated. Please try again.");
        }
        throw error;
      }
    },
  };
}
