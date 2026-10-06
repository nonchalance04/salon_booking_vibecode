import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(["127.0.0.1", "0.0.0.0", "::1", "::"]).default("127.0.0.1"),
  DATABASE_URL: z.url().refine((value) => {
    const url = new URL(value);
    return ["postgresql:", "postgres:"].includes(url.protocol) &&
      url.hostname.length > 0 && url.pathname.length > 1;
  }, "A PostgreSQL URL with a database name is required."),
  JWT_SECRET: z.string().trim().min(32),
  NOTIFICATION_EMAIL_PROVIDER: z.enum(["disabled", "test", "resend"]).default("disabled"),
  NOTIFICATION_SMS_PROVIDER: z.enum(["disabled", "test", "twilio"]).default("disabled"),
  RESEND_API_KEY: z.preprocess(v => v === "" ? undefined : v, z.string().min(10).optional()),
  NOTIFICATION_EMAIL_FROM: z.preprocess(v => v === "" ? undefined : v, z.email().optional()),
  TWILIO_ACCOUNT_SID: z.preprocess(v => v === "" ? undefined : v, z.string().regex(/^AC[0-9a-fA-F]{32}$/).optional()),
  TWILIO_AUTH_TOKEN: z.preprocess(v => v === "" ? undefined : v, z.string().min(16).optional()),
  TWILIO_MESSAGING_SERVICE_SID: z.preprocess(v => v === "" ? undefined : v, z.string().regex(/^MG[0-9a-fA-F]{32}$/).optional()),
  NOTIFICATION_LEASE_MS: z.coerce.number().int().min(5000).max(600000).default(60000),
  NOTIFICATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(20000).default(10000),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  NOTIFICATION_RETRY_BASE_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  NOTIFICATION_POLL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  NOTIFICATION_REMINDER_HOURS: z.coerce.number().int().min(0).max(168).default(24),
  PAYMENT_PROVIDER: z.enum(["disabled", "test", "paymongo"]).default("disabled"),
  PAYMONGO_SECRET_KEY: z.preprocess(v => v === "" ? undefined : v, z.string().regex(/^sk_(test|live)_[A-Za-z0-9]+$/).optional()),
  PAYMONGO_WEBHOOK_SECRET: z.preprocess(v => v === "" ? undefined : v, z.string().min(16).optional()),
  PAYMONGO_RETURN_URL: z.preprocess(v => v === "" ? undefined : v, z.url().optional()),
  PAYMENT_TEST_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  SALON_TIMEZONE: z.string().default("Asia/Manila").refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "A supported IANA timezone is required."),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173")
    .transform(value => value.split(",").map(origin => origin.trim()))
    .refine(origins => origins.length > 0 && origins.every(origin => {
      try {
        const url = new URL(origin);
        return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
      } catch { return false; }
    }), "Provide exact HTTP(S) origins, separated by commas."),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
}).superRefine((value, context) => {
  if (value.NOTIFICATION_LEASE_MS <= value.NOTIFICATION_TIMEOUT_MS + 1000) {
    context.addIssue({ code: "custom", path: ["NOTIFICATION_LEASE_MS"], message: "Lease must exceed provider timeout by more than one second." });
  }
  for (const field of ["NOTIFICATION_EMAIL_PROVIDER", "NOTIFICATION_SMS_PROVIDER"] as const) {
    if (value.NODE_ENV === "production" && value[field] === "test") context.addIssue({ code: "custom", path: [field], message: "Test notification providers are disabled in production." });
  }
  const notificationFields = [
    ...(value.NOTIFICATION_EMAIL_PROVIDER === "resend" ? ["RESEND_API_KEY", "NOTIFICATION_EMAIL_FROM"] as const : []),
    ...(value.NOTIFICATION_SMS_PROVIDER === "twilio" ? ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"] as const : []),
  ];
  for (const field of notificationFields) {
    if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "Notification provider configuration is required." });
  }
  if (value.PAYMENT_PROVIDER === "paymongo") {
    for (const field of ["PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET", "PAYMONGO_RETURN_URL"] as const) {
      if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "PayMongo configuration is required." });
    }
    if (value.PAYMONGO_SECRET_KEY && (value.NODE_ENV === "production") !== value.PAYMONGO_SECRET_KEY.startsWith("sk_live_")) {
      context.addIssue({ code: "custom", path: ["PAYMONGO_SECRET_KEY"], message: "Use live keys only in production, and test keys otherwise." });
    }
    if (value.PAYMONGO_RETURN_URL) {
      const url = new URL(value.PAYMONGO_RETURN_URL);
      if (!value.TRUSTED_ORIGINS.includes(url.origin) || url.pathname !== "/appointment" || url.search || url.hash || url.username || url.password ||
        (url.protocol !== "https:" && !(value.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
        context.addIssue({ code: "custom", path: ["PAYMONGO_RETURN_URL"], message: "Use the trusted frontend appointment URL." });
      }
    }
  }
  if (value.PAYMENT_PROVIDER === "test" && (value.NODE_ENV === "production" || !value.PAYMENT_TEST_SECRET)) {
    context.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "Test payments require a secret and a non-production environment." });
  }
  if (value.COOKIE_SAME_SITE === "none" && value.NODE_ENV !== "production") {
    context.addIssue({ code: "custom", path: ["COOKIE_SAME_SITE"], message: "Cross-site cookies require production HTTPS." });
  }
  if (value.NODE_ENV === "production" && value.TRUSTED_ORIGINS.some(origin => !origin.startsWith("https://"))) {
    context.addIssue({ code: "custom", path: ["TRUSTED_ORIGINS"], message: "Production requires explicit HTTPS origins." });
  }
});

export function parseEnv(input: Record<string, unknown>) {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    // Report variable names only: never print connection strings or secrets.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}.`);
  }
  return result.data;
}
