import { prisma, disconnectDatabase } from "./database/prisma.js";
import { env } from "./config/env.js";
import { createAppointmentsService } from "./modules/appointments/appointments.service.js";
import { createPaymentsService } from "./modules/payments/payments.service.js";
import { configuredPaymentProvider } from "./modules/payments/provider-config.js";
const service = createAppointmentsService(prisma, env.SALON_TIMEZONE);
const payments = createPaymentsService(prisma, configuredPaymentProvider(env), env.SALON_TIMEZONE);
let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;
async function tick() {
  try { await service.expireHolds(); }
  catch { console.error(JSON.stringify({ level: "error", event: "hold_expiration_failed" })); }
  try { await payments.synchronizeExpired(1); }
  catch { console.error(JSON.stringify({ level: "error", event: "payment_cleanup_failed" })); }
  if (!stopping) timer = setTimeout(startTick, 5000);
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
startTick();
