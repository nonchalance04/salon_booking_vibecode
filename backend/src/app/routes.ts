import { createAppointmentOtpRouter } from "../modules/appointments/appointment-otp.routes.js";
import { Router } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthConfig } from "../modules/auth/auth.security.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createConfigurationRouter } from "../modules/configuration/configuration.routes.js";

import { createAvailabilityRouter } from "../modules/availability/availability.routes.js";

import { createAppointmentsRouter } from "../modules/appointments/appointments.routes.js";
import { createPaymentsRouter } from "../modules/payments/payments.routes.js";

import { createSettlementRouter } from "../modules/settlement/settlement.routes.js";

import { createReportsRouter } from "../modules/reports/reports.routes.js";
import { createChatbotRouter } from "../modules/chatbot/chatbot.routes.js";

export function createApiRouter(prisma: PrismaClient, config: AuthConfig) {
  const router = Router();
  router.get("/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  router.use(createReportsRouter(prisma, config));
  router.use(createChatbotRouter(prisma, config));
  router.use(createSettlementRouter(prisma, config));
  router.use(createPaymentsRouter(prisma, config));
  router.use(createAppointmentOtpRouter(prisma, config));
  router.use(createAppointmentsRouter(prisma, config));
  router.use(createAvailabilityRouter(prisma, config.SALON_TIMEZONE));
  router.use(createAuthRouter(prisma, config));
  router.use(createConfigurationRouter(prisma, config));
  return router;
}
