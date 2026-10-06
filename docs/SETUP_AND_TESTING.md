# System setup and testing guide

This guide covers the current Salon Booking and Appointment System, from a fresh
local database to guest, Admin, and Cashier acceptance testing. Commands assume
Bash on Linux and the checkout at `/home/nonchalance/salon_project`. Replace that
path if your checkout is elsewhere. Use a dedicated development database.

The application has four long-running processes: the Express API, Vite frontend,
hold cleanup worker, and notification worker. PostgreSQL must also be running.
There is no root-level npm command: run commands in `backend/` or `frontend/`.

## 1. Check prerequisites

Install Node.js 24 with npm, PostgreSQL server and its `psql` client, and Git if
you need to obtain the checkout. PostgreSQL 18 is the version used by project CI.
Use your operating system's installation method; the commands below assume these
tools are already installed and PostgreSQL is running.

```bash
cd /home/nonchalance/salon_project
nvm use
node --version
npm --version
psql --version
pg_isready -h 127.0.0.1 -p 5432
```

If nvm is not installed, skip `nvm use` and ensure `node --version` reports `v24.x`.
`pg_isready` should report that the server accepts connections. Check the actual
server version with `SELECT version();` when connected in the next step.

## 2. Create development and test database roles

For a fresh local PostgreSQL installation on Linux, open its administrator shell:

```bash
sudo -u postgres psql
```

If PostgreSQL uses another administrator login, connect with that login instead.
Run the following SQL/psql commands only if these roles/database do not exist:

```sql
CREATE ROLE salon_dev LOGIN;
\password salon_dev
CREATE DATABASE salon_dev OWNER salon_dev;
CREATE ROLE salon_test LOGIN CREATEDB;
\password salon_test
SELECT version();
\q
```

Enter a separate password at each prompt and keep both locally. The development
role owns the application database. The test role creates disposable databases
on this local server; it does not need superuser privileges. Never use a production
server for the test suite.

Verify the development connection; `-W` prompts for its password:

```bash
psql -h 127.0.0.1 -U salon_dev -d salon_dev -W -c 'SELECT current_database(), current_user;'
```

Expected: database and user both equal `salon_dev`. For an existing development
installation, reuse its database and credentials instead of creating replacements.

## 3. Install dependencies

```bash
cd /home/nonchalance/salon_project/backend
npm ci
cd /home/nonchalance/salon_project/frontend
npm ci
```

Both commands must finish successfully. Use the checked-in lockfiles; dependency
upgrades are not required for setup.

## 4. Configure the backend

Create the environment file only if it does not already exist:

```bash
cd /home/nonchalance/salon_project/backend
if [ ! -f .env ]; then cp .env.example .env; fi
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run the secret-generation command twice, using one result for `JWT_SECRET` and
the other for `PAYMENT_TEST_SECRET`. Edit `backend/.env` with your editor:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
DATABASE_URL="postgresql://salon_dev:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/salon_dev?schema=public"
JWT_SECRET=YOUR_FIRST_GENERATED_SECRET
SALON_TIMEZONE=Asia/Manila
TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
COOKIE_SAME_SITE=lax
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
SEED_CASHIER_EMAIL=cashier@example.test
SEED_CASHIER_PASSWORD=YOUR_CASHIER_PASSWORD
PAYMENT_PROVIDER=test
PAYMENT_TEST_SECRET=YOUR_SECOND_GENERATED_SECRET
NOTIFICATION_EMAIL_PROVIDER=test
NOTIFICATION_SMS_PROVIDER=test
```

Replace all placeholders. URL-encode special characters in the database password
when placing it in a connection URL. Use distinct Admin/Cashier passwords with at
least 12 characters and at most 72 UTF-8 bytes. Preserve the remaining defaults
from `.env.example`. Do not put secrets in frontend files or commit `.env`.

These provider modes simulate payments and notification acceptance locally. No
money moves and no email/SMS is delivered. Use `disabled` instead of `test` for
any provider you do not want enabled. Restart backend processes after env changes.

## 5. Initialize the development database

```bash
cd /home/nonchalance/salon_project/backend
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:status
npm run db:seed
```

Expected: schema validation succeeds, Prisma Client generates, checked-in migrations
apply, migration status is current, and the development seed completes.

**Existing database:** apply pending migrations, but skip `db:seed` if it is already
configured or contains appointments. Seeding refreshes fixture credentials and
configuration and refuses to proceed once appointments exist. Do not reset a
database to bypass that protection.

The fresh seed provides:

| Item | Initial value |
| --- | --- |
| Login accounts | One Admin and one Cashier using your seed credentials |
| Catalog/staff | 30 services, 3 staff, 90 staff-service qualifications |
| Salon hours | Daily, 08:00–22:00 |
| Appointment fee | PHP 100.00, separate from the service charge |
| Temporary hold | 10 minutes |
| Default service buffer | 15 minutes |
| Booking range | At least 60 minutes ahead, up to 30 days ahead |
| Customer changes | Up to 2 reschedules; 4-hour reschedule/cancellation cutoff |
| No-show recovery grace | 72 hours |

Use current UI values if an Admin has changed configuration. The initial policy
becomes effective on October 1, 2026 in Asia/Manila; a machine clock earlier than
that will not see it as active. Do not change the clock to test deadlines.

## 6. Run automated validation

Run the backend checks:

```bash
cd /home/nonchalance/salon_project/backend
npm run check
```

This validates/generates Prisma, checks TypeScript, runs unit/API tests, and builds
the backend. It does **not** run the PostgreSQL integration suite.

In the same terminal, set the dedicated test connection and run database tests:

```bash
export TEST_DATABASE_ADMIN_URL='postgresql://salon_test:YOUR_TEST_PASSWORD@127.0.0.1:5432/postgres'
npm run test:db
unset TEST_DATABASE_ADMIN_URL
```

Replace and URL-encode the password. Integration tests deliberately do not load
this setting from `.env` and do not fall back to `DATABASE_URL`. They create unique
`salon_test_*` databases, migrate/seed fixtures, run transactional tests, and drop
their own databases afterward. An interrupted process can leave a test database;
identify its exact name before any manual cleanup.

Then validate the frontend:

```bash
cd /home/nonchalance/salon_project/frontend
npm run build
```

Expected: every command exits successfully, test summaries have no failures, and
both builds complete. Record actual test totals rather than relying on counts in
older phase reports. There is no frontend `npm test` script; its build includes
TypeScript checks, and browser acceptance follows below.

For a focused rerun after investigating a failure, for example:

```bash
cd /home/nonchalance/salon_project/backend
node --import tsx --test tests/payments.test.ts tests/paymongo.test.ts
```

## 7. Start the application

Keep each command running in its own terminal. Use Node.js 24 in each terminal.

**Terminal A — API**

```bash
cd /home/nonchalance/salon_project/backend
npm run dev
```

**Terminal B — hold cleanup worker**

```bash
cd /home/nonchalance/salon_project/backend
npm run worker:holds
```

**Terminal C — notification worker**

```bash
cd /home/nonchalance/salon_project/backend
npm run worker:notifications
```

**Terminal D — frontend**

```bash
cd /home/nonchalance/salon_project/frontend
npm run dev
```

Open these endpoints or check with curl:

```bash
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/ready
curl -i http://127.0.0.1:3000/api/services
curl -i http://127.0.0.1:3000/api/payments/options
```

Expected: health and readiness return HTTP 200; readiness returns
`{"status":"ready"}`. The service catalog contains active services and payment
options identify the test provider. Health alone does not prove database access;
readiness checks access to the User table, not every business prerequisite.

Open `http://127.0.0.1:5173`. Use this hostname consistently. Vite proxies `/api`
to backend port 3000. If that port changes, launch the frontend with
`API_PROXY_TARGET=http://127.0.0.1:YOUR_PORT npm run dev`. Port 5173 is strict:
if occupied, Vite fails rather than silently choosing another port.

## 8. Verify login, roles, and configuration

1. Sign in with the seeded Admin credentials. Open **Accounts** and verify both
   seeded accounts exist. Refresh; the authenticated session should restore.
2. Sign out and try an incorrect password. Expect an error and no authenticated
   workspace. Sign in with the Cashier credentials.
3. Expect Cashier tabs **Collections**, **Service settlement**, and **Appointment
   fees**. Admin-only accounts/configuration/reports must not be accessible.
4. Use a separate browser profile for Admin and Cashier when testing both at once;
   ordinary tabs share the login cookie.
5. As Admin, inspect **Salon management**: profile, services, staff, qualifications,
   hours, schedules, and policies. Confirm the intended test services have active
   qualified staff whose schedules cover the chosen time.
6. Optionally create a disposable Cashier account, sign in with it in another
   profile, then deactivate it as Admin. Its next protected request should fail.
   Keep your working Admin active.

## 9. Test the main guest-to-payment flow

Use separate fresh bookings for confirmation, expiration, cancellation, and
settlement scenarios. Keep a private record of each booking's purpose and code.

1. Open `http://127.0.0.1:5173/availability` without signing in.
2. Choose a service and **Any Available** staff, then a date tomorrow within
   configured opening hours. Search and select an available time.
3. Verify the visit preview shows staff, service order, and salon-local times.
4. Enter fictional test customer details and click **Reserve a temporary hold**.
5. Expect `PENDING_PAYMENT`, a booking code, fee, countdown, and private link.
   Save that link privately before navigating away. A code alone cannot retrieve
   the private booking. Reloading requires reopening the saved link or entering
   its credentials again.
6. Complete the displayed local test-payment success flow before the deadline.
   Expect one successful appointment-fee capture and `CONFIRMED`.
7. Refresh repeatedly. Expect the same booking and capture without duplicates.
8. As Admin/Cashier, open **Appointment fees**, find the booking, and issue a receipt
   if none exists. Refresh the guest view and verify fee, currency, and receipt.
9. Create another fresh booking and record a simulated manual collection through
   **Appointment fees**, using a unique test collection reference. Expect one
   receipt and confirmation. Keep the original reference for any uncertain retry.

The manual collection UI records a staff assertion; it does not charge GCash.
Do not record the online capture again as a manual collection. Detailed simulator,
duplicate, failure, and late-payment scenarios are in the
[payment testing guide](PHASE_6_TESTING_GUIDE.md).

## 10. Test expiration and competing bookings

1. Reserve a new hold and leave it unpaid. Wait past the displayed deadline with
   the hold worker running, then refresh. Expect `EXPIRED` and preserved history.
2. Search the same interval. It can be available again if it still meets lead-time,
   schedule, and other booking constraints.
3. In two guest windows, search the same service, **specific staff**, and start time
   before either submits. Reserve it in the first window, then submit the stale
   selection in the second. Expect a conflict in the second, with no overlapping
   reservation. Search again to recover.

Selecting Any Available may legitimately assign different staff, so use specific
staff for this conflict check. Automated database tests cover more concurrency and
deadline boundaries without requiring manual database edits.

## 11. Test changes, cancellation, and no-show recovery

1. Create and confirm a booking more than four hours ahead under the seed policy.
   Open its private link and select **Reschedule or change services**.
2. Choose a different available time and confirm. Expect the new schedule and an
   incremented reschedule count. For a multi-service booking, also test retaining,
   removing, and adding services; retained snapshots must remain historical.
3. On another eligible confirmed booking, cancel through its private link. Expect
   `CANCELLED`, preserved payment/history, and released reservations.
4. Test a cutoff/limit rejection when an eligible fixture exists. Expect an error
   and no unintended change to the original reservation.
5. For a confirmed booking whose no-show eligibility time has actually passed,
   use Admin → **Appointments** to mark it as no-show. A future booking must not
   allow early marking.
6. Within its recovery grace, use the guest link to create a replacement and save
   the new private link. Valid unused fee credit should confirm the replacement;
   otherwise expect a normal payment hold. The original remains `NO_SHOW` and
   only one linked replacement is allowed.

If no time-eligible manual fixture exists, mark that scenario BLOCKED and use the
automated suite for boundary verification. Do not change business rules, database
timestamps, or the machine clock just to make a manual check pass. See
[Phase 7 verification](PHASE_7_VERIFICATION.md) for additional permutations.

## 12. Test service settlement and receipts

1. As Cashier, open **Service settlement** and find a confirmed multi-service booking.
2. Set each service to **Performed** or **Not performed**, then **Save outcomes**.
   The amount due must equal the historical prices of performed services. The
   appointment fee remains separate; do not subtract it from the service collection.
3. Record a simulated full collection with a unique test reference and finalize.
   Expect `COMPLETED`, one service-payment receipt, and immutable final outcomes.
4. Refresh and verify no duplicate payment/receipt. As Admin, open **Outcomes &
   commissions** and verify final commissions and fee allocations.
5. On another booking, save outcomes as Cashier, then correct them as Admin before
   finalization. Attempt settlement from the Cashier's stale review; expect a
   refresh requirement, then verify the corrected charge after refreshing.
6. On a third booking, mark every service **Not performed** and finalize no-service
   closure. Expect no service payment, service receipt, or commission; retain the
   original appointment-fee history.
7. Print each receipt separately. Check item names, totals, customer, method,
   reference, and timestamp. Only the selected receipt should print. Test long
   names, narrow screens, and multiple pages in native print preview.

Admin can correct saved outcomes before finalization; Cashier performs final
settlement/closure. See [Phase 8 verification](PHASE_8_VERIFICATION.md).

## 13. Test notifications, reports, and the assistant

1. With both notification providers set to `test`, confirm a new booking and leave
   the notification worker running. Verify queued confirmation/payment events are
   processed using the queue inspection steps in the
   [notification testing guide](PHASE_9_TESTING_GUIDE.md).
2. Follow that guide for worker restart, reminders, cancellation/reschedule
   suppression, and retry checks. Test-provider `SENT` means simulated acceptance,
   not delivery to an inbox or phone. An unpaid hold should not send confirmation.
3. As Admin, open **Reports & audit**. Choose a period containing your test activity
   and compare receipts, payments, appointments, and audit entries with recorded
   booking codes. Check empty periods and pagination as well.
4. As Cashier, open **Collections** and verify permitted collection information.
   Admin private reports and commissions must remain restricted.
5. Open the salon assistant, ask about services and booking policies, and follow
   its booking link. Responses should match current salon configuration; the
   guided assistant does not require an external AI API key.
6. Repeat representative guest and staff flows on a narrow screen and using only
   the keyboard. Check labels, focus, validation errors, loading states, and retry
   behavior. Record browser/device and any failure.

## 14. Validate real integrations separately

Local tests do not prove merchant or message delivery acceptance.

- **PayMongo sandbox:** follow [PayMongo sandbox validation](PAYMONGO_SANDBOX_VALIDATION.md)
  for test credentials, an HTTPS callback, hosted checkout, signed webhook delivery,
  duplicate/failure behavior, and a staff-issued receipt.
- **Email/SMS:** follow the live-provider sections of the
  [notification guide](PHASE_9_TESTING_GUIDE.md), using intended test recipients.
- **Production:** use [Deployment](DEPLOYMENT.md) and [Operations](OPERATIONS.md)
  for production configuration, Admin bootstrap, process supervision, HTTPS,
  migrations, backups, and restore. Do not use development seed/test providers in
  production or treat Vite's development server as the production host.

Record these independently from local acceptance. Existing outstanding evidence
is tracked in [Acceptance backlog](ACCEPTANCE_BACKLOG.md).

## 15. Troubleshoot and shut down

| Symptom | Check/action |
| --- | --- |
| Node engine error | Activate Node 24 in the current terminal and rerun `npm ci`. |
| Database authentication/connectivity error | Verify PostgreSQL is running, database/role exist, and host/port/password match; URL-encode password characters. |
| Missing tables or generated Prisma module | Run `db:generate`, `db:migrate`, and `db:status` from `backend/`. |
| Invalid environment configuration | Fill the named fields in `backend/.env`; generate secrets separately and restart processes. |
| Integration tests require an admin URL | Export `TEST_DATABASE_ADMIN_URL` in the test terminal; `.env` does not supply it. |
| Permission denied to create database | Use the dedicated local `salon_test` role with CREATEDB. |
| Seed refuses to run | Use existing initialized data/accounts; the seed intentionally protects appointments. |
| Login/write rejected by origin checks | Use `http://127.0.0.1:5173`; trusted origins must match exactly without paths/trailing slashes. |
| Frontend cannot reach API | Check Terminal A, API health/readiness, and Vite's API proxy port. |
| Port 5173 already in use | Stop the known old frontend process before starting another. |
| No available slots | Check active policy, lead/advance limits, opening hours, staff schedules/qualifications, closures, buffers, and other reservations. |
| Booking link no longer opens after refresh | Reopen the saved private link; credentials are not persisted across reloads. |
| Test notifications never arrive | Test providers intentionally send nothing; use queue evidence or run live-provider acceptance. |
| Build passes but browser flow fails | Record the failing workflow separately; builds are not browser acceptance. |

Stop each foreground process with Ctrl+C. Keep the development database for later
testing. To restart, start PostgreSQL and repeat Step 7; migrations are needed
when new ones are introduced, and reseeding is not a normal restart step.

## 16. Record test results

Create a dated result file with tester, date/time and timezone, code revision plus
working-tree state, Node/PostgreSQL versions, browser/device, database name (without
credentials), provider modes, commands executed, and sanitized evidence.

| Test area | Result | Evidence / issue |
| --- | --- | --- |
| Backend check | NOT RUN | |
| PostgreSQL integration suite | NOT RUN | |
| Frontend build | NOT RUN | |
| Health/readiness and login/roles | NOT RUN | |
| Guest booking, payment, receipt | NOT RUN | |
| Expiration and competing bookings | NOT RUN | |
| Changes/cancellation/no-show recovery | NOT RUN | |
| Settlement, commissions, print preview | NOT RUN | |
| Notifications, reports, assistant | NOT RUN | |
| Mobile/keyboard/error recovery | NOT RUN | |
| PayMongo merchant sandbox | NOT RUN | |
| Real email/SMS delivery | NOT RUN | |

Use PASS, FAIL, BLOCKED, or NOT RUN. For failures, record steps, expected/actual
behavior, and retest evidence. Keep passwords, provider secrets, guest tokens, and
private links out of shared reports. Completing this guide does not automatically
close the acceptance backlog or authorize another roadmap task.
