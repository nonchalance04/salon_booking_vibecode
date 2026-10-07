import { notificationWorkerError } from "./modules/notifications/worker-error.js";
import { prisma, disconnectDatabase } from "./database/prisma.js";
import { env } from "./config/env.js";
import { configuredNotificationProviders } from "./modules/notifications/provider-config.js";
import { createNotificationsService } from "./modules/notifications/notifications.service.js";

const providers = configuredNotificationProviders(env);
const service = createNotificationsService(prisma, {
  providers, timeZone: env.SALON_TIMEZONE, leaseMs: env.NOTIFICATION_LEASE_MS,
  timeoutMs: env.NOTIFICATION_TIMEOUT_MS, maxAttempts: env.NOTIFICATION_MAX_ATTEMPTS,
  retryBaseMs: env.NOTIFICATION_RETRY_BASE_MS, reminderHours: env.NOTIFICATION_REMINDER_HOURS,
});
let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;
async function tick() {
  try { await service.enqueueReminders(); }
  catch (error) { console.error(JSON.stringify({ level: "error", event: "notification_reminder_scan_failed", ...notificationWorkerError(error) })); }
  try {
    for (let i = 0; i < 100 && !stopping; i++) if (!await service.processNext()) break;
  } catch (error) { console.error(JSON.stringify({ level: "error", event: "notification_worker_failed", ...notificationWorkerError(error) })); }
  if (!stopping) timer = setTimeout(startTick, env.NOTIFICATION_POLL_MS);
}
function startTick() { running = tick(); }
async function stop() {
  if (stopping) return;
  stopping = true; clearTimeout(timer);
  const timeout = setTimeout(() => process.exit(1), 25_000); timeout.unref();
  try { await running; await disconnectDatabase(); }
  catch { process.exitCode = 1; }
  finally { clearTimeout(timeout); }
}
process.once("SIGTERM", () => { void stop(); });
process.once("SIGINT", () => { void stop(); });
console.info(JSON.stringify({ event: "notification_worker_started", enabledChannels: Object.keys(providers) }));
startTick();
