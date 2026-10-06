# Phase 9 verification — 2026-10-04

For repeatable setup, commands, manual scenarios, expected results and a report
template, see [the Phase 9 testing guide](PHASE_9_TESTING_GUIDE.md).

Notification delivery and reminders are implemented using the existing
NotificationQueue and Appointment models. No schema or migration changes were
needed. The user has no selected notification provider account; optional Resend
email and Twilio SMS adapters are included, disabled by default. Live-provider
setup and recipient acceptance remain open in `ACCEPTANCE_BACKLOG.md` (A09).

## Implemented behavior

- Independent notification worker with development and compiled startup scripts,
  bounded settings, safe operational logs, and graceful SIGINT/SIGTERM shutdown.
- Atomic PostgreSQL claims using `FOR UPDATE SKIP LOCKED`, fresh database time,
  bounded processing leases, and incrementing attempt generations. Each worker
  claims a single item immediately before processing. Disabled channels remain queued.
- Recovery of abandoned attempts; terminal failure at the attempt limit. Expired
  claims cannot start delivery, and stale success/failure cannot replace newer results.
- Provider calls outside transactions, abortable timeout, transient-error backoff,
  permanent-error failure, and controlled errors without raw provider/contact data.
- Separate email/SMS provider boundaries, non-production test delivery, Resend stable
  queue-ID idempotency, and Twilio Messaging Service requests. No new dependency.
- Validated plain-text templates for every existing event, including reconciliation,
  unpaid recovery and no-service closure. Recipient validation, Philippine number
  normalization, and salon-local reminder times; no secure guest tokens in messages.
- Configurable 24-hour default reminder window (0 disables), confirmed/future-only
  eligibility, appointment-locked schedule-revision deduplication, bounded scans,
  and pre-send suppression after cancellation, rescheduling or appointment start.
- Notification failure leaves committed bookings and payments unchanged.

## Executed checks

All checks used Node.js 24 and a separately initialized disposable PostgreSQL 18
server on local port 55439. Test suites create and drop their own random databases.
The application database and local credentials were not changed. No real email,
SMS or payment was sent.

- `npm run check`: Prisma validation/generation, TypeScript checks, **41 unit/API
  tests**, and backend production build pass.
- `npm run test:db`: **94 test results pass**, no failures/skips, including all
  **10 Phase 9 integration tests**.
- Frontend `npm run build`: TypeScript and production bundle pass.
- Compiled worker smoke check: migrates a disposable database, processes one test
  notification exactly once, records SENT, omits contact/message text from logs,
  and exits successfully on SIGTERM. Final worker source compiled successfully.
- `git diff --check` passes.

New tests cover competing claims, future/disabled queues, bounded retry schedules,
safe failure data, timeout cancellation, permanent failures, abandoned and exhausted
leases, expired callers, late success/failure versus a new completed attempt,
crash-after-provider-acceptance identity reuse, reminder eligibility/deduplication,
changed schedules, cancellation, past visits, locked appointments, and pagination.
Adapter tests use injected fake HTTP responses to verify requests and error handling.
The prior pg concurrent-query deprecation warning persists in existing regression
tests and remains tracked as A08; no test failed.

## Verification limits and final acceptance

- SENT records provider acceptance (simulated for the test adapter). It does not
  assert inbox/handset delivery. Provider callbacks and delivery-receipt tracking
  are not implemented by this phase's queue model.
- External delivery remains at least once. Resend idempotency expires after 24 hours;
  Twilio message creation has no assumed idempotency. Crash recovery can duplicate
  an externally accepted message.
- Appointment changes committed after the reminder's final eligibility check cannot
  recall an external request already underway. This is documented operationally.
- Resend domain/API setup, Twilio account/Messaging Service/Philippine sender setup,
  live delivery/failure tests, and salon approval of wording and reminder timing
  remain A09. Both live channels remain disabled by default.
- Remote CI execution, prior deferred browser/print acceptance, production process
  supervision and full deployment acceptance remain open. Existing CI globs include
  the new tests automatically.

Phase 10 reports and customer assistance are next and have not started.
