# Phase 8 verification — 2026-10-04

Service outcomes, full settlement, no-service closure, receipts, and commissions
are implemented using the existing models and migrations. Manual browser/printing
acceptance is intentionally deferred at the user's request and tracked in
`ACCEPTANCE_BACKLOG.md` alongside Phase 7 and other final-review gaps.

## Implemented behavior

- Cashier outcome recording for the exact set of ACTIVE service occurrences;
  Admin correction of recorded outcomes before finalization.
- Stored historical prices populate actual charges for PERFORMED services; no
  ad-hoc price override is exposed. NOT_PERFORMED and REMOVED rows do not contribute
  to the service charge or commissions. Removed rows remain unchanged.
- Cashier-only full SERVICE_PAYMENT settlement. The fee stays separate. Stable
  request and collection identities prevent duplicate payments and conflicting reuse.
- Appointment serialization and reviewed-revision checks prevent stale settlement
  after corrections or competing appointment changes. Final outcomes are immutable.
- One transaction creates payment, itemized immutable receipt, Decimal commissions,
  outcome-finalization timestamps, COMPLETED transition, audits and outbox records.
- Eligible original/carried fees are allocated using the required deterministic
  rounding. Refunded and reconciliation-only payments are excluded.
- Idempotent all-NOT_PERFORMED closure creates no service payment, receipt or commission.
- Cashier settlement workspace, Admin outcome/commission review, and receipt printing.

## Executed automated checks

- Backend Prisma validation/generation, TypeScript checks, and production build pass.
- Unit/API suite: 36 tests passed.
- Full PostgreSQL regression suite: 82 results passed. After adding receipt-history
  and no-service rollback cases, the focused Phase 8 suite passed all 10 tests
  (including its original 8); no failures or skips in either run.
- Frontend TypeScript/production build passes.
- `git diff --check` passes.

Coverage includes positive/negative cent remainders, amount/sequence/ID tie-breaks,
ROUND_HALF_UP, non-positive charges, zero eligible fee, concurrent matching/distinct
settlements, role/CSRF/authentication/deactivation, partial amount rejection, stale
reviews, Admin correction races, active-row identity validation, removed services,
current configuration changes, carried credit without duplicate fee collection,
refunded/reconciliation money, and rollback on outbox failure.

Tests use disposable databases on a separately initialized PostgreSQL 18 server.
The user's application database was not migrated, seeded, or changed. No merchant
API or real payment collection is used by these settlement tests. Receipts represent
manually verified collections, consistent with the existing provider boundary.

## Manual browser acceptance — deferred

1. As Cashier, find a confirmed multi-service booking. Record mixed outcomes and
   verify the amount equals performed historical prices, with fee shown separately.
   Confirm a full cash/GCash/other collection using its original reference. Check
   COMPLETED state, one receipt, and immutable outcomes after refresh/retry.
2. As Admin, review the final commission amounts and fee allocations. Before another
   appointment is finalized, correct its recorded outcomes. A Cashier holding the
   prior review must be told to refresh; then verify the updated charge and outcomes.
3. Record all services as NOT_PERFORMED and finalize closure. Verify no service
   payment/receipt/commission appears and the original fee history is retained.
4. Test an eligible recovery booking: carried fee appears without a second fee
   collection. Check the replacement's commission allocation and the original history.
5. View and print each receipt separately. Verify salon/customer/booking, service
   lines, full amount, method/reference and timestamp; verify only the selected
   receipt prints. Include long names, multiple receipts, mobile width and page breaks.
6. Check Cashier/Admin navigation, keyboard and focus behavior, confirmation prompts,
   loading/error states, lost-response retries and refreshed sessions. Admin cannot
   finalize payment/closure; Cashier cannot correct saved outcomes or view commissions.

Notification delivery remains Phase 9. Remote CI, production providers, deployment,
load and complete accessibility acceptance are not claimed. Phase 9 has not started.
