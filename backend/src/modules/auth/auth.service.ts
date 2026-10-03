import bcrypt from "bcrypt";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../shared/http.js";

export const publicUserSelect = {
  id: true, email: true, firstName: true, lastName: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
} as const;

export function createAuthService(prisma: PrismaClient) {
  let dummyHash: Promise<string> | undefined;
  return {
    async login(email: string, password: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      const matches = await bcrypt.compare(password, user?.passwordHash ?? await (dummyHash ??= bcrypt.hash("unused-login-comparison-value", 12)));
      if (!user || !matches || !user.isActive) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      // Recheck active status and password after hashing work, before issuing a token.
      const result = await prisma.user.updateMany({
        where: { id: user.id, isActive: true, passwordHash: user.passwordHash },
        data: { lastLoginAt: new Date() },
      });
      if (result.count !== 1) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      return this.currentUser(user.id);
    },
    async currentUser(id: string) {
      const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
      if (!user?.isActive) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
      return user;
    },
  };
}
