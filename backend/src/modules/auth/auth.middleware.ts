import type { RequestHandler } from "express";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../shared/http.js";
import { createAuthService } from "./auth.service.js";
import { createTokenService } from "./auth.token.js";
import { COOKIE_NAME, cookieOptions, sessionCookie, type AuthConfig } from "./auth.security.js";

export function createAuthMiddleware(prisma: PrismaClient, config: AuthConfig) {
  const service = createAuthService(prisma);
  const tokens = createTokenService(config.JWT_SECRET);
  const cookie = cookieOptions(config);
  const authenticate: RequestHandler = async (req, res, next) => {
    const raw = sessionCookie(req.headers.cookie);
    let id: string;
    try {
      if (!raw) throw new Error("Missing token");
      id = (await tokens.verify(raw)).userId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Invalid subject");
    } catch {
      res.clearCookie(COOKIE_NAME, cookie);
      throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
    }
    res.locals.user = await service.currentUser(id);
    next();
  };
  const adminOnly: RequestHandler = (_req, res, next) => {
    if (res.locals.user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
    next();
  };
  return { authenticate, adminOnly };
}
