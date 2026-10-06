import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AuthConfig } from "../auth/auth.security.js";
import { validateRequest } from "../../shared/http.js";
import { createConfigurationService } from "../configuration/configuration.service.js";
import { chatbotSchema } from "./chatbot.schema.js";
import { createChatbotService } from "./chatbot.service.js";
export function createChatbotRouter(prisma: PrismaClient, config: AuthConfig) {
  const router = Router();
  const service = createChatbotService(createConfigurationService(prisma, config.SALON_TIMEZONE));
  router.post("/chatbot", validateRequest(z.object({ body: chatbotSchema })), async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await service.answer(res.locals.validated.body.message));
  });
  return router;
}
