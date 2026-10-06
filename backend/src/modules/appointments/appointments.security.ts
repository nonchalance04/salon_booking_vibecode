import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function createGuestCredentials() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: tokenHash(token), bookingCode: `SL-${randomBytes(12).toString("hex").toUpperCase()}` };
}
export function validGuestToken(token: string, hash: string) {
  const actual = Buffer.from(tokenHash(token), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
