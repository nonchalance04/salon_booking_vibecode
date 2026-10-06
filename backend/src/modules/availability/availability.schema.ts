import { z } from "zod";
export const availabilitySchema = z.object({
  date: z.iso.date(),
  services: z.array(z.discriminatedUnion("assignmentMode", [
    z.object({ serviceId: z.uuid(), assignmentMode: z.literal("ANY_AVAILABLE") }).strict(),
    z.object({ serviceId: z.uuid(), assignmentMode: z.literal("SPECIFIC"), staffId: z.uuid() }).strict(),
  ])).min(1).max(20),
  startAt: z.iso.datetime({ offset: true }).optional(),
}).strict();
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
