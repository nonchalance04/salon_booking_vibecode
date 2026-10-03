import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthConfig } from "../modules/auth/auth.security.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createConfigurationRouter } from "../modules/configuration/configuration.routes.js";

export function createApiRouter(prisma: PrismaClient, config: AuthConfig) {
  const router = Router();
  router.use(createAuthRouter(prisma, config));
  router.use(createConfigurationRouter(prisma, config));
  return router;
}
