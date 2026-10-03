import { SignJWT, jwtVerify } from "jose";

import { UserRole } from "../../../generated/prisma/client.js";

const JWT_ALGORITHM = "HS256";
const JWT_LIFETIME = "8h";


export type StaffTokenClaims = {
  userId: string;
  role: UserRole;
};

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    Object.values(UserRole).includes(value as UserRole)
  );
}

export function createTokenService(secret: string) {
  const jwtSecret = new TextEncoder().encode(secret);
  async function signStaffToken(
    claims: StaffTokenClaims,
  ): Promise<string> {
    return new SignJWT({
      role: claims.role,
    })
      .setProtectedHeader({
        alg: JWT_ALGORITHM,
      })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(JWT_LIFETIME)
      .sign(jwtSecret);
  }

  async function verifyStaffToken(
    token: string,
  ): Promise<StaffTokenClaims> {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: [JWT_ALGORITHM],
      requiredClaims: ["sub", "role", "iat", "exp"],
    });

    if (
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      !isUserRole(payload.role)
    ) {
      throw new Error("Invalid staff token claims.");
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
  return { sign: signStaffToken, verify: verifyStaffToken };

}
