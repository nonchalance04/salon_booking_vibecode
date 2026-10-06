# Phase 10 verification — 2026-10-04

Reports and customer assistance are implemented using existing models. No schema,
models, migrations or dependencies were added. Customer assistance is an explicitly
labelled guided assistant, without an external generative AI provider. The provider
choice was discussed with the user; none has been selected or configured.

## Implemented behavior

- Admin date-filtered appointment, payment-attempt, receipt, finalized commission
  and audit reports; appointment status dashboard and finalized commission total.
- Admin/Cashier collection summary and payment-type/method breakdown. Cashiers cannot
  access general report, dashboard, commission or audit routes/services. Current
  database role and active status remain authoritative over stale JWT role claims.
- Inclusive salon-local dates, maximum 366-day ranges, bounded pages, stable ordering,
  explicit date bases and repeatable-read summaries/counts/pages. Reports are no-store.
- Decimal payment aggregates count source payments once. Carried credits create no
  additional collection. Late/reconciliation payments remain visible as financial
  captures, with successful applied/unapplied and reconciliation amounts distinguished.
- Captures use paidAt (SUCCEEDED or REFUNDED); refunds use refundedAt. Net cash movement
  subtracts period refunds from period captures. Current status classifications are
  not an as-of historical ledger; totals do not claim profit or earned revenue.
- Appointment reports use service snapshots, receipts use stored receipt snapshots,
  and commissions use finalized amounts and rates. Later catalog changes cannot
  recalculate historical values. Audit output excludes nested credential fields and
  provider metadata; appointment output excludes guest credentials.
- `/help` provides guided questions and bounded free-text topic matching. Services,
  prices, contact details, operating hours/closures and current policy come from the
  configuration service. Existing appointment policies remain authoritative for changes.
  Booking, availability and guest-management links lead to existing application flows.
  Chat does not invent slots, access private appointments, mutate records, accept guest
  token fields, call an external AI provider or persist conversation history.

## Executed checks

Using Node.js 24 and the disposable PostgreSQL 18 test server on port 55439; suites
create/migrate/seed/drop their own random databases. The application database and
credentials were not changed, and no live payment or notification was sent.

- Backend `npm run check` passes: Prisma validation/generation, type checking,
  **47 unit/API tests**, and production build.
- Backend `npm run test:db`: **98 results pass**, no failures or skips, including
  **4 new Phase 10 database/API integration tests**.
- Frontend `npm run build`: TypeScript and Vite production bundle pass.
- `git diff --check` passes.

Coverage includes exact Decimal capture/refund reconciliation, carried-credit
non-duplication, failed/pending exclusion, late/resolved unapplied captures, refunds
from other periods, inclusive/exclusive local-day boundaries, DST dates, invalid dates,
bounded pagination, unchanged historical snapshots after catalog edits, recursive audit
redaction, service and HTTP role enforcement, stale role claims, inactive users, chat
input validation, active public services, missing configuration and no chat mutations.
The existing payment regression tests also cover duplicate callbacks/manual retries.

The initial date-bound refinement threw on an invalid calendar date; it was corrected
to produce a validation error, and all checks above passed after the correction.
An initial test fixture mixed checked and unchecked Prisma relation inputs; it was
corrected to connect the recovery/credit relations before the passing full regression.

## Verification limits

- Manual browser/keyboard/responsive acceptance of reports and guided chat is deferred
  in `ACCEPTANCE_BACKLOG.md` A10, following the existing user preference. Build/API
  results do not certify visual or salon acceptance.
- The chatbot has deterministic topic matching, not generative follow-up conversation.
  External AI integration is optional and not configured. Live appointment availability
  is obtained through the linked booking screen, not claimed in chat.
- No report export or new accounting/refund workflow is introduced. Pagination reflects
  current data on each request; concurrent changes can shift rows between separate pages.
- Current status breakdowns may change after later reconciliation/refunds. Capture and
  refund date bases are explicitly different from payment-attempt report creation dates.
- Remote CI and production acceptance remain unobserved. The existing pg client
  concurrent-query deprecation warning persists in regression suites (backlog A08).

Phase 11 — End-to-end acceptance and deployment — is next and has not started.
