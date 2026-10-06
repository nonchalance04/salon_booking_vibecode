import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { validateRequest } from "../../shared/http.js";
import { browserSecurity, type AuthConfig } from "../auth/auth.security.js";
import { bookingSchema, guestAccessSchema, changeSchema, changeSearchSchema, cancellationSchema } from "./appointments.schema.js";
import { createAppointmentsService } from "./appointments.service.js";
import { createAppointmentChangesService } from "./appointment-changes.service.js";
import { createAuthMiddleware } from "../auth/auth.middleware.js";
export function createAppointmentsRouter(prisma: PrismaClient, config: AuthConfig) {
  const router = Router();
  const service = createAppointmentsService(prisma, config.SALON_TIMEZONE);
  router.use("/appointments", (_req, res, next) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); next();
  }, browserSecurity(config.TRUSTED_ORIGINS));
  router.post("/appointments", validateRequest(z.object({ body: bookingSchema })), async (_req, res) => {
    res.status(201).json(await service.book(res.locals.validated.body));
  });
  // Credentials stay in the JSON body, never in API paths/query strings/logs.
  router.post("/appointments/access", validateRequest(z.object({ body: guestAccessSchema })), async (_req, res) => {
    const { bookingCode, token } = res.locals.validated.body;
    res.json(await service.retrieve(bookingCode, token));
  });
  const changes = createAppointmentChangesService(prisma, config.SALON_TIMEZONE);
  const auth = createAuthMiddleware(prisma, config);
  router.post("/appointments/change-options", validateRequest(z.object({ body: changeSearchSchema })), async (_req, res) => {
    res.json(await changes.search(res.locals.validated.body));
  });
  router.post("/appointments/change", validateRequest(z.object({ body: changeSchema })), async (_req, res) => {
    const input = res.locals.validated.body;
    res.status(input.recovery ? 201 : 200).json(await changes.change(input));
  });
  router.post("/appointments/cancel", validateRequest(z.object({ body: cancellationSchema })), async (_req, res) => {
    const { bookingCode, token, reason } = res.locals.validated.body;
    res.json(await changes.cancel(bookingCode, token, reason));
  });
  router.get("/appointments", auth.authenticate, auth.adminOnly, validateRequest(z.object({ query: z.object({ cursor: z.uuid().optional() }).strict() })), async (_req, res) => {
    res.json(await changes.list(res.locals.user.id, res.locals.validated.query.cursor));
  });
  router.post("/appointments/no-show", auth.authenticate, auth.adminOnly, validateRequest(z.object({ body: z.object({ bookingCode: z.string().min(1).max(100) }).strict() })), async (_req, res) => {
    res.json(await changes.markNoShow(res.locals.user.id, res.locals.validated.body.bookingCode));
  });
  return router;
}
