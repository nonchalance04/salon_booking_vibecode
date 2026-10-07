import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationWorkerError } from "../src/modules/notifications/worker-error.js";

test("worker logs actionable missing-database diagnostics without Prisma secrets", () => {
  assert.deepEqual(notificationWorkerError({ code: "P1003", message: "private database password", meta: { connectionString: "private" } }), {
    code: "P1003", hint: "Configured database does not exist; check DATABASE_URL database name.",
  });
});

test("worker diagnostics never copy unknown errors, codes, messages or inherited keys", () => {
  for (const error of [null, undefined, "private", new Error("private"), { code: "private", meta: "private" }, { code: "constructor" }, { code: "__proto__" }]) {
    assert.equal(notificationWorkerError(error).code, "WORKER_OPERATION_FAILED");
    assert.ok(!JSON.stringify(notificationWorkerError(error)).includes("private"));
  }
});
