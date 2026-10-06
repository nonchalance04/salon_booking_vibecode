import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../shared/http.js";
import { availabilitySchema } from "./availability.schema.js";
import { createAvailabilityService } from "./availability.service.js";
export function createAvailabilityRouter(prisma: PrismaClient, timeZone: string) {
  const router = Router();
  const service = createAvailabilityService(prisma, timeZone);
  router.use("/availability", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.get("/availability/staff", async (_req, res) => res.json(await service.catalog()));
  // Read-only search: POST carries the ordered service/staff plan; no writes.
  router.post("/availability", validateRequest(z.object({ body: availabilitySchema })), async (_req, res) => {
    res.json(await service.search(res.locals.validated.body));
  });
  return router;
}
