# Phase 7 verification — 2026-10-04

Appointment changes and no-show recovery are implemented against the existing
system rules and database model. No models, migrations, payment providers, or
settlement workflows were added. The user reported Phase 6 tests complete and
explicitly authorized progression, deferring payment diagnostics to future work.

## Implemented scope

- Token-authenticated customer change availability, rescheduling, and cancellation.
- Retained per-occurrence snapshots, current snapshots for additions, preserved
  removed rows, immutable complete before/after history, audit, and outbox records.
- Original-policy cutoffs, change limits, lead/advance bounds, and fresh post-lock
  and pre-commit time checks using the existing scheduling engine and lock protocol.
- Admin appointment browsing and no-show marking; Cashier access denied.
- One linked recovery with original policy/count inheritance, independent guest
  credentials, and atomic single-use original fee credit or a normal payment hold.
- Customer management controls and an Admin Appointments workspace.

## Executed checks

- Backend Prisma validation/generation and production build passed.
- Backend unit/API suite: 32 tests passed.
- Complete disposable PostgreSQL integration suite: 74 reported results passed,
  no failures or skips. Count includes parent/subtest results.
- Backend type checking and frontend production build checked after UI/test changes.
- Source whitespace validation with `git diff --check`.

Business-critical tests cover deadline equality and one millisecond beyond; wrong
credentials and roles; CSRF; duplicate retained IDs; inactive additions; retained
financial/duration snapshots; preserved removed rows; reschedule-count contention;
booking versus rescheduling; concurrent recovery/credit reuse; no-credit, refunded,
and insufficient-credit holds; grace expiry; early no-show rejection; recorded
outcomes; fresh cutoff after Staff-lock waits; and complete rollback on outbox failure.

Tests used a newly initialized isolated PostgreSQL 18 server and random disposable
databases. No user database was migrated, seeded, or modified. No merchant API calls
or real payment collection occurred. Earlier tests activate a different fee policy;
the recovery fixture now uses its actual governing fee rather than the seed amount.

## Manual browser acceptance

Interactive Phase 7 browser acceptance was not executed in this implementation run.
Run the API/frontend against development data and verify these flows:

1. Open a confirmed booking's private link before cutoff. Change date/time, retain
   one service, remove another, add an active service, and choose staff. Confirm and
   inspect the updated schedule; retained prices and durations must stay unchanged.
2. Attempt an occupied time or a change past cutoff/limit. The original reservation
   must remain intact. Cancel an eligible booking and verify the released slot.
3. In Admin → Appointments, mark an eligible missed booking as no-show. A future
   booking must not offer this action. Cashier must not see Admin appointment actions.
4. Open the missed booking's private link within grace, create a recovery, and save
   its new private link. With valid unused fee credit, it is CONFIRMED immediately
   with no extra collection. Otherwise it is PENDING_PAYMENT with normal fee controls.
5. Reopen the original link and verify it stays NO_SHOW and identifies its one
   replacement. Check confirmation/cancellation prompts, errors, and narrow screens.

Notification delivery remains Phase 9. Live deployment, remote CI, and production
provider acceptance are not claimed here. Phase 8 requires a separate instruction.
