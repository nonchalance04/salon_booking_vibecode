import { z } from "zod";
const historyItem = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1).max(4000),
}).strict();
export const chatbotSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(historyItem).max(12).default([]),
}).strict().superRefine(({ history }, ctx) => {
  if (history.length % 2 !== 0 || history.some((item, index) => item.role !== (index % 2 === 0 ? "user" : "model")) ||
      history.reduce((total, item) => total + item.text.length, 0) > 20000) {
    ctx.addIssue({ code: "custom", path: ["history"], message: "Provide at most six bounded conversation turns." });
  }
});
export type ChatHistory = z.infer<typeof historyItem>[];
