import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AuthConfig } from "../auth/auth.security.js";
import { validateRequest } from "../../shared/http.js";
import { createConfigurationService } from "../configuration/configuration.service.js";
import { chatbotSchema } from "./chatbot.schema.js";
import { createChatbotService } from "./chatbot.service.js";
import { createGeminiChatbotService, type GeminiDependencies } from "./chatbot.gemini.js";
import { createChatbotLimiter } from "./chatbot.limit.js";
export function createChatbotRouter(prisma: PrismaClient, config: AuthConfig, dependencies?: GeminiDependencies) {
  const router = Router();
  const source = createConfigurationService(prisma, config.SALON_TIMEZONE);
  const service = config.CHATBOT_PROVIDER === "gemini" ? createGeminiChatbotService(source, config, dependencies) : createChatbotService(source);
  router.post("/chatbot", createChatbotLimiter(), validateRequest(z.object({ body: chatbotSchema })), async (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await service.answer(res.locals.validated.body.message, res.locals.validated.body.history));
  });
  return router;
}
