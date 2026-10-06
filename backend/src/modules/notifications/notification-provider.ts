export type NotificationMessage = {
  id: string;
  channel: "EMAIL" | "SMS";
  recipient: string;
  subject: string;
  text: string;
};

export interface NotificationProvider {
  send(message: NotificationMessage, signal: AbortSignal): Promise<void>;
}

// Only controlled codes are persisted. Provider responses can contain contact data
// and credentials and must never be copied to queue errors or operational logs.
export class NotificationFailure extends Error {
  constructor(public readonly code: string, public readonly retryable = true) {
    super(code);
  }
}

export function createTestNotificationProvider(onSend: (message: NotificationMessage) => void = () => {}): NotificationProvider {
  return { async send(message) { onSend(message); } };
}

async function accepted(response: Response, field: "id" | "sid") {
  if (!response.ok) {
    await response.body?.cancel();
    throw new NotificationFailure(`PROVIDER_HTTP_${response.status}`, response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500);
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !(field in body) || typeof (body as Record<string, unknown>)[field] !== "string" || !(body as Record<string, unknown>)[field]) {
    throw new NotificationFailure("INVALID_PROVIDER_RESPONSE");
  }
  if ("status" in body && ["failed", "undelivered", "canceled"].includes(String(body.status))) {
    throw new NotificationFailure("PROVIDER_REJECTED", false);
  }
}

export function createResendProvider(apiKey: string, from: string, request: typeof fetch = fetch): NotificationProvider {
  return { async send(message, signal) {
    if (message.channel !== "EMAIL") throw new NotificationFailure("CHANNEL_MISMATCH", false);
    const response = await request("https://api.resend.com/emails", {
      method: "POST", signal, redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.id },
      body: JSON.stringify({ from, to: [message.recipient], subject: message.subject, text: message.text }),
    });
    await accepted(response, "id");
  } };
}

export function smsRecipient(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  const international = /^09\d{9}$/.test(normalized) ? `+63${normalized.slice(1)}` : normalized;
  if (!/^\+[1-9]\d{7,14}$/.test(international)) throw new NotificationFailure("INVALID_RECIPIENT", false);
  return international;
}

export function createTwilioProvider(accountSid: string, authToken: string, messagingServiceSid: string, request: typeof fetch = fetch): NotificationProvider {
  return { async send(message, signal) {
    if (message.channel !== "SMS") throw new NotificationFailure("CHANNEL_MISMATCH", false);
    const response = await request(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST", signal, redirect: "error",
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: smsRecipient(message.recipient), MessagingServiceSid: messagingServiceSid, Body: message.text }).toString(),
    });
    // This endpoint has no assumed idempotency guarantee: crash recovery may resend.
    await accepted(response, "sid");
  } };
}
