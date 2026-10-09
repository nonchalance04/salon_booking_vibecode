import { z } from "zod";
import { money } from "../payments/payments.schema.js";
export const booking = z.object({ bookingCode: z.string().trim().min(1).max(100) }).strict();
export const revision = booking.extend({ revision: z.string().regex(/^[a-f0-9]{64}$/) });
export const outcomesSchema = revision.extend({ services: z.array(z.object({
  id: z.uuid(), outcome: z.enum(["PERFORMED", "NOT_PERFORMED"]),
}).strict()).min(1).max(100) }).strict();
export const settlementSchema = revision.extend({ idempotencyKey: z.uuid(), amount: money,
  currency: z.literal("PHP"), method: z.enum(["CASH", "GCASH", "OTHER"]), externalReference: z.string().trim().min(1).max(120).optional(),
}).strict();
export type OutcomesInput = z.infer<typeof outcomesSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
