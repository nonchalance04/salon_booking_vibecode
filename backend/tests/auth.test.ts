import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { createTokenService } from "../src/modules/auth/auth.token.js";
import { cookieOptions, sessionCookie } from "../src/modules/auth/auth.security.js";
import { createAccountSchema, updateAccountSchema } from "../src/modules/auth/auth.schema.js";
import { parseEnv } from "../src/config/env.schema.js";

const secret = "test-secret-for-phase-two-at-least-32-characters";
const id = "10000000-0000-4000-8000-000000000001";
test("JWT validates signature, expiration, and all required claims", async () => {
  const tokens = createTokenService(secret);
  assert.deepEqual(await tokens.verify(await tokens.sign({ userId: id, role: "ADMIN" })), { userId: id, role: "ADMIN" });
  await assert.rejects(tokens.verify(await createTokenService("wrong-secret-that-is-also-32-characters").sign({ userId: id, role: "ADMIN" })));
  const key = new TextEncoder().encode(secret);
  for (const token of [
    await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("0s").sign(key),
    await new SignJWT({ role: "ADMIN" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().sign(key),
    await new SignJWT({ role: "STYLIST" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("8h").sign(key),
    await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("8h").sign(key),
  ]) await assert.rejects(tokens.verify(token));
});
test("production cookies and origin configuration fail closed", () => {
  const env = { DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: secret };
  assert.throws(() => parseEnv({ ...env, NODE_ENV: "production" }));
  for (const origin of ["*", "null", "https://salon.example/path", "https://salon.example/"]) {
    assert.throws(() => parseEnv({ ...env, TRUSTED_ORIGINS: origin }));
  }
  const config = parseEnv({ ...env, NODE_ENV: "production", TRUSTED_ORIGINS: "https://salon.example", COOKIE_SAME_SITE: "none" });
  assert.deepEqual(cookieOptions(config), { httpOnly: true, secure: true, sameSite: "none", path: "/api" });
  assert.throws(() => parseEnv({ ...env, COOKIE_SAME_SITE: "none" }));
  assert.equal(sessionCookie("other=value; salon_session=abc.def"), "abc.def");
  assert.equal(sessionCookie("salon_session=a; salon_session=b"), undefined);
  assert.equal(sessionCookie("salon_session=%broken"), undefined);
});
test("account validation limits roles and bcrypt byte length, and PATCH has no implicit activation", () => {
  const body = { firstName: "Test", lastName: "Person", email: " TEST@EXAMPLE.COM ", password: "safe-test-password", role: "CASHIER" };
  assert.equal(createAccountSchema.parse({ body }).body.email, "test@example.com");
  assert.equal(createAccountSchema.parse({ body }).body.isActive, true);
  assert.equal(createAccountSchema.safeParse({ body: { ...body, role: "STYLIST" } }).success, false);
  assert.equal(createAccountSchema.safeParse({ body: { ...body, password: "é".repeat(37) } }).success, false);
  assert.deepEqual(updateAccountSchema.parse({ params: { id }, body: { firstName: "Edited" } }).body, { firstName: "Edited" });
  assert.equal(updateAccountSchema.safeParse({ params: { id }, body: { passwordHash: "injected" } }).success, false);
});
