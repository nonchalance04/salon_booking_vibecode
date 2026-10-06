# Phase 11 verification — 2026-10-04–05

Phase 11 is in progress. The user selected **local preparation; no hosting target**.
Local acceptance and deployment tooling are implemented. This is not a claim of a
live deployment or complete salon/printer/provider acceptance. No business rules,
models, migrations, external-provider accounts or real collections were changed.

## Changes

- Production API bind address is explicit (`HOST`, default 127.0.0.1).
- `/api/ready` checks database/User-table access with safe 503 output; health remains
  liveness-only. Readiness does not certify migration completeness or provider health.
- A compiled operator-only first-Admin bootstrap validates existing account rules,
  hashes the password, serializes creation on an empty User table, and records a
  SYSTEM audit atomically. No HTTP bootstrap or production fixture seeding exists.
- Linux systemd API/hold-worker/notification-worker template, Caddy HTTPS/static/API
  routing template, production environment example and allowlisted release packager.
- Custom-format backup/checksum and empty-target transactional restore scripts.
- Deployment/recovery runbook and salon operating/sign-off instructions.
- Receipt wrapping fixed for long names/mobile widths. Printing renders only the
  chosen receipt in a body-level print area, avoiding hidden workspace pagination.
- Guest private-link changes in the same tab clear old data and load the new booking;
  request generation prevents a stale retrieval from replacing the current booking.
- Removed pre-existing merge-conflict markers from .gitignore while retaining rules.

## Automated evidence

Node 24.20.0, PostgreSQL 18, isolated local server on 55441. Integration tests use
random disposable databases. Earlier local data/logs expired during the usage
interruption; the final suites were rerun on October 5.

- `backend/npm run check`: **48 unit/API tests pass**, Prisma validation/generation,
  TypeScript and production backend build pass.
- `backend/npm run test:db`: **100 results pass**, zero failures/skips.
- New release integration checks: concurrent first-Admin bootstrap (one winner),
  invalid input, existing-user refusal, password hashing and redacted audit;
  real login with production Secure/HttpOnly/SameSite cookies; guest availability;
  **20 simultaneous HTTP bookings of one staff interval: one winner, 19 conflicts**
  (992 ms total in the final run); Cashier fee collection; guest confirmation;
  **10 identical settlement submissions: one payment/receipt/commission**;
  exact PHP 220.00 collection reconciliation; CSRF and forbidden-role checks.
- Readiness failure returns 503/no-store without disclosing database errors while
  `/api/health` stays 200.
- Frontend TypeScript/Vite build passes after receipt and private-link fixes.
- Shell syntax and `git diff --check` pass.
- systemd unit syntax verifies using this machine's installed Node executable.
  The production `/usr/bin/node` path must be verified on the actual host; it is
  absent here. Services were not installed into the host's systemd configuration.

The pre-existing pg concurrent-query deprecation warning was traced with
`--trace-deprecation` through Prisma PgTransaction.performIO and the client engine
query interpreter. The tests still pass. Retain current lockfile versions and
reassess Prisma/adapter support before a pg 9 upgrade; no dependency workaround or
business-locking change was made (A08).

## Observed browser acceptance

In-app Chromium, local frontend 5174 and API 3011, seeded disposable accounts/data,
external payment/email/SMS providers disabled. No real money/messages were sent.

- Guest service/staff/date search, keyboard date selection, booking hold, private
  link, Cashier manual test fee confirmation and guest refresh to CONFIRMED.
- Customer rescheduling moved the booked service to a new date, retained its price,
  and incremented the change count. Customer cancellation showed confirmation and
  transitioned to CANCELLED while retaining the fee record.
- Cashier performed outcome, full service settlement, COMPLETED, disabled finalized
  outcome controls, separate fee/service receipts and PHP 120.00 service charge.
- All-NOT_PERFORMED closure: COMPLETED / NO SERVICE CLOSURE; only the fee receipt remains.
- Admin recorded no-shows for due fixtures; future appointments did not offer marking.
  With credit, guest recovery became CONFIRMED and displayed carried credit with no
  new payment. Without credit, recovery became PENDING PAYMENT with a fresh hold.
- Admin changed a saved PERFORMED outcome to NOT_PERFORMED before finalization;
  Admin view did not offer Cashier finalization controls.
- Cashier collection report showed PHP 620.00 for the fixture set. Admin receipts
  showed six historical records, expanded service-payment snapshot and PHP 88.00
  finalized commission. Audit pagination moved from page 1 to page 2 correctly.
- Same-tab navigation from a cancelled booking to a different no-show link displayed
  the new booking without reload, cleared the fragment, and preserved the original
  no-show/replacement relationship.
- Guided assistant displayed configured fee, hold, lead/advance window, change limits,
  cutoffs, recovery grace, original-policy wording and booking/management links.
- At 390px viewport, long receipt names/IDs wrapped and both receipt widths equaled
  their scroll widths (291px); document width equaled viewport content width (375px).
  See `phase11-receipt-mobile.jpg`. The print action was invoked, but the browser tool
  did not expose a usable native preview/PDF: physical printing and multi-page print
  acceptance remain open. Do not infer print success from the build or screenshot.

Native date fill via automation did not always trigger React changes; keyboard
editing worked and was used for acceptance. A transient local API stop produced a
safe report error; returning to the report after restart initialized the date and
successfully loaded totals.

## Backup and restore drill

Executed the supplied scripts against the isolated acceptance database. Restored
into newly created `salon_restore_phase11`. Compared row counts plus sorted-row
hashes for **all 20 public tables**, including migrations: every row matched. The
restored financial set had **6 payments totaling PHP 620.00**. A repeated restore
was rejected as a nonempty target before any overwrite. This comparison occurred
before subsequent browser cancellation/recovery/correction actions.

This verifies local logical backup/restoration, not off-host retention, role/secret
recovery, managed-provider disaster recovery, or an approved production RPO/RTO.
Those are host/salon-dependent release gates in DEPLOYMENT.md.

## Packaged production runtime

Extracted the candidate archive into a separate directory and ran a fresh
`npm ci --offline --include=dev` from the lockfile. The sandbox blocked native
binary verification; the authorized retry outside the sandbox passed. Packaged
`db:status` confirmed both migrations applied on the restored database.

Started the compiled API, hold worker and notification worker with
`NODE_ENV=production`, loopback binding, an HTTPS trusted origin, isolated restored
data and all external providers disabled. Readiness returned 200; real Cashier
login emitted Secure/HttpOnly/SameSite cookies; the authenticated collection report
reconciled PHP 620.00. Both workers remained running without failure logs through
an initial polling cycle. All three processes exited cleanly on SIGTERM. This is a
process smoke check, not host supervision or sustained-load certification.

The archive allowlist was checked: no `.env`, `node_modules` or development seed.
The final local archive and SHA-256 sidecar are
`dist/salon-release-2026-10-05.tgz` and `.tgz.sha256` (ignored build artifacts).
The same packager rebuilds from this working tree; no Git release or push occurred.

## Remaining release gates

- Select host/domain; validate Caddy on that host, HTTPS/certificates, actual systemd
  services, database role/TLS, monitoring, off-host backup schedule and recovery cutover.
- Observe remote CI for the reviewed committed release. Current work is uncommitted;
  no remote run can certify this working tree. No push was performed.
- Merchant evidence/live payment acceptance and Resend/Twilio recipient delivery,
  wording and sender approval (A04/A09).
- Actual receipt preview/printing and long multi-page receipts; broader real-device,
  screen-reader/keyboard and salon user acceptance. Automated API tests cover many
  negative/concurrent cases; not every deferred browser permutation was performed.
- Salon sign-off and production operating responsibility/RPO/RTO approval.

Do not mark the full Phase 11 exit condition complete until these have evidence.
