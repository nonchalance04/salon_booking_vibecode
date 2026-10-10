import { createHmac } from "node:crypto";
import type { NotificationQueue } from "../../../generated/prisma/client.js";
import { NotificationFailure, smsRecipient, type NotificationMessage } from "./notification-provider.js";

export function suppressRoutineSms(row: Pick<NotificationQueue, "channel" | "eventType" | "payload">) {
  if (row.channel !== "SMS") return false;
  if (row.eventType === "APPOINTMENT_REMINDER" || row.eventType === "APPOINTMENT_COMPLETED") return true;
  // Financial exceptions still need a separate notice; they must never claim confirmation.
  return row.eventType === "PAYMENT_RECEIVED" && !(row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) && row.payload.reconciliationRequired === true);
}
export function bookingLinkToken(secret: string, notificationId: string) {
  return createHmac("sha256", secret).update(`salon-sms-booking-link:v1:${notificationId}`).digest("base64url");
}
export function confirmationSms(row: Pick<NotificationQueue, "id" | "recipient">, startAt: Date, timeZone: string, publicSiteUrl: string, token: string): NotificationMessage {
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    .format(startAt).replace(/[^\x20-\x7E]/g, " ");
  const link = `${new URL(publicSiteUrl).origin}/a#${token}`;
  const text = `CLIQUE: Fee paid. Confirmed ${date} (salon time). ${link} Keep link private.`;
  // ASCII text here is GSM-7; none of its characters use an extension escape.
  if (text.length > 160) throw new NotificationFailure("SMS_LINK_TOO_LONG", false);
  return { id: row.id, channel: "SMS", recipient: smsRecipient(row.recipient), subject: "Payment received and booking confirmed", text };
}
