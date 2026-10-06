# Validate a real PayMongo sandbox GCash payment

This procedure uses the actual PayMongo merchant API and hosted test checkout.
It does not use the application's local payment simulator or move real money.
Merchant sandbox acceptance has not yet been executed for this project.

## Files to edit

| File | Action |
| --- | --- |
| `backend/.env` | Required: configure database, authentication, PayMongo test key, endpoint signing secret, and return URL |
| `backend/.env.example` | Reference/template only; copy only if `.env` does not exist; never insert actual keys here |
| `frontend/vite.config.ts` | No change for backend 3000/frontend 5173; proxy defaults to backend 3000 |
| `backend/src/config/env.schema.ts` | Read for validation rules; no change required |
| `backend/src/modules/payments/paymongo-provider.ts` | Existing integration; no change required to test |
| `backend/src/modules/payments/payments.routes.ts` | Existing `/api/payments/provider/events` callback; no change required |
| `backend/prisma/schema.prisma` | Existing database models; no change required |

Keep actual keys in ignored `backend/.env`. Do not create `VITE_PAYMONGO_SECRET_KEY`
or put merchant/signing secrets in frontend files. This hosted integration does
not require a frontend PayMongo public key.

## 1. Prepare the application

Run on the computer where the browser and development servers will run:

```bash
cd /home/nonchalance/salon_project
nvm use
cd backend
npm ci
cd ../frontend
npm ci
```

Node.js 24 and PostgreSQL are required. If dependencies are already installed,
installation is optional. Create `backend/.env` from `.env.example` only if absent.
Use an existing initialized development database, or initialize a fresh one using
the README migration/seed instructions. Do not re-seed a database containing
appointments just to test PayMongo. Have an active Admin/Cashier login available.

Initially keep `PAYMENT_PROVIDER=disabled` while acquiring webhook configuration.
Start the backend:

```bash
cd /home/nonchalance/salon_project/backend
npm run dev
```

Open `http://127.0.0.1:3000/api/health`; expect HTTP 200.

## 2. Obtain the merchant test key

1. Sign into the PayMongo merchant dashboard.
2. Select the test environment where the dashboard offers a mode selector.
3. Open Settings → Developers / API Keys and copy the Secret Test key beginning
   `sk_test_`. Dashboard wording may differ.
4. Confirm the account can use GCash in test Hosted Checkout. Follow any account
   activation/access requirements displayed by PayMongo.

Official references:
[Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start),
[Hosted Checkout testing](https://docs.paymongo.com/docs/payment-channels-testing).

## 3. Expose the API through HTTPS

PayMongo cannot deliver callbacks to your computer's localhost address. Use a
public HTTPS staging API or a development tunnel. Example with ngrok:

1. Install ngrok using its [official Linux instructions](https://ngrok.com/download/linux).
2. Authenticate it locally:

   ```bash
   ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
   ```

3. In a separate terminal, start:

   ```bash
   ngrok http 3000
   ```

4. Copy the HTTPS forwarding origin shown, e.g. `https://YOUR_HOST.ngrok-free.app`.
5. Check `https://YOUR_HOST.ngrok-free.app/api/health` reaches the API.
6. Keep the tunnel running. Forward to port 3000, not frontend port 5173. Ensure
   the webhook path is reachable without browser login/interstitial challenges.

Use your assigned host, not the literal example. If the tunnel host changes,
update the registered PayMongo webhook endpoint. The tunnel origin does not need
adding to TRUSTED_ORIGINS: the callback authenticates a provider signature.

## 4. Register the test webhook

1. Open PayMongo Settings → Webhooks.
2. Add/enable an endpoint for test payments at:

   ```text
   https://YOUR_HOST.ngrok-free.app/api/payments/provider/events
   ```

3. Subscribe to `checkout_session.payment.paid`.
4. Save it and copy that endpoint's signing secret. This is different from the
   API Secret Test key and the local simulator PAYMENT_TEST_SECRET.
5. Keep the endpoint enabled and in the same test environment as the API key.

See [PayMongo webhook setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).

## 5. Edit backend/.env

Preserve your existing database/JWT/staff credentials. Set these entries exactly,
replacing placeholders with actual local values:

```dotenv
NODE_ENV=development
PORT=3000
SALON_TIMEZONE=Asia/Manila
TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
COOKIE_SAME_SITE=lax
PAYMENT_PROVIDER=paymongo
PAYMONGO_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY
PAYMONGO_WEBHOOK_SECRET=YOUR_ACTUAL_ENDPOINT_SIGNING_SECRET
PAYMONGO_RETURN_URL=http://127.0.0.1:5173/appointment
```

The return URL is the frontend, not the API tunnel. It must use a configured
trusted origin and the exact `/appointment` path, without query parameters,
fragment, or guest token. Keep DATABASE_URL and JWT_SECRET valid; JWT_SECRET needs
at least 32 characters. PAYMENT_TEST_SECRET is unused with provider `paymongo`.
Use a test key: development rejects live keys. Never edit `.env.example` with
actual credentials.

If using a different API port, change PORT and launch Vite with
`API_PROXY_TARGET=http://127.0.0.1:YOUR_PORT npm run dev`; tunnel that same API port.
No Vite source edit is needed. If using a different frontend origin, update
TRUSTED_ORIGINS and PAYMONGO_RETURN_URL together. For a remote browser, localhost
refers to that browser's computer; use an appropriately served HTTPS frontend.

## 6. Restart and verify configuration

Stop the old API/worker with Ctrl+C. Run these in separate terminals:

```bash
cd /home/nonchalance/salon_project/backend
npm run dev
```

```bash
cd /home/nonchalance/salon_project/backend
npm run worker:holds
```

```bash
cd /home/nonchalance/salon_project/frontend
npm run dev
```

Leave the HTTPS tunnel running as a fourth process. Open
`http://127.0.0.1:3000/api/payments/options`. Expect:

```json
{"onlineAvailable":true,"testMode":false,"provider":"paymongo","sandbox":true}
```

`testMode:false` means the application's simulator is off; `sandbox:true` means
PayMongo test mode. If API startup fails, fix the named environment variables
rather than weakening validation in env.schema.ts.

## 7. Create a fresh guest booking

1. Open `http://127.0.0.1:5173/availability`.
2. Select service/staff and an available future date/time within policy limits.
3. Enter development customer contact details.
4. Click Reserve a temporary hold.
5. Record booking code, fee, and hold deadline. Save the private booking link in
   a private local note and keep the booking tab open.
6. Confirm the page displays the PayMongo sandbox notice, not simulator buttons.

The unchanged seed uses PHP 100.00 and a 10-minute hold. Follow the actual displayed
fee/deadline if policy differs. Complete payment well before expiration.

## 8. Create and complete the merchant checkout

1. Click Pay with GCash. Expect a pending attempt and checkout link.
2. Click Continue to GCash on PayMongo. It opens a separate tab.
3. Verify the hosted fee matches the booking and GCash is offered.
4. Follow the test e-wallet flow. PayMongo documents Authorize/Fail options on
   its test e-wallet page; choose success/Authorize when presented. Hosted UI
   wording may vary. A real GCash account is not required for the documented
   test e-wallet flow. [Testing reference](https://docs.paymongo.com/docs/payment-acceptance-testing)
5. Complete success. Record the test merchant session `cs_...` and captured
   payment `pay_...` identifiers privately where available.
6. Keep the original booking tab. A return to `/appointment` may show retrieval
   guidance; use that original tab or your saved private link.

## 9. Prove webhook delivery independently

Before clicking Check payment status, inspect the actual event delivery in the
merchant dashboard or tunnel request inspector:

1. Find the `checkout_session.payment.paid` event for this session.
2. Verify it was delivered to the exact registered callback URL.
3. Verify the application's response is HTTP 200 with `{"received":true}`.
4. In the original booking tab click Refresh status (this reads the local booking,
   unlike Check payment status, which explicitly queries PayMongo).
5. Expect CONFIRMED and one SUCCEEDED payment for the fee.

If delivery failed, record webhook validation as failed even if Check payment
status later confirms the booking. That button is a separate recovery path.
Inspect endpoint secret, environment mode, raw body/header forwarding, and host
clock. The app allows five minutes of signature timestamp difference.

## 10. Validate staff receipt and persisted financial identity

1. Open the frontend root in another tab and sign in as Admin/Cashier.
2. Admin: select Appointment fees. Cashier: use the displayed payment workspace.
3. Find booking by code; verify CONFIRMED and one successful fee payment.
4. Click Issue receipt for PHP ….
5. Refresh the private guest booking; expand Receipt … and verify amount,
   currency PHP, method GCash, booking, customer, and paid time.
6. Admin: uncheck Show only payments requiring reconciliation and refresh the list.
   Expect the normal capture without review required.

Optional read-only database validation in your PostgreSQL client (replace code):

```sql
SELECT a."bookingCode", a.status, a."confirmedAt",
       p.id, p.provider, p.method, p.status AS "paymentStatus", p.amount,
       p.currency, p."externalReference", p."satisfiesObligation",
       p."reconciliationStatus", p.metadata->>'checkoutReference' AS "sessionId",
       r."receiptNumber"
FROM "Appointment" a
JOIN "Payment" p ON p."appointmentId" = a.id
LEFT JOIN "Receipt" r ON r."paymentId" = p.id
WHERE a."bookingCode" = 'REPLACE_WITH_BOOKING_CODE';
```

Expect one successful `paymongo`/`GCASH` capture, `pay_...` external reference,
`cs_...` session metadata, correct Decimal amount/PHP, obligation satisfied,
reconciliation NONE, confirmed timestamp, and one receipt after staff issuance.
There may be other historical failed/pending attempts; count successful captures,
not every attempt. Notification delivery is Phase 9; queued events are sufficient.

## 11. Validate repeat and failure behavior

- Refresh/read status repeatedly: one successful capture and the same receipt.
- If dashboard offers event resend, resend the successful delivery. Expect another
  HTTP 200 acknowledgement with no duplicate payment, confirmation, or receipt.
  If unavailable, mark merchant resend unexecuted; automated tests cover duplicates.
- On a separate booking, choose Fail/cancel or abandon the test checkout. Expect
  no successful capture or confirmation. The app need not label an abandoned
  checkout FAILED; it can remain pending until hold expiration.
- On another booking, leave checkout unpaid until hold expires with the worker
  running. Expect EXPIRED booking and reusable interval, subject to other bookings.
  The worker attempts gateway expiration. If sandbox permits a late capture,
  expect reconciliation and no restoration; if gateway blocks it, record that fact.

Do not manually record the same online capture as another GCash collection.
Ambiguous checkout creation is handled through Admin's Recover an uncertain
PayMongo checkout with matching attempt UUID/session ID. Do not blindly create
another session after a lost response.

## 12. Pass criteria and troubleshooting

Pass requires a real merchant test checkout, correct fee/method, paid merchant
record, signed callback HTTP 200, one local successful capture, CONFIRMED booking,
correct financial identity, and a staff-issued receipt. Record duplicate/failure/
expiry checks as passed, failed, or unexecuted separately. UI simulator results do
not prove real merchant acceptance.

| Problem | Action |
| --- | --- |
| Online unavailable | Verify PAYMENT_PROVIDER, restart API, reload page |
| No GCash / checkout unavailable | Check merchant access/method eligibility and test key; inspect API error; preserve any uncertain attempt |
| Webhook 404 | Check `/api/payments/provider/events`, tunnel API port, and current HTTPS host |
| Webhook 401 | Check endpoint secret/mode, preserved signature/body, and synchronized clock |
| Webhook 400 | Provider payload/session validation failed; preserve sanitized merchant evidence for adapter investigation |
| Webhook 503 | Check outbound merchant API access/test key; allow provider retry and inspect server/tunnel results |
| Paid but pending | Check callback first; then use Check payment status as a separately recorded recovery test |
| Expired booking after success | Compare verification/deadline timing; use Admin reconciliation; no released reservation is restored |
| Guest access lost after reload | Reopen saved private link |
| No receipt | Staff must issue provider receipt explicitly |

Store sanitized acceptance notes: date, booking code, fee, merchant IDs, event type,
HTTP status, local statuses, receipt number, and results. Exclude keys/signing
secrets/guest tokens/private links from shared evidence. Stop the tunnel and test
processes afterward. To disable online mode, edit backend/.env to
PAYMENT_PROVIDER=disabled and restart API/worker. This procedure does not enable
live charging or advance to Phase 7.
