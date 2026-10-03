import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url().refine((value) => {
    const url = new URL(value);
    return ["postgresql:", "postgres:"].includes(url.protocol) &&
      url.hostname.length > 0 && url.pathname.length > 1;
  }, "A PostgreSQL URL with a database name is required."),
  JWT_SECRET: z.string().trim().min(32),
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
