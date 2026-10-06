import { z } from "zod";
import { guestAccessSchema } from "../appointments/appointments.schema.js";

export const money = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/);
export const checkoutSchema = guestAccessSchema.extend({ idempotencyKey: z.uuid() }).strict();
export const testCaptureSchema = guestAccessSchema.extend({ paymentId: z.uuid(), outcome: z.enum(["SUCCEEDED", "FAILED"]) }).strict();
export const manualPaymentSchema = z.object({
  bookingCode: z.string().min(1).max(100), idempotencyKey: z.uuid(), amount: money,
  currency: z.literal("PHP"), method: z.enum(["CASH", "GCASH", "OTHER"]),
  externalReference: z.string().trim().min(1).max(120),
}).strict();
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
export const receiptSchema = z.object({ paymentId: z.uuid() }).strict();
export const listSchema = z.object({ cursor: z.uuid().optional(), reconciliationOnly: z.enum(["true", "false"]).default("true") }).strict();
