import { Prisma } from "../../../generated/prisma/client.js";
import { ApiError } from "../../shared/http.js";
const D = Prisma.Decimal;
export type CommissionInput = { id: string; sequenceNo: number; staffId: string; priceSnapshot: Prisma.Decimal; actualChargedAmount: Prisma.Decimal | null; commissionRateSnapshot: Prisma.Decimal };
export function allocateCommissions(services: CommissionInput[], fee: Prisma.Decimal) {
  if (!services.length || fee.isNegative() || !fee.equals(fee.toDecimalPlaces(2))) throw new ApiError(409, "INVALID_COMMISSION_INPUT", "Invalid commission inputs.");
  for (const s of services) if (!s.priceSnapshot.gt(0) || !s.actualChargedAmount?.gt(0) || s.commissionRateSnapshot.lt(0) || s.commissionRateSnapshot.gt(1)) {
    throw new ApiError(409, "INVALID_SERVICE_CHARGE", "Performed services must have positive charges and valid commission snapshots.");
  }
  const total = services.reduce((sum, s) => sum.plus(s.actualChargedAmount!), new D(0));
  const rows = services.map(s => ({ appointmentServiceId: s.id, staffId: s.staffId, serviceAmount: s.actualChargedAmount!,
    allocatedAppointmentFee: fee.mul(s.actualChargedAmount!).div(total).toDecimalPlaces(2, D.ROUND_HALF_UP), commissionRate: s.commissionRateSnapshot }));
  const winner = [...services].sort((a, b) => b.actualChargedAmount!.comparedTo(a.actualChargedAmount!) || a.sequenceNo - b.sequenceNo || a.id.localeCompare(b.id))[0]!;
  const remainder = fee.minus(rows.reduce((sum, r) => sum.plus(r.allocatedAppointmentFee), new D(0)));
  const target = rows.find(r => r.appointmentServiceId === winner.id)!;
  target.allocatedAppointmentFee = target.allocatedAppointmentFee.plus(remainder);
  return rows.map(r => ({ ...r, commissionBase: r.serviceAmount.plus(r.allocatedAppointmentFee),
    commissionAmount: r.serviceAmount.plus(r.allocatedAppointmentFee).mul(r.commissionRate).toDecimalPlaces(2, D.ROUND_HALF_UP) }));
}
