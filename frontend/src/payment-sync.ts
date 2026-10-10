// Returning to a visible booking tab should verify payment immediately. Keep
// retrying pending payments, including when the provider's update is delayed.
export function startPaymentSync(
  check: () => Promise<boolean>,
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> = document,
  browser: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval"> = window,
) {
  let stopped = false;
  let checking = false;
  const run = async () => {
    if (stopped || checking || page.visibilityState !== "visible") return;
    checking = true;
    try {
      if (!await check()) stop();
    } catch {
      // A transient provider/network error must not disable automatic retries.
    } finally { checking = false; }
  };
  const returned = () => { void run(); };
  const timer = browser.setInterval(returned, 15_000);
  function stop() {
    stopped = true;
    browser.clearInterval(timer);
    browser.removeEventListener("focus", returned);
    page.removeEventListener("visibilitychange", returned);
  }
  browser.addEventListener("focus", returned);
  page.addEventListener("visibilitychange", returned);
  returned();
  return stop;
}
