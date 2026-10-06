import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../../shared/http.js";
import type { PaymentProvider, PaymentRequest, VerifiedPayment } from "./payment-provider.js";

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`));
// V2 creation returns a summary, not the full retrieved CheckoutSession.
const createdSessionSchema = z.object({ data: z.object({
  id: id("cs"), type: z.literal("checkout_session"),
  attributes: z.object({ livemode: z.boolean(), checkout_url: z.url() }),
}) });
const paymentSchema = z.object({ id: id("pay"), type: z.literal("payment"), attributes: z.object({
  amount: z.number().int().positive().max(999999999999), currency: z.literal("PHP"), status: z.string(),
  livemode: z.boolean(), paid_at: z.number().int().positive().nullable().optional(), source: z.object({ type: z.literal("gcash") }),
}) });
const sessionSchema = z.object({ id: id("cs"), type: z.literal("checkout_session"), attributes: z.object({
  livemode: z.boolean(), reference_number: z.uuid(), metadata: z.object({ appointmentId: z.uuid(), paymentId: z.uuid() }),
  checkout_url: z.string().optional(), status: z.string(),
  line_items: z.array(z.object({ amount: z.number().int().positive().max(999999999999), currency: z.literal("PHP"), quantity: z.literal(1) })).length(1),
  payments: z.array(paymentSchema).default([]),
}) });
const unavailable = () => new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "PayMongo could not complete the request. Check payment status before trying another payment.");
const invalid = () => new ApiError(400, "INVALID_PAYMENT_EVENT", "The PayMongo payment details could not be verified.");
export function centavos(amount: string) {
  if (!/^(0|[1-9]\d{0,9})\.\d{2}$/.test(amount)) throw invalid();
  const value = Number(BigInt(amount.replace(".", "")));
  if (value <= 0) throw invalid();
  return value;
}
function pesos(amount: number) { return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`; }
export class PayMongoProvider implements PaymentProvider {
  readonly name = "paymongo";
  readonly live: boolean;
  constructor(private readonly config: { secretKey: string; webhookSecret: string; returnUrl: string },
    private readonly request: typeof fetch = fetch) {
    this.live = config.secretKey.startsWith("sk_live_");
  }
  private async api(path: string, body?: unknown) {
    try {
      const response = await this.request(`https://api.paymongo.com${path}`, { method: body === undefined ? "GET" : "POST",
        redirect: "error", signal: AbortSignal.timeout(10_000), headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.secretKey}:`).toString("base64")}`,
          Accept: "application/json", "Content-Type": "application/json",
        }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw unavailable();
      return await response.json() as unknown;
    } catch { throw unavailable(); }
  }
  private parse(body: unknown) {
    const parsed = z.object({ data: sessionSchema }).safeParse(body);
    if (!parsed.success || parsed.data.data.attributes.livemode !== this.live) throw invalid();
    const session = parsed.data.data;
    if (session.attributes.reference_number !== session.attributes.metadata.paymentId) throw invalid();
    return session;
  }
  async createPayment(request: PaymentRequest) {
    const amount = centavos(request.amount);
    if (request.currency !== "PHP" || request.expiresAt.getTime() <= Date.now()) throw new ApiError(409, "HOLD_NOT_ACTIVE", "The booking hold has expired.");
    // No unverified idempotency header or unsupported expires_at field. The
    // service durably claims creation once and reuses the resulting session.
    const created = createdSessionSchema.safeParse(await this.api("/v2/checkout_sessions", { data: { attributes: {
      line_items: [{ name: "Salon appointment fee", amount, currency: "PHP", quantity: 1 }],
      payment_method_types: ["gcash"], reference_number: request.paymentId,
      metadata: { paymentId: request.paymentId, appointmentId: request.appointmentId },
      success_url: this.config.returnUrl, cancel_url: this.config.returnUrl,
      send_email_receipt: false, show_description: true, show_line_items: true,
      description: "Appointment fee. Confirmation is subject to the salon booking hold deadline.",
    } } }));
    if (!created.success || created.data.data.attributes.livemode !== this.live) throw invalid();
    const session = created.data.data;
    const checkoutUrl = session.attributes.checkout_url;
    if (!checkoutUrl) throw invalid();
    const url = new URL(checkoutUrl);
    if (url.origin !== "https://checkout.paymongo.com" || url.username || url.password) throw invalid();
    return { reference: session.id, checkoutUrl };
  }
  async getPaymentStatus(reference: string): Promise<VerifiedPayment> {
    if (!id("cs").safeParse(reference).success) throw invalid();
    const session = this.parse(await this.api(`/v1/checkout_sessions/${reference}`));
    if (session.id !== reference) throw invalid();
    const attr = session.attributes;
    if (attr.checkout_url) {
      const url = new URL(attr.checkout_url);
      if (url.origin !== "https://checkout.paymongo.com" || url.username || url.password) throw invalid();
    }
    const captures = attr.payments.filter(p => p.attributes.status === "paid");
    if (captures.length > 1) throw new ApiError(409, "PAYMENT_REVIEW_REQUIRED", "Multiple captures require provider reconciliation.");
    const capture = captures[0];
    if (capture && (capture.attributes.livemode !== this.live || !capture.attributes.paid_at || capture.attributes.amount !== attr.line_items[0]!.amount)) throw invalid();
    return { paymentId: attr.metadata.paymentId, appointmentId: attr.metadata.appointmentId,
      checkoutReference: reference, checkoutUrl: attr.checkout_url, reference: capture?.id ?? reference, amount: pesos(capture?.attributes.amount ?? attr.line_items[0]!.amount), currency: "PHP",
      status: capture ? "SUCCEEDED" : attr.status === "expired" ? "EXPIRED" : "PENDING",
      paidAt: capture ? new Date(capture.attributes.paid_at! * 1000).toISOString() : null };
  }
  async verifyPayment(raw: Buffer, header: string | undefined): Promise<VerifiedPayment | null> {
    const parts = new Map<string, string>();
    for (const part of (header ?? "").split(",")) {
      const [key, value] = part.trim().split("=");
      if (!key || value === undefined || parts.has(key)) throw new ApiError(401, "INVALID_PAYMENT_SIGNATURE", "Payment event authentication failed.");
      parts.set(key, value);
    }
    const timestamp = parts.get("t") ?? "";
    const signature = parts.get(this.live ? "li" : "te") ?? "";
    if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature)) {
      throw new ApiError(401, "INVALID_PAYMENT_SIGNATURE", "Payment event authentication failed.");
    }
    const expected = createHmac("sha256", this.config.webhookSecret).update(`${timestamp}.`).update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new ApiError(401, "INVALID_PAYMENT_SIGNATURE", "Payment event authentication failed.");
    let body: unknown;
    try { body = JSON.parse(raw.toString("utf8")); } catch { throw invalid(); }
    const envelope = z.object({ data: z.object({ type: z.literal("event"), attributes: z.object({ type: z.string(), livemode: z.boolean(), data: z.unknown() }) }) }).safeParse(body);
    if (!envelope.success || envelope.data.data.attributes.livemode !== this.live) throw invalid();
    const event = envelope.data.data.attributes;
    if (event.type !== "checkout_session.payment.paid") return null;
    const resource = z.object({ id: id("cs"), type: z.literal("checkout_session") }).safeParse(event.data);
    if (!resource.success) throw invalid();
    // Obtain current capture details from our own merchant account, not merely
    // a callback or browser assertion. Retrieval is outside database locks.
    const verified = await this.getPaymentStatus(resource.data.id);
    if (verified.status !== "SUCCEEDED") throw unavailable();
    return verified;
  }
  async expirePayment(reference: string) {
    if (!id("cs").safeParse(reference).success) throw invalid();
    await this.api(`/v1/checkout_sessions/${reference}/expire`, {});
  }
}
