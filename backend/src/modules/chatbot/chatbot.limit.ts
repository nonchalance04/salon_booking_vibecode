import type { RequestHandler } from "express";
import { ApiError } from "../../shared/http.js";

// Per-process limits; deployments with multiple instances also need a shared edge limit.
export function createChatbotLimiter(now = Date.now): RequestHandler {
  const clients = new Map<string, { count: number; expires: number }>();
  let global = { count: 0, expires: 0 };
  return (req, res, next) => {
    const time = now();
    for (const [key, value] of clients) if (value.expires <= time) clients.delete(key);
    if (global.expires <= time) global = { count: 0, expires: time + 60000 };
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const client = clients.get(key) ?? { count: 0, expires: time + 60000 };
    if (client.count >= 20 || global.count >= 100 || (!clients.has(key) && clients.size >= 1000)) {
      res.setHeader("Retry-After", "60");
      return next(new ApiError(429, "CHATBOT_LIMIT", "Please wait a minute before sending another question."));
    }
    client.count++; global.count++; clients.set(key, client);
    next();
  };
}
