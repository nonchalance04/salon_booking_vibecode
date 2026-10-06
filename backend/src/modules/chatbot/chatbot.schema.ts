import { z } from "zod";
export const chatbotSchema = z.object({ message: z.string().trim().min(1).max(1000) }).strict();
