import { prisma, disconnectDatabase } from "./database/prisma.js";
import { bootstrapAdmin } from "./modules/users/bootstrap.service.js";

try {
  await bootstrapAdmin(prisma, {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME,
    lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME,
  });
  console.info("First Admin created. Remove BOOTSTRAP_ADMIN_* variables before starting services.");
} catch {
  console.error("Admin bootstrap failed. Check input requirements, database access, migrations, and that User is empty.");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
