import bcrypt from "bcrypt";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { accountFields } from "../auth/auth.schema.js";

export const bootstrapAdminSchema = accountFields.pick({ email: true, password: true, firstName: true, lastName: true });

// Local operator command only; never exposed as an HTTP route.
export async function bootstrapAdmin(prisma: PrismaClient, input: unknown) {
  const { password, ...fields } = bootstrapAdminSchema.parse(input);
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async tx => {
    // Serialize even when User is empty, and against ordinary account creation.
    await tx.$executeRaw`LOCK TABLE "User" IN EXCLUSIVE MODE`;
    if (await tx.user.count() !== 0) throw new Error("Bootstrap requires an empty User table.");
    const user = await tx.user.create({ data: { ...fields, passwordHash, role: "ADMIN", isActive: true } });
    await tx.auditLog.create({ data: {
      actorType: "SYSTEM", action: "ADMIN_BOOTSTRAPPED", entityType: "User", entityId: user.id,
      afterData: { id: user.id, role: user.role, isActive: user.isActive },
    } });
    return { id: user.id };
  });
}
