# Phase 6 verification — 2026-10-04

Appointment-fee payment and confirmation are implemented and verified locally.
PayMongo is the selected third-party gateway for GCash. Real merchant sandbox
acceptance remains pending local credentials and a public HTTPS webhook. No new
models or migrations were added; established business rules are unchanged.

## Implemented scope

- Authorized Admin/Cashier manual appointment-fee recording and receipts.
- A signed development/test provider, disabled in production.
- PayMongo hosted checkout restricted to GCash, exact PHP centavos, server-side
  verification, signed raw-body callbacks, and test/live separation.
- Atomic confirmation, audit, and notification outbox entries, coordinated with
  booking and expiration through ordered reservation locks and fresh time checks.
- Idempotent capture processing. Late or additional captures are preserved for
  reconciliation without restoring released reservations or applying another fee.
- Guest payment/status/history UI, staff payment and receipt workspace, and Admin
  reconciliation and uncertain-checkout recovery.
- Durable checkout claims prevent blind repeat creation after an ambiguous network
  result. Verified callbacks or Admin recovery can attach the original session.
- Hold-worker synchronization expires known unpaid PayMongo sessions and processes
  verified captures. Session expiration is best effort; late capture remains safe.

Provider session IDs identify checkout; captured payment IDs identify financial
transactions. Redirects never prove payment. Provider receipts require an authorized
staff issuer under the existing schema; manual receipts are created atomically.
Notification events are queued; delivery belongs to Phase 9.

## Executed checks

| Check | Result |
| --- | --- |
| Prisma validation/generation, backend type checking and build | Passed |
| Backend unit/API suite | 29 passed, no failures/skips |
| Full PostgreSQL integration suite | 63 reported results passed, no failures/skips |
| Frontend type checking and production build | Passed |
| Browser manual/test payment and confirmation flows | Verified during Phase 6 work |
| Browser PayMongo checkout controls | Mocked gateway: GCash link, sandbox notice, original private booking page retained, pending status refresh |

The database count includes parent/subtest results and 20 payment integration tests.
Tests apply existing migrations and seeds to randomly named disposable databases on
an isolated local PostgreSQL instance. The browser used a separate disposable
database and an injected mock PayMongo transport. No merchant API request, real
GCash checkout, live charge, deployment, or user-database migration was performed.

## Business-critical evidence

Tests cover duplicate and distinct captures; wrong amounts, currencies, signatures,
and identities; guest-token and staff-role boundaries; CSRF protection; raw webhook
verification and minimal acknowledgement; concurrent manual collection; late capture
after rebooking; confirmation versus cleanup; deadline crossings while waiting for
Staff/Payment locks and during database writes; reservation revalidation without
repricing snapshots; and rollback when audit/outbox persistence fails.

PayMongo-specific tests cover exact checkout requests, safe checkout URLs, capture
verification, signature age and mode, upstream errors, one creation across retries,
ambiguous creation recovered by callback, authorized session recovery, expiration
synchronization, and late capture reconciliation.

## Reproduction and external acceptance

Run backend `npm run check`, frontend `npm run build`, and backend `npm run test:db`
with a dedicated `TEST_DATABASE_ADMIN_URL`. HTTP tests and local database servers
require permission to open local sockets in restricted execution environments.

Follow the README **PayMongo GCash setup** section. Configure secret values locally,
register a public HTTPS webhook for `checkout_session.payment.paid`, and run the API
and hold worker. Complete a real merchant sandbox checkout and verify the signed
callback, exactly one confirmation/capture, staff receipt, duplicate delivery,
cancelled checkout, and expired-hold handling before enabling live payments.

### Sandbox checkout compatibility follow-up — 2026-10-04

The actual merchant V2 creation response contains only the session ID, type,
checkout URL, mode, and timestamps. The adapter previously required full retrieved
session attributes at creation and rejected this valid response. Creation now uses
a separate summary schema; capture retrieval keeps full identity, amount, currency,
method, mode, and association checks. A regression fixture matches the actual
summary, with negative cases for identity, mode, and URLs.

Backend checks/build pass with 30 unit/API tests after the correction. An actual
unpaid merchant sandbox session was created, retrieved with verified payment and
appointment metadata and PHP 100.00 amount, then expired successfully. Earlier
diagnostic sessions were also expired. No money was collected. This follow-up
does not verify customer authorization, paid capture, or webhook delivery.

Paid-capture response compatibility and webhook delivery remain unverified
against the user's account. Remote CI, production load, and deployment acceptance
also remain unverified. Stop at Phase 6; Phase 7 requires a separate instruction.
