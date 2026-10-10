import assert from "node:assert/strict";
import { test } from "node:test";
import { startPaymentSync } from "../src/payment-sync.ts";

function environment() {
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const timers = new Map<number, () => void>();
  const browser = Object.assign(new EventTarget(), {
    setInterval(callback: () => void, delay: number) {
      assert.equal(delay, 15_000);
      timers.set(1, callback);
      return 1;
    },
    clearInterval(id: number) { timers.delete(id); },
  });
  return { page: page as unknown as Document, browser: browser as unknown as Window, timers };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test("verifies immediately and on return, then stops after verified settlement", async () => {
  const { page, browser, timers } = environment();
  let checks = 0;
  let pending = true;
  const stop = startPaymentSync(async () => { checks++; return pending; }, page, browser);
  await settled();
  assert.equal(checks, 1);
  browser.dispatchEvent(new Event("focus"));
  await settled();
  assert.equal(checks, 2);
  page.visibilityState = "hidden";
  timers.get(1)!();
  await settled();
  assert.equal(checks, 2);
  pending = false;
  page.visibilityState = "visible";
  page.dispatchEvent(new Event("visibilitychange"));
  await settled();
  assert.equal(checks, 3);
  assert.equal(timers.size, 0);
  browser.dispatchEvent(new Event("focus"));
  await settled();
  assert.equal(checks, 3);
  stop();
});

test("retries delayed provider updates and network failures without overlapping requests", async () => {
  const { page, browser, timers } = environment();
  let checks = 0;
  let complete!: (pending: boolean) => void;
  const stop = startPaymentSync(async () => {
    checks++;
    if (checks === 1) throw new Error("Provider unavailable");
    return new Promise<boolean>(resolve => { complete = resolve; });
  }, page, browser);
  await settled();
  timers.get(1)!();
  browser.dispatchEvent(new Event("focus"));
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(checks, 2);
  complete(true);
  await settled();
  timers.get(1)!();
  assert.equal(checks, 3);
  stop();
  complete(true);
  await settled();
  assert.equal(timers.size, 0);
  browser.dispatchEvent(new Event("focus"));
  page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(checks, 3);
});
