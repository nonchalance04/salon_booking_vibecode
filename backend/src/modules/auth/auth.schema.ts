import { z } from "zod";

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const password = z.string().min(12).refine(value => Buffer.byteLength(value, "utf8") <= 72,
  "Password must fit within 72 UTF-8 bytes.");
export const loginSchema = z.object({ body: z.object({
  email,
  password: z.string().min(1).refine(value => Buffer.byteLength(value, "utf8") <= 72),
}).strict() });
export const accountFields = z.object({
  email, password, firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100), role: z.enum(["ADMIN", "CASHIER"]),
  isActive: z.boolean(),
}).strict();
export const createAccountSchema = z.object({ body: accountFields.extend({ isActive: z.boolean().default(true) }) });
export const updateAccountSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: accountFields.partial().refine(value => Object.keys(value).length > 0),
});
export type AccountInput = z.infer<typeof accountFields>;
