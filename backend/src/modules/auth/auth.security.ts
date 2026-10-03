import type { CookieOptions, RequestHandler } from "express";
import type { z } from "zod";
import type { envSchema } from "../../config/env.schema.js";
import { ApiError } from "../../shared/http.js";

export type AuthConfig = z.infer<typeof envSchema>;
export const COOKIE_NAME = "salon_session";
export function cookieOptions(config: AuthConfig): CookieOptions {
  return { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: config.COOKIE_SAME_SITE, path: "/api" };
}
export function sessionCookie(header: string | undefined) {
  const values = (header ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${COOKIE_NAME}=`));
  if (values.length !== 1) return undefined;
  try { return decodeURIComponent(values[0]!.slice(COOKIE_NAME.length + 1)); } catch { return undefined; }
}

export function browserSecurity(origins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    res.vary("Origin");
    if (origin !== undefined && !origins.includes(origin)) {
      next(new ApiError(403, "UNTRUSTED_ORIGIN", "This origin is not allowed."));
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      if (!origin) return next(new ApiError(403, "UNTRUSTED_ORIGIN", "A trusted origin is required."));
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).end();
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      let source = origin;
      if (origin === undefined) {
        try {
          const referer = new URL(req.get("referer") ?? "");
          if (["http:", "https:"].includes(referer.protocol) && !referer.username && !referer.password) source = referer.origin;
        } catch { /* Missing/malformed Referer fails closed. */ }
      }
      if (!source || !origins.includes(source)) return next(new ApiError(403, "CSRF_REJECTED", "A trusted origin is required."));
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
