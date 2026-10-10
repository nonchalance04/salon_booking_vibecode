import assert from "node:assert/strict";
import { test } from "node:test";
import { philippinePhoneDigits, philippinePhoneNumber } from "../src/phone-number.ts";

test("Philippine phone input accepts local and international pasted formats", () => {
  for (const value of ["9171234567", "09171234567", "+63 917 123 4567", "639171234567"]) {
    assert.equal(philippinePhoneDigits(value), "9171234567");
    assert.equal(philippinePhoneNumber(value), "+639171234567");
  }
  assert.equal(philippinePhoneDigits("abc917xyz"), "917");
  assert.equal(philippinePhoneDigits(""), "");
});
