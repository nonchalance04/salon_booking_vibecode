import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../../shared/http.js";
import { money } from "./payments.schema.js";

export type PaymentRequest = { paymentId: string; appointmentId: string; amount: string; currency: string; expiresAt: Date };
export const verifiedEventSchema = z.object({
  paymentId: z.uuid(), appointmentId: z.uuid(), reference: z.string().min(1).max(200),
  amount: money, currency: z.literal("PHP"), status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "EXPIRED"]),
  paidAt: z.iso.datetime({ offset: true }).nullable(),
  checkoutReference: z.string().optional(),
  checkoutUrl: z.string().optional(),
}).strict().refine(event => event.status !== "SUCCEEDED" || event.paidAt !== null);
export type VerifiedPayment = z.infer<typeof verifiedEventSchema>;
// Adapters authenticate events or query their provider server. No browser success
// assertion enters the settlement service. Provider calls happen outside DB locks.
export interface PaymentProvider {
  readonly name: string;
  createPayment(request: PaymentRequest): Promise<{ reference: string; checkoutUrl: string | null }>;
  verifyPayment(rawBody: Buffer, signature: string | undefined): Promise<VerifiedPayment | null>;
  getPaymentStatus(reference: string): Promise<VerifiedPayment>;
  expirePayment?(reference: string): Promise<void>;
}

export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test";
  constructor(private readonly secret: string, environment: string) {
    if (environment === "production" || secret.length < 32) throw new Error("Test payments are disabled in production and require a secret.");
  }
  async createPayment(request: PaymentRequest) {
    return { reference: `test_${request.paymentId}`, checkoutUrl: null };
  }
  async verifyPayment(rawBody: Buffer, signature: string | undefined) {
    const expected = createHmac("sha256", this.secret).update(rawBody).digest();
    if (!signature || !/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
      throw new ApiError(401, "INVALID_PAYMENT_EVENT", "Payment event authentication failed.");
    }
    let data: unknown;
    try { data = JSON.parse(rawBody.toString("utf8")); } catch { throw new ApiError(400, "INVALID_PAYMENT_EVENT", "Invalid payment event."); }
    const result = verifiedEventSchema.safeParse(data);
    if (!result.success) throw new ApiError(400, "INVALID_PAYMENT_EVENT", "Invalid payment event.");
    return result.data;
  }
  async getPaymentStatus(_reference: string): Promise<VerifiedPayment> {
    throw new ApiError(503, "TEST_EVENT_REQUIRED", "Use a signed test event or the development payment simulator.");
  }
  async simulate(request: PaymentRequest, outcome: "SUCCEEDED" | "FAILED") {
    const event: VerifiedPayment = { paymentId: request.paymentId, appointmentId: request.appointmentId,
      reference: `test_${request.paymentId}`, amount: request.amount, currency: "PHP", status: outcome,
      paidAt: outcome === "SUCCEEDED" ? new Date().toISOString() : null };
    const raw = Buffer.from(JSON.stringify(event));
    return this.verifyPayment(raw, createHmac("sha256", this.secret).update(raw).digest("hex"));
  }
}
