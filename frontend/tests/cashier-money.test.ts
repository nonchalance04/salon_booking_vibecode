import assert from "node:assert/strict";
import { test } from "node:test";
import { cashChange, centavos } from "../src/cashier-money.ts";

test("cash change is exact to the centavo and permits exact payment", () => {
  assert.equal(cashChange("1000", "780.30"), "219.70");
  assert.equal(cashChange("0.30", "0.10"), "0.20");
  assert.equal(cashChange("50.50", "50.50"), "0.00");
  assert.equal(cashChange("9999999999.99", "9999999999.98"), "0.01");
});
test("cash change rejects insufficient cash and invalid money", () => {
  assert.equal(cashChange("49.99", "50.00"), null);
  for (const input of ["", "-1", "NaN", "1e3", "1.001", "10000000000", "1,000", " 10", ".50"]) assert.equal(centavos(input), null);
});
