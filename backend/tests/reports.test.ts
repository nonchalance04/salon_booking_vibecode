import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmedServicesQuery, reportQuery, reportPeriod } from "../src/modules/reports/reports.schema.js";
import { safeAudit } from "../src/modules/reports/reports.service.js";
test("report dates use inclusive salon days, including DST boundaries", () => {
  const q = reportQuery.parse({ from: "2026-10-04", to: "2026-10-04" });
  assert.deepEqual(reportPeriod(q, "Asia/Manila"), { gte: new Date("2026-10-03T16:00:00Z"), lt: new Date("2026-10-04T16:00:00Z") });
  const dst = reportPeriod({ ...q, from: "2026-03-08", to: "2026-03-08" }, "America/New_York");
  assert.equal(+dst.lt - +dst.gte, 23 * 3600000);
});
test("report queries reject invalid dates, unbounded ranges and invalid pagination", () => {
  for (const q of [{ from: "2026-02-30", to: "2026-03-01" }, { from: "2026-10-04", to: "2026-10-03" }, { from: "2025-01-01", to: "2026-01-02" }, { from: "2026-01-01", to: "2026-01-02", page: 0 }, { from: "2026-01-01", to: "2026-01-02", pageSize: 101 }, { from: "2026-01-01", to: "2026-01-02", role: "ADMIN" }]) assert.equal(reportQuery.safeParse(q).success, false);
});
test("audit viewing redacts nested credentials and provider metadata", () => {
  assert.deepEqual(safeAudit({ action: "changed", passwordHash: "secret", nested: [{ guestAccessTokenHash: "secret", amount: "100.00", metadata: { token: "secret" } }] }), { action: "changed", nested: [{ amount: "100.00" }] });
});

test("confirmed services default to bounded pages without requiring a booking code or date", () => {
  assert.deepEqual(confirmedServicesQuery.parse({}), { page: 1, pageSize: 25, search: "" });
  assert.equal(confirmedServicesQuery.parse({ search: " Jamie Santos " }).search, "Jamie Santos");
  for (const value of [{ page: 0 }, { pageSize: 101 }, { search: "x".repeat(101) }, { status: "COMPLETED" }]) assert.equal(confirmedServicesQuery.safeParse(value).success, false);
});
