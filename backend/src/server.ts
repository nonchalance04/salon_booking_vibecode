import { createApp } from "./app/app.js";
import { createApiRouter } from "./app/routes.js";
import { prisma, disconnectDatabase } from "./database/prisma.js";
import { env } from "./config/env.js";

const app = createApp(createApiRouter(prisma, env));
const server = app.listen(env.PORT, env.HOST, () => {
  console.info(JSON.stringify({ level: "info", event: "server_started", port: env.PORT }));
});

server.on("error", () => {
  console.error(JSON.stringify({ level: "error", event: "server_start_failed" }));
  process.exitCode = 1;
});

function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async (error) => {
    try { await disconnectDatabase(); process.exitCode = error ? 1 : 0; }
    catch { process.exitCode = 1; }
    finally { clearTimeout(timeout); }
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
