# Email and SMS notification setup: step-by-step guide

Checked against this repository and official provider documentation on October 8,
2026. This system uses **Resend for email** and **PhilSMS for SMS**.
Both integrations already exist. Configure the backend and run the notification
worker; no provider SDK, frontend secret, or new database model is needed.

Use Steps 1–4 for local simulation, Steps 5–8 for real delivery, and Step 11 for
production operation. Existing detailed failure/recovery tests remain in the
[notification testing guide](PHASE_9_TESTING_GUIDE.md).

## 1. Understand how notifications work

```text
Booking/payment/change transaction
    -> NotificationQueue in PostgreSQL
    -> separate notification worker
    -> Resend email OR PhilSMS SMS
    -> customer's inbox or phone
```

The API queues business events; it does not send messages directly. Starting only
the frontend and API is insufficient for delivery.

### Channel selection

| Customer contact data | Selected channel |
| --- | --- |
| Email and phone supplied | EMAIL |
| Phone supplied, email left blank | SMS |

Enabling both providers does not send every event twice. Email failure does not
trigger SMS fallback. Disabling email also does not reroute email rows to SMS:
they remain queued. This is the current implemented business behavior.

Events include payment received, booking confirmed, rescheduled, cancelled,
no-show recovery created, appointment completed, and appointment reminders.
Creating an unpaid hold does not create a confirmation notification.

### Delivery modes and status

| Provider mode | Behavior |
| --- | --- |
| `disabled` | The worker does not claim that channel's queued messages |
| `test` | Simulates acceptance and marks the row SENT; sends nothing externally |
| `resend` / `philsms` | Calls the corresponding provider and can send real messages |

For real providers, `SENT` means the provider accepted the request. It does not
prove inbox/handset delivery. There is currently no notification management screen,
delivery-status webhook, or stored provider message ID in NotificationQueue. Use
the SQL checks below and the provider dashboard, then confirm actual receipt.

## 2. Prepare the application and a controlled database

1. Complete the [system setup guide](SETUP_AND_TESTING.md) through database
   initialization. You need Node.js 24, PostgreSQL, installed dependencies, a valid
   `backend/.env`, and an active Admin/Cashier account.
2. Use a dedicated development/QA database for notification testing. For real
   delivery, use only recipients you control and who expect the test messages.
3. Stop the notification worker with Ctrl+C before changing provider settings.
   Confirm no other notification worker uses the same database.
4. Preserve database, JWT, payment, and origin settings. Edit existing entries in
   `backend/.env` rather than adding duplicate variables. Keep secrets out of
   `.env.example`, frontend files, Git, and shared reports.

**Before switching a channel from test/disabled to a real provider, review its
queue.** Enabling a real provider can send all due pending messages and reclaim
stale processing messages, including old test bookings. Use a fresh QA database
if existing recipients are unsuitable; do not blindly delete or reset queue history.

For a new checkout, run from `backend/`:

```bash
cd /home/nonchalance/salon_project/backend
npm run db:validate
npm run db:generate
npm run db:migrate
```

Do not reseed an established database containing appointments. Notification setup
does not require a new migration beyond the checked-in application migrations.

## 3. Configure local simulation first

Set these entries in `backend/.env`:

```dotenv
NODE_ENV=development
SALON_TIMEZONE=Asia/Manila
NOTIFICATION_EMAIL_PROVIDER=test
NOTIFICATION_SMS_PROVIDER=test
NOTIFICATION_REMINDER_HOURS=0
NOTIFICATION_POLL_MS=5000
NOTIFICATION_LEASE_MS=60000
NOTIFICATION_TIMEOUT_MS=10000
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_BASE_MS=60000
```

Keep reminders off initially so confirmation events are easy to count. Resend and
PhilSMS credentials are not needed in test mode. Leave unused provider fields blank
if stale invalid values cause environment validation errors.

Start these in separate terminals, using Node 24 in each:

**Terminal A — API**

```bash
cd /home/nonchalance/salon_project/backend
npm run dev
```

**Terminal B — hold worker**

```bash
cd /home/nonchalance/salon_project/backend
npm run worker:holds
```

**Terminal C — frontend**

```bash
cd /home/nonchalance/salon_project/frontend
npm run dev
```

Leave the notification worker stopped until Step 4. Open
`http://127.0.0.1:3000/api/ready`; expect HTTP 200 and `{"status":"ready"}`.

## 4. Prove the queue and worker work

1. Open `http://127.0.0.1:5173/availability`.
2. Select an available future visit within the configured booking policy.
3. For this simulated email test, enter a valid email address and phone number.
4. Reserve a temporary hold, save its booking code, and keep its private link locally.
5. Confirm the booking before expiration using the existing local payment simulator
   or staff manual fee recording on this test booking. A real PayMongo payment is
   not required to test notifications. See the
   [payment testing guide](PHASE_6_TESTING_GUIDE.md) for simulator configuration.
6. Open your PostgreSQL client on the same development database. For the default
   setup, this command prompts for your password:

   ```bash
   psql -h 127.0.0.1 -U salon_dev -d salon_dev -W
   ```

7. Verify the connection and inspect the booking's notification rows:

   ```sql
   SELECT current_database(), current_user;
   SET TIME ZONE 'Asia/Manila';

   SELECT a."bookingCode", a.status AS appointment_status,
          q.id, q."eventType", q.channel, q.status AS notification_status,
          q."attemptCount", q."scheduledAt", q."sentAt", q."lastError"
   FROM "Appointment" a
   LEFT JOIN "NotificationQueue" q ON q."appointmentId" = a.id
   WHERE a."bookingCode" = 'REPLACE_WITH_BOOKING_CODE'
   ORDER BY q."createdAt", q.id;
   ```

   Replace the booking code. Expected: a confirmed booking with one
   `PAYMENT_RECEIVED` and one `BOOKING_CONFIRMED` row, both EMAIL/PENDING with
   attemptCount 0. There should have been no hold-created notification before
   confirmation. Reminders remain disabled.
8. Start **Terminal D — notification worker**:

   ```bash
   cd /home/nonchalance/salon_project/backend
   npm run worker:notifications
   ```

9. Expect `notification_worker_started` with EMAIL and SMS in enabledChannels,
   followed by `notification_test_accepted` records containing queue IDs/channels.
10. Repeat the SQL query. Both rows should become SENT with attemptCount 1,
    a sentAt value, and no lastError. No email should arrive in test mode.
11. Repeat with a fresh booking, leaving its optional email **blank** and using a
    valid phone number. Expected: SMS rows become SENT in simulation.

Test-mode SENT rows are finished; changing providers does not resend them. Use new
bookings for real delivery checks rather than resetting those rows.

## 5. Set up Resend email

### 5.1 Create the account and verify your sender domain

1. Sign into or create an account at [Resend](https://resend.com/).
2. Open **Domains**, choose **Add Domain**, and enter a domain you control. A sending
   subdomain such as `notifications.your-salon-domain.com` can separate notification
   mail from your main domain.
3. In your DNS host, add the exact verification/sending records Resend displays.
   Copy record names, types, values, and priorities as shown; avoid guessing them.
4. Keep existing website and mailbox records intact. Follow your DNS host's naming
   convention so it does not append the domain twice.
5. Return to Resend and verify until the domain is shown as verified. DNS changes
   may take time. See [Resend domain setup](https://resend.com/docs/dashboard/domains/manage-domains).
6. Choose a sender on that verified domain, for example
   `appointments@notifications.your-salon-domain.com`. Resend allows sender addresses
   on a verified domain; this does not create a receiving mailbox.
   [Verified domains](https://resend.com/docs/dashboard/domains/introduction).

For an initial test without a domain, Resend's `onboarding@resend.dev` sender is
limited to the email associated with your Resend account. It is not a customer
sender. [Resend test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

### 5.2 Create an API key

1. Open **API Keys** in Resend and create a key named for this application/environment.
2. Give it sending permission and, where configured, restrict it to the sender
   domain. Store the generated value securely when displayed.
3. Do not put the key in React/Vite. The backend worker calls Resend directly.
   [Resend API key management](https://resend.com/docs/dashboard/api-keys/introduction).

### 5.3 Configure and test real email

Stop Terminal D. Review pending recipients privately before enabling delivery:

```sql
SELECT id, channel, status, recipient, "eventType", "scheduledAt", "attemptCount"
FROM "NotificationQueue"
WHERE status IN ('PENDING', 'PROCESSING')
ORDER BY "scheduledAt";
```

This query includes contact data; do not share its output. Then edit `backend/.env`:

```dotenv
NOTIFICATION_EMAIL_PROVIDER=resend
RESEND_API_KEY=YOUR_ACTUAL_RESEND_API_KEY
NOTIFICATION_EMAIL_FROM=appointments@notifications.your-salon-domain.com
NOTIFICATION_SMS_PROVIDER=disabled
NOTIFICATION_REMINDER_HOURS=0
```

Replace both placeholders. This application's sender validator accepts a **bare
email address**, not `Salon Name <address@example.com>`.

1. Restart the API, hold worker, and notification worker so all processes use the
   same valid environment. Live email can be tested with `NODE_ENV=development`.
2. Create and confirm a **new** booking using your own receiving email address.
3. Inspect its rows using Step 4's query. Expect two EMAIL rows to become SENT.
4. Inspect Resend's email/log dashboard for the matching recipient, subject, and
   time. Check for rejection, bounce, or delivery information.
5. Open the recipient inbox and spam folder. Verify the booking code and the
   confirmation's appointment date/time with the Asia/Manila label.

**Pass:** both expected messages actually arrive and match the booking. Queue SENT
alone is insufficient. The current templates send plain text; they do not attach
receipts or include private guest access tokens/links.

## 6. Set up PhilSMS for Philippine recipients

1. Create an account at [PhilSMS](https://philsms.com/), obtain an API token,
   register your sender ID and wait for approval. Ensure SMS credits are available.
2. Use your `dashboard.philsms.com` account token. The adapter sends to
   `https://dashboard.philsms.com/api/v3/sms/send`. The older `app.philsms.com`
   portal does not accept this dashboard token. Read-only balance and message
   history requests against the dashboard API verified authentication; handset
   delivery still requires a controlled send after sender approval.
3. Stop the notification worker and inspect pending recipients using Step 5's query.
   Use only recipients who expect these messages. Edit existing backend/.env entries:

```dotenv
NOTIFICATION_EMAIL_PROVIDER=disabled
NOTIFICATION_SMS_PROVIDER=philsms
PHILSMS_API_TOKEN=YOUR_PRIVATE_API_TOKEN
PHILSMS_SENDER_ID=YourSalon
NOTIFICATION_REMINDER_HOURS=0
```

4. Replace placeholders with your token and approved alphanumeric sender name
   (up to 11 characters). Remove obsolete TWILIO_* entries. Keep SMS disabled
   until credentials and pending recipients are ready. No webhook/ngrok is needed.
5. Restart the API and workers. Create a new booking with email blank and your own
   Philippine mobile in local 09 or international +639 format. The adapter sends
   digits beginning 639; unsupported destinations fail before a network request.
6. Confirm the booking before expiration. Inspect SMS PAYMENT_RECEIVED and
   BOOKING_CONFIRMED rows using Step 4's query. Email supplied selects EMAIL even
   when its provider is disabled.
7. Check the PhilSMS dashboard and actual handset for correct booking text/time.

**Pass:** the intended handset receives the correct text. SENT means API acceptance,
not carrier delivery. An HTTP success containing status error becomes terminal
PROVIDER_REJECTED; malformed responses become retryable INVALID_PROVIDER_RESPONSE.
Raw provider errors are never stored. Non-ASCII text uses Unicode mode, which can
increase billable segments. Use a new controlled booking after fixing failures;
do not reset queue history. Complete provider sender/recipient requirements before
customer rollout.

## 7. Enable both providers together

After each channel passes independently, use this combined backend configuration:

```dotenv
SALON_TIMEZONE=Asia/Manila
NOTIFICATION_EMAIL_PROVIDER=resend
RESEND_API_KEY=YOUR_ACTUAL_RESEND_API_KEY
NOTIFICATION_EMAIL_FROM=appointments@notifications.your-salon-domain.com
NOTIFICATION_SMS_PROVIDER=philsms
PHILSMS_API_TOKEN=YOUR_PRIVATE_API_TOKEN
PHILSMS_SENDER_ID=YourSalon
NOTIFICATION_REMINDER_HOURS=24
NOTIFICATION_POLL_MS=5000
NOTIFICATION_LEASE_MS=60000
NOTIFICATION_TIMEOUT_MS=10000
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_RETRY_BASE_MS=60000
```

Review pending messages, replace placeholders, and restart backend processes.
Test one new confirmed booking with email (email delivery) and another without
email (SMS delivery). This configuration does not introduce dual-channel sending.

## 8. Test appointment reminders and event changes

1. Set `NOTIFICATION_REMINDER_HOURS=24` and restart the notification worker.
2. Confirm an appointment in the next 24 hours but still beyond the configured
   minimum booking lead time. Choose an actually available slot.
3. Wait for the worker and inspect its notification rows. Expect one
   `APPOINTMENT_REMINDER` for that schedule revision, in addition to confirmation
   and payment events.
4. Verify the reminder arrives through the selected channel and shows the correct
   salon-local time. Repeated scans/restarts should not create another reminder
   for the same schedule revision.
5. Use an eligible booking to test rescheduling and cancellation. A reschedule can
   produce a new reminder for the new schedule; obsolete queued reminders are
   suppressed with `REMINDER_OBSOLETE`. A message already sent cannot be recalled.
6. Inspect completion and recovery wording with the relevant booking workflows in
   the [system testing guide](SETUP_AND_TESTING.md).

The 24-hour setting is a **look-ahead window**, not a daily send time or a guarantee
of exactly 24 hours' notice. A booking confirmed six hours before its start can be
reminded on the next scan. Zero disables new reminder scanning; it does not cancel
already queued reminders. Disabling a delivery channel leaves its rows queued.

## 9. Understand worker timing, errors, and retries

| Variable | Default | Meaning |
| --- | --- | --- |
| `NOTIFICATION_POLL_MS` | 5000 | Delay before the next worker cycle |
| `NOTIFICATION_TIMEOUT_MS` | 10000 | Maximum time allowed for a provider request |
| `NOTIFICATION_LEASE_MS` | 60000 | Time after which an abandoned PROCESSING claim can be reclaimed |
| `NOTIFICATION_MAX_ATTEMPTS` | 5 | Maximum attempts per queue row |
| `NOTIFICATION_RETRY_BASE_MS` | 60000 | Initial retry delay; doubles with attempts, capped at an hour |
| `NOTIFICATION_REMINDER_HOURS` | 24 | Upcoming confirmed appointment window; 0 disables scanning |

Keep the defaults initially. Environment validation requires the lease to exceed
the timeout by more than one second. Transient errors such as HTTP 429 or 5xx are
retried up to the attempt limit. Permanent errors become FAILED. FAILED rows are
not automatically retried just because credentials are corrected.

Inspect current status without exposing recipients:

```sql
SELECT channel, status, COUNT(*)
FROM "NotificationQueue"
GROUP BY channel, status
ORDER BY channel, status;

SELECT id, "eventType", channel, status, "attemptCount", "lastError",
       "scheduledAt", "sentAt", "updatedAt"
FROM "NotificationQueue"
WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
ORDER BY "scheduledAt"
LIMIT 100;
```

Resend requests use the queue ID as an idempotency key. The PhilSMS adapter does
not assume an idempotency guarantee; a crash after provider acceptance can cause
a resend. Inspect provider history before retrying uncertain deliveries. There is
no implemented Admin retry button: investigate terminal failures and use a fresh
controlled booking for setup retests rather than bulk-resetting rows.

## 10. Troubleshoot

| Symptom | Action |
| --- | --- |
| No notifications after creating a hold | Confirm it by fee payment; unpaid holds have no confirmation event. |
| PENDING with attemptCount 0 | Check worker process, database, enabled channel, and scheduledAt. Exported shell variables can override `.env`. |
| SENT but no actual message | Confirm provider is not `test`; inspect provider dashboard and inbox/handset. SENT only means acceptance. |
| SMS never attempted | Check whether the booking has an email; the routing rule selects email first. |
| Invalid environment configuration | Correct the named variables, bare sender email, approved sender ID, and secret values; restart processes. |
| Resend 401/403 | Check API key, domain restrictions, verified sender domain, and resend.dev recipient restrictions. |
| Email accepted but missing | Check provider bounce/suppression/delivery details and recipient spam filters. |
| PhilSMS 400/401/403 | Inspect PhilSMS Console details: API token, approved sender, credits, recipient, and account status. |
| PhilSMS accepted but phone receives nothing | Inspect subsequent carrier delivery/error status and Philippine sender registration. |
| `INVALID_RECIPIENT` | Correct email/phone format; dummy numbers are unsuitable for real delivery. |
| `PROVIDER_HTTP_429` or 5xx | Review provider limits/health; allow scheduled retries and inspect attempt count. |
| `PROVIDER_TIMEOUT` / `PROVIDER_UNAVAILABLE` | Check outbound HTTPS, DNS, credentials, and provider logs; inspect acceptance before retrying. |
| `INVALID_PROVIDER_RESPONSE` / `PROVIDER_REJECTED` | Review provider evidence and adapter expectations; do not label delivery successful. |
| `REMINDER_OBSOLETE` | Expected when a queued reminder no longer matches an eligible current schedule. |
| `ATTEMPTS_EXHAUSTED` or FAILED | Investigate cause/provider history; changing configuration alone does not requeue terminal rows. |
| `notification_worker_failed` | Inspect database connectivity, migrations, and process environment. |
| `notification_reminder_scan_failed` | Check database/scanner configuration; delivery of existing queued messages may still continue. |

Unlike PayMongo callbacks, this implementation needs outbound HTTPS access to
`api.resend.com` and `dashboard.philsms.com`, not a public local webhook URL. Do not add
SMTP settings or a Gmail app password: this adapter uses Resend's HTTP API.

## 11. Run checks and operate in production

Run these checks from the initialized checkout:

```bash
cd /home/nonchalance/salon_project/backend
npm run check
node --import tsx --test tests/notifications.test.ts
```

For the database suite, use your dedicated local test role with CREATEDB. Replace
and URL-encode its password; the test runner does not load this variable from `.env`:

```bash
export TEST_DATABASE_ADMIN_URL='postgresql://salon_test:YOUR_TEST_PASSWORD@127.0.0.1:5432/postgres'
npm run test:db
unset TEST_DATABASE_ADMIN_URL
```

Expected: no failed tests and successful build. These tests use controlled
providers; they do not prove live delivery. For crash recovery, concurrent workers,
timeout, and obsolete reminder scenarios, follow the
[detailed notification tests](PHASE_9_TESTING_GUIDE.md).

For production:

1. Follow [Deployment](DEPLOYMENT.md) for database, secrets, migrations, and process
   supervision. Review pending recipients/events before enabling live channels.
2. Put real provider configuration in the production environment file. The supplied
   systemd deployment uses `/etc/salon/salon.env`, not the checkout's development
   `.env`. Preserve other production settings and use `NODE_ENV=production`.
3. Set each channel to its real provider or `disabled`. Production rejects `test`
   providers. Confirm sender approvals and recipient handling are ready.
4. Build with `npm run build` before compiled startup. The compiled notification
   command is `npm run start:notifications`; the API is `npm start` and hold worker
   is `npm run start:holds`. Production should supervise all three processes.
5. For the supplied installed systemd services, restart and inspect:

   ```bash
   sudo systemctl restart salon@server salon@hold-worker salon@notification-worker
   sudo systemctl status salon@notification-worker
   sudo journalctl -u salon@notification-worker -n 100 --no-pager
   ```

6. Verify worker startup lists the expected channels and check the queue. No
   per-message success log is required for real providers; use queue/provider data.
7. Perform controlled real email and SMS checks with intended recipients, and
   monitor old pending rows, failures, provider usage, and actual delivery.

To pause notifications, stop the notification worker or disable the relevant
channel and restart it. A provider change is effective only after restart; already
accepted messages cannot be recalled. Queue entries remain available for review.

## 12. Record acceptance results

Record the tester, date/time, environment, code revision/working-tree state,
provider modes, sender domain/approved sender, and recipient confirmation without
exposing credentials or customer contact details.

| Check | Expected | Result / evidence |
| --- | --- | --- |
| Local email simulation | EMAIL rows become SENT; no email delivered | NOT RUN |
| Local SMS simulation | Phone-only booking selects SMS | NOT RUN |
| Real email | Provider acceptance and correct inbox receipt | NOT RUN |
| Real SMS | Approved sender, provider result, correct handset receipt | NOT RUN |
| Both enabled | Email supplied selects email; blank email selects SMS | NOT RUN |
| Reminder | One per schedule revision; correct salon time | NOT RUN |
| Cancellation/reschedule | Correct event; stale reminders suppressed | NOT RUN |
| Worker restart | Queue processing resumes without corruption | NOT RUN |
| Automated checks | Backend check and database tests pass | NOT RUN |

Use PASS, FAIL, BLOCKED, or NOT RUN. Record provider approval delays as BLOCKED,
not successful delivery. Track unresolved live acceptance in
[Acceptance backlog](ACCEPTANCE_BACKLOG.md). This setup guide does not change
notification routing, templates, or business rules.
