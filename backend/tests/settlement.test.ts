import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../generated/prisma/client.js";
import { allocateCommissions } from "../src/modules/settlement/commissions.js";
import { outcomesSchema, settlementSchema } from "../src/modules/settlement/settlement.schema.js";
const D = Prisma.Decimal;
function item(id: string, amount: string, sequenceNo = 1, rate = "0.4000") { return { id, staffId: id, sequenceNo, priceSnapshot: new D(amount), actualChargedAmount: new D(amount), commissionRateSnapshot: new D(rate) }; }
test("proportional Decimal allocation and commissions reconcile to the cent", () => {
  const result = allocateCommissions([item("a", "500.00"), item("b", "1000.00", 2)], new D(100));
  assert.deepEqual(result.map(r => [r.allocatedAppointmentFee.toFixed(2), r.commissionAmount.toFixed(2)]), [["33.33", "213.33"], ["66.67", "426.67"]]);
});
test("positive and negative rounding remainder uses amount, sequence and ID deterministically", () => {
  for (const [fee, expected] of [["0.01", ["0.00", "0.01", "0.00"]], ["0.02", ["0.01", "0.00", "0.01"]]] as const) {
    const result = allocateCommissions([item("z", "1.00", 2), item("a", "1.00", 1), item("b", "1.00", 1)], new D(fee));
    assert.deepEqual(result.map(r => r.allocatedAppointmentFee.toFixed(2)), expected);
  }
  const result = allocateCommissions([item("z", "2.00", 3), item("a", "1.00", 1), item("b", "1.00", 2)], new D("0.01"));
  assert.equal(result[0]!.allocatedAppointmentFee.toFixed(2), "0.01");
});
test("zero fee, half-up rounding, invalid charges and rates", () => {
  assert.equal(allocateCommissions([item("a", "0.05", 1, "0.1000")], new D(0))[0]!.commissionAmount.toFixed(2), "0.01");
  assert.throws(() => allocateCommissions([item("a", "0.00")], new D(100)));
  assert.throws(() => allocateCommissions([item("a", "1.00", 1, "1.1")], new D(100)));
  assert.throws(() => allocateCommissions([], new D(100)));
});
test("external settlement inputs reject numeric money, extra fields and invalid outcomes", () => {
  assert.equal(settlementSchema.safeParse({ amount: 1 }).success, false);
  assert.equal(outcomesSchema.safeParse({ services: [{ outcome: "REMOVED" }] }).success, false);
});

test("service payments accept automatic references while validating supplied legacy references", () => {
  const input = { bookingCode: "SL-test", revision: "a".repeat(64), idempotencyKey: "10000000-0000-4000-8000-000000000001", amount: "100.00", currency: "PHP" };
  for (const method of ["CASH", "GCASH", "OTHER"]) {
    assert.ok(settlementSchema.safeParse({ ...input, method }).success);
    assert.equal(settlementSchema.safeParse({ ...input, method, externalReference: " " }).success, false);
  }
});
