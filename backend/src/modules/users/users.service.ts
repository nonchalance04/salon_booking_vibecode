import bcrypt from "bcrypt";
import type { PrismaClient, Prisma } from "../../../generated/prisma/client.js";
import type { AccountInput } from "../auth/auth.schema.js";
import { publicUserSelect } from "../auth/auth.service.js";
import { ApiError } from "../../shared/http.js";

async function requireAdmin(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user?.isActive) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
  if (user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Administrator access is required.");
}

export function createUsersService(prisma: PrismaClient) {
  return {
    async list(actorId: string) {
      await requireAdmin(prisma, actorId);
      return prisma.user.findMany({ select: publicUserSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    },
    async save(actorId: string, input: Partial<AccountInput>, id?: string) {
      const { password, ...fields } = input;
      const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
      try {
        return await prisma.$transaction(async tx => {
          // Lock actor and edited account in a stable order; recheck privileges
          // after waiting so concurrent deactivation/demotion cannot authorize a write.
          const ids = [...new Set([actorId, ...(id ? [id] : [])])].sort();
          for (const userId of ids) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
          await requireAdmin(tx, actorId);
          const before = id ? await tx.user.findUnique({ where: { id }, select: publicUserSelect }) : null;
          if (id && !before) throw new ApiError(404, "NOT_FOUND", "Account not found.");
          const data = { ...fields, ...(passwordHash ? { passwordHash } : {}) };
          const user = id
            ? await tx.user.update({ where: { id }, data, select: publicUserSelect })
            : await tx.user.create({ data: data as Prisma.UserCreateInput, select: publicUserSelect });
          const auditData = (value: typeof user) => ({
            id: value.id, email: value.email, firstName: value.firstName, lastName: value.lastName,
            role: value.role, isActive: value.isActive,
          });
          await tx.auditLog.create({ data: {
            actorType: "ADMIN", actorUserId: actorId, action: id ? "USER_UPDATED" : "USER_CREATED",
            entityType: "User", entityId: user.id,
            ...(before ? { beforeData: auditData(before) } : {}),
            afterData: { ...auditData(user), passwordChanged: Boolean(passwordHash) },
          } });
          return user;
        });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
          throw new ApiError(409, "EMAIL_IN_USE", "An account already uses this email.");
        }
        throw error;
      }
    },
  };
}
