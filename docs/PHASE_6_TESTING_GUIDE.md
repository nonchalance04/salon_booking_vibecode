# Phase 6 step-by-step testing guide

This guide tests appointment-fee collection, confirmation, receipts, expiration,
reconciliation, and PayMongo GCash checkout. Use a development database and test
payments. The local simulator tests application behavior; PayMongo sandbox tests
the real gateway integration. Complete both before considering merchant acceptance
finished. Notification delivery and post-service settlement belong to later phases.

## 1. Prepare the environment

1. Open a terminal and go to the project:

   ```bash
   cd /home/nonchalance/salon_project
   nvm use
   ```

   The project requires Node.js 24, npm, and a running PostgreSQL server.
   If you do not use nvm, verify `node --version` reports version 24.
2. Install dependencies if this checkout has not been installed:

   ```bash
   cd /home/nonchalance/salon_project/backend
   npm ci
   cd /home/nonchalance/salon_project/frontend
   npm ci
   ```
3. Create `backend/.env` from `backend/.env.example` only if `.env` does not already
   exist. Keep an existing configuration rather than copying over it.
4. Configure a dedicated development database and your own seed credentials:

   ```dotenv
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/salon_dev?schema=public
   SALON_TIMEZONE=Asia/Manila
   TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   SEED_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
   SEED_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
   SEED_CASHIER_EMAIL=YOUR_CASHIER_EMAIL
   SEED_CASHIER_PASSWORD=YOUR_CASHIER_PASSWORD
   PAYMENT_PROVIDER=test
   PAYMENT_TEST_SECRET=ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   ```

   Replace every placeholder. Use passwords of at least 12 characters. Generate
   each secret separately with:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
5. For a fresh development database, apply migrations and seed:

   ```bash
   cd /home/nonchalance/salon_project/backend
   npm run db:validate
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   For an existing initialized database, do not re-seed merely to test payments.
   Seeding refuses to rewrite configuration once appointments exist. Use its
   existing staff credentials and configuration. Migrations do not reset data.

Expected: migration/seed commands succeed on a fresh database. The standard seed
sets a PHP 100.00 fee, a 10-minute hold, a 60-minute minimum lead time, and a
30-day booking window. If your configuration differs, follow the fee/deadline
shown on the booking rather than assuming those defaults.

## 2. Start the three processes

Keep each process in its own terminal.

Terminal A — backend API:

```bash
cd /home/nonchalance/salon_project/backend
npm run dev
```

Terminal B — hold cleanup/payment synchronization worker:

```bash
cd /home/nonchalance/salon_project/backend
npm run worker:holds
```

Terminal C — frontend:

```bash
cd /home/nonchalance/salon_project/frontend
npm run dev
```

1. Open `http://127.0.0.1:3000/api/health`. Expect a successful health response.
   This checks API liveness; the booking workflow also checks database access.
2. Open `http://127.0.0.1:5173/availability`.
3. Keep localhost/127.0.0.1 usage consistent within each browser session.
4. If Vite chooses another port, free port 5173 or update `TRUSTED_ORIGINS` to
   include the actual origin and restart the backend/worker.

## 3. Create a repeatable test booking

Repeat these steps for each scenario; a confirmed or expired booking cannot be
reused as a fresh pending booking.

1. Open `/availability`.
2. Select an active service and qualified staff, or Any available staff.
3. Choose a future date within the booking window. Tomorrow is usually easier
   than today because of minimum lead time.
4. Search for available times and select a displayed candidate.
5. Fill in First name, Last name, Phone, and optionally Email. Use clearly marked
   development test contact data.
6. Click **Reserve a temporary hold**.
7. Record the booking code, displayed fee, hold deadline, service, staff, and time.
8. Copy the **Private booking link** into a private local note. Keep it confidential:
   it authorizes guest access.

Expected: booking starts `PENDING_PAYMENT`, shows a countdown, and displays
**Development payment simulator — no real money is collected.** The private
link is needed after reload because the guest credentials remain in page memory.

## 4. Simulator success and provider receipt

1. Create a fresh booking using section 3.
2. Before the countdown expires, click **Open test payment**.
3. Click **Simulate successful payment**.
4. Read the updated booking and payment history.

Expected: booking is `CONFIRMED`, the countdown is no longer an unpaid-hold
countdown, and exactly one payment is `SUCCEEDED` for the displayed fee.

5. Open the saved private link in another tab. Expect the same confirmed booking.
6. In a separate tab, open `http://127.0.0.1:5173/` and sign in as Admin or Cashier.
7. Admin: choose **Appointment fees**. Cashier: the payment workspace is displayed.
8. Enter the booking code and click **Find booking**.
9. Click **Issue receipt for PHP …** for the successful payment.
10. Refresh the guest booking using **Refresh status** or reopen its private link.
11. Expand **Receipt …** and check booking, customer, amount, currency, method,
    and paid time.

Expected: one receipt appears. Provider callbacks do not create a staff identity;
provider receipts require an authorized staff issuer. The test adapter's method
can show Other, while PayMongo captures use GCash.

## 5. Simulator failure and retry

1. Create another fresh booking.
2. Click **Open test payment**, then **Simulate failed payment**.
3. Check booking and payment history.

Expected: a failed payment is recorded, booking remains `PENDING_PAYMENT` while
its hold is active, and no successful-payment receipt is available.

4. Click **Open test payment** again, then simulate success before expiration.

Expected: one failed attempt and one successful attempt remain in history. Only
the successful attempt confirms the appointment. Refresh/private-link retrieval
must show the same result.

## 6. Manual collection and duplicate reference

Use development records only: this form records receipt of money; it does not
transfer cash or call GCash.

1. Create a fresh unpaid booking and copy its booking code.
2. Sign in as Admin or Cashier and find that booking.
3. Select **Cash** as the payment method.
4. Enter a unique reference, such as `PH6-MANUAL-001`.
5. Tick **I have verified receipt of PHP …**.
6. Click **Record received appointment fee** before hold expiration.
7. Check staff history and the guest private link.

Expected: `CONFIRMED`, one successful payment, and one receipt created together.

8. Find the same booking again.
9. Submit the same method and original reference `PH6-MANUAL-001` again.
10. Inspect history and the Admin list with **Show only payments requiring
    reconciliation** unchecked.

Expected: the original payment/receipt is returned; no second collection or
receipt is created. Use the same reference when retrying an uncertain submission.

11. Optional: repeat on another fresh booking using **GCash** and a distinct
    development reference. This exercises manual GCash recording; it does not
    test the PayMongo API.

## 7. Expiration and late collection

1. Create another unpaid booking.
2. Do not pay. Keep the worker running and wait past the displayed hold deadline
   (10 minutes for the unchanged seed).
3. Click **Refresh status**.
4. Search availability for the same service/staff/time.

Expected: booking is `EXPIRED`; its interval is reusable if no other reservation
or configuration change blocks it. Expiration retains booking/service history.

5. Sign in as Admin/Cashier and find the expired booking.
6. Record a simulated manual collection with a new reference `PH6-LATE-001`.
7. As Admin, inspect **Payment reconciliation** with its default review filter.

Expected: payment is `SUCCEEDED` but requires reconciliation; the booking stays
`EXPIRED`. Guest history shows **Salon review required**. No released reservation
is restored. This phase provides review, not automated refunds.

8. Optional: submit a distinct additional collection on an already confirmed
   test booking using reference `PH6-EXTRA-001`.

Expected: original confirmation remains, and the separate additional collection
is preserved for reconciliation without applying a second booking fee.

## 8. Role and guest-access checks

1. Sign out of the staff workspace. Expect login to be required for staff actions.
2. Sign in as Cashier. Expect booking lookup, manual collection, and receipt
   issuance; the Admin reconciliation list and recovery controls are absent.
3. Sign in as Admin. Expect reconciliation and recovery controls.
4. Open `/appointment` without a private link. Try a booking code without its
   correct token. Expect no access to private appointment details.
5. Reopen the saved private link. Expect access restored.

Automated tests below verify direct API permissions as well as these UI boundaries.

## 9. Configure PayMongo sandbox

Complete this after simulator/manual tests pass.

1. Get the merchant **Secret Test key** (`sk_test_...`) through PayMongo's
   **Settings → Developers**. Hosted Checkout supports test mode:
   <https://docs.paymongo.com/docs/payment-channels-testing>.
2. Confirm GCash is enabled/available for the merchant test checkout.
3. Make the local backend port 3000 reachable through a public HTTPS development
   tunnel you control, or use an HTTPS staging API. The tunnel must forward to the
   API, not Vite. Keep it running throughout acceptance. No tunnel tool is bundled
   or required by this repository; follow your chosen tool's setup instructions.
4. In PayMongo **Settings → Webhooks**, register:

   ```text
   https://YOUR_PUBLIC_API_HOST/api/payments/provider/events
   ```

5. Subscribe to `checkout_session.payment.paid` in the test environment and copy
   this endpoint's signing secret. Follow the official setup:
   <https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start>.
6. Edit local `backend/.env`:

   ```dotenv
   PAYMENT_PROVIDER=paymongo
   PAYMONGO_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY
   PAYMONGO_WEBHOOK_SECRET=YOUR_ACTUAL_ENDPOINT_SIGNING_SECRET
   PAYMONGO_RETURN_URL=http://127.0.0.1:5173/appointment
   ```

7. Keep `NODE_ENV=development` and include `http://127.0.0.1:5173` in
   `TRUSTED_ORIGINS`. The return path must be exactly `/appointment`, without
   query/fragment or guest credentials. Keep secrets in `.env` rather than chat,
   screenshots, source files, or Git.
8. Stop API/worker with Ctrl+C and restart both. Reload the frontend.
9. Open `http://127.0.0.1:3000/api/payments/options`. Expect provider `paymongo`,
   onlineAvailable true, testMode false, and sandbox true. Here testMode means the
   local simulator, so false is correct for PayMongo sandbox.

## 10. PayMongo success, callback, and receipt

1. Create a fresh booking and save its private link.
2. Expect the **PayMongo sandbox — no real money is collected** notice.
3. Click **Pay with GCash**. Expect a pending payment and checkout link.
4. Click **Continue to GCash on PayMongo**. Keep the original booking tab open.
5. Check the hosted amount matches the appointment fee and GCash is the offered
   payment method. Use the sandbox flow/options shown by PayMongo.
6. Complete sandbox success before the booking countdown expires.
7. Inspect the test payment/session in PayMongo. Record the session `cs_...` and
   captured payment `pay_...` identifiers privately for troubleshooting.
8. Inspect webhook delivery for `checkout_session.payment.paid` and verify HTTP
   200 from the application's endpoint. A successful merchant payment alone does
   not prove webhook delivery.
9. Return to the original booking tab and use **Refresh status**. Then use
   **Check payment status** if that control remains visible.

Expected: one successful GCash payment for the exact PHP fee and `CONFIRMED`
booking. Returning to `/appointment` alone never confirms payment. If the return
page asks for retrieval, go to the original tab or reopen the saved private link.

10. As staff, find the booking and issue the provider payment receipt.
11. Refresh the guest history and verify the receipt amount/method.
12. As Admin, uncheck the reconciliation-only filter and verify the original
    successful payment is listed without requiring review.

## 11. PayMongo retry, cancellation, and expiration checks

Use separate fresh bookings for cancellation and expiration.

- Pending retry: create checkout, reopen the saved private link while the hold is
  active, and request checkout again if offered. Expect the same pending attempt
  and session, rather than a second create. Refreshing status does not create a
  new charge. Verify the session count in merchant records where available.
- Duplicate callback: if the merchant dashboard offers a delivery resend action,
  resend the successful event and verify there is still one successful payment,
  one confirmation, and the same receipt. Do not handcraft a PayMongo signature.
  If resend is unavailable, the automated suite covers duplicate handling; record
  merchant duplicate-delivery acceptance as unexecuted.
- Cancelled/incomplete checkout: cancel or close a fresh checkout without paying,
  return to the original tab, and refresh/check status. Expect no successful
  capture or confirmation. A cancellation redirect need not mark payment FAILED;
  the hold can remain pending until expiration.
- Expired unpaid session: open checkout but leave it unpaid until the hold expires.
  Expect `EXPIRED` booking. The worker attempts to expire known unpaid sessions.
  Gateway expiration may be refused while payment is in progress; the booking
  deadline remains authoritative.
- Late gateway success: where sandbox permits completion after expiration, expect
  a successful captured payment flagged for reconciliation and an expired booking.
  If PayMongo prevents completion of the expired session, record that behavior;
  use section 7 and automated tests for deterministic late-capture verification.

## 12. Recover an uncertain checkout (conditional test)

This is relevant when PayMongo created a session but the API response was lost.
Do not deliberately create extra merchant charges to manufacture this condition.
The automated suite injects it safely.

1. Admin: find the booking and copy its **Pending payment attempt** ID.
2. Locate the matching merchant session using its reference number/metadata.
3. Open **Recover an uncertain PayMongo checkout**.
4. Enter the payment attempt UUID and its matching `cs_...` session ID.
5. Click **Verify and recover checkout** and find/refresh the booking again.

Expected: the backend verifies the merchant association and recovers the existing
session or capture. An unpaid recovered session stays pending; a timely verified
capture confirms; a late capture requires review. Never manually record that same
online capture as a separate GCash collection.

## 13. Run automated verification

Backend validation, unit/API tests, and production build:

```bash
cd /home/nonchalance/salon_project/backend
npm run check
```

Full PostgreSQL integration suite (separate test server/role with CREATEDB):

```bash
export TEST_DATABASE_ADMIN_URL='postgresql://USER:PASSWORD@localhost:5432/postgres'
npm run test:db
```

Tests require the shell variable explicitly; they do not load `.env` for this
connection. They create/migrate/seed/drop their own random `salon_test_*` databases.
The last verified suite reported 29 unit/API tests and 63 database test results,
with no failures/skips; counts can change as the repository evolves.

Frontend type check and production build:

```bash
cd /home/nonchalance/salon_project/frontend
npm run build
```

Expect exit code zero for every command. Preserve failure output and do not mark a
failed/skipped scenario as passed. Tests cover forged signatures, wrong money and
identities, duplicate captures, transaction rollback, lock/deadline races, missing
reservation ownership, uncertain creation, gateway outages, recovery, and expiry.
They use mocked PayMongo responses rather than the merchant's actual API.

## 14. Troubleshooting

| Symptom | Check/action |
| --- | --- |
| Online payment not configured | Check PAYMENT_PROVIDER; restart API and reload frontend |
| API fails startup | Read validation errors; check database, secret length, test/live mode, and exact trusted return URL |
| Origin rejected / login fails | Use the exact configured browser origin/port; restart after changing TRUSTED_ORIGINS |
| No availability | Choose a future date inside policy limits; check active service, qualifications, staff schedule, closures, and existing reservations |
| No effective policy on a fresh seed | Seed policy begins October 1, 2026; verify machine date and effective policy in Admin configuration |
| Refresh loses guest access | Reopen saved private link; guest credentials are intentionally held in memory |
| PayMongo paid, booking pending | Check webhook delivery and worker/API configuration; use Check payment status while available; inspect server errors and merchant session |
| Webhook signature rejected | Check the endpoint signing secret, test/live environment, host clock, and that forwarding preserves body bytes/header |
| Gateway unavailable | Keep merchant records; do not invent a manual duplicate or repeatedly create new attempts; use recovery for uncertain checkout |
| Booking expired despite payment | Compare actual processing/hold times; late verification cannot restore the reservation; inspect Admin reconciliation |
| Receipt missing after online success | Staff must explicitly issue it; manual receipts are atomic |
| test:db skipped/fails connecting | Export TEST_DATABASE_ADMIN_URL in that same terminal; verify PostgreSQL and CREATEDB permission |
| No SMS/email arrives | Phase 6 queues events; delivery is Phase 9 |

## 15. Record acceptance and stop

For each scenario record date, booking code, fee, expected result, observed result,
pass/fail/unexecuted, and sanitized error details. Record merchant session/payment
identities privately, but exclude guest tokens, private links, API keys, and signing
secrets from shared evidence.

Minimum acceptance: simulator success/failure, manual collection and duplicate
reference, provider receipt, expiration and late reconciliation, role/private
access checks, all automated checks, and actual PayMongo sandbox success with
confirmed webhook delivery. Record unsupported/unexecuted merchant cases explicitly.

Stop test servers with Ctrl+C. Keep development records for evidence; no database
reset is required. Before returning to disabled online mode, set
`PAYMENT_PROVIDER=disabled` and restart API/worker. Do not enable live keys as part
of this guide. Phase 7 requires a separate implementation request.
