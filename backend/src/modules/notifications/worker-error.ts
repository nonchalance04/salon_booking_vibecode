// Only fixed codes and hints may be logged. Prisma messages/meta can contain
// connection details, SQL parameters, customer data, or provider credentials.
const hints = {
  P1000: "Check database credentials.",
  P1001: "Check database host, port, and server availability.",
  P1002: "Database connection timed out.",
  P1003: "Configured database does not exist; check DATABASE_URL database name.",
  P1010: "Database user does not have access.",
  P2021: "Required table is missing; check database and migrations.",
  P2022: "Required column is missing; check migrations.",
  P2010: "Database query failed; inspect database configuration and migrations.",
  ECONNREFUSED: "Database connection refused; check server and port.",
  ENOTFOUND: "Database hostname could not be resolved.",
  EPERM: "Database access was blocked by process permissions.",
} as const;

export function notificationWorkerError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (typeof code === "string" && Object.hasOwn(hints, code)) {
    return { code, hint: hints[code as keyof typeof hints] };
  }
  return { code: "WORKER_OPERATION_FAILED", hint: "Queue operation failed; check database health and migrations." };
}
