# Cashier workflow

Cashiers land on the dashboard. **Confirmed services** loads automatically on the
dashboard, Appointments page and Service payments page, across all appointment
dates. It shows customer names, appointment dates, service snapshots, prices and
assigned staff. Choose **Process payment** to open settlement without typing a
booking code. The list refreshes every 30 seconds while visible and when returning
to the browser tab. Optional customer-name/booking-code search and pagination are
available. Completed, cancelled, expired, no-show and pending-payment appointments
are excluded from this list. Today's activity and receipts remain available in a
separate expandable section; dates use the configured salon timezone.

1. Open **Process payment** and review the customer, services and fee history.
2. Mark each service performed or not performed. Confirm before saving; saved
   outcome corrections still require an Admin before finalization.
3. Review the itemized performed-service charge. Appointment fees remain separate
   and are never deducted from the service payment.
4. Select the received payment method. Cash requires sufficient tendered money
   and calculates change in whole centavos. GCash prompts verification against
   the salon's received transaction. All methods generate a salon payment reference
   automatically and require confirmation that the money was received. Cashiers do
   not type a reference. The generated reference appears in the payment receipt.
5. Finalize, print the generated receipt, then choose **Finish & return to appointments**.
   The dashboard refreshes after settlement or no-service closure. No-service
   closure retains the existing rules and creates no new payment or receipt.

**Appointment fees** keeps the existing manual fee recording and receipt workflow.
It also generates the salon reference automatically for every payment method.
**Collection history** provides date-range review, including captures and refunds
by original payment method. Today's collection review also splits appointment-fee
captures from service-payment captures and flags captured money requiring Admin
reconciliation. Totals cover the salon, not just the signed-in cashier.

Collections use `paidAt`, refunds use `refundedAt`, and appointment counts use
scheduled `startAt`. Carried fee credits are not new collections. Dashboard totals
refresh on entry, after settlement/closure, and with **Refresh today**; this is not
a live subscription. Cash tendered and change are a checkout aid and are not
persisted as separate financial transactions. Drawer opening floats, counted cash,
cash withdrawals and saved shift-closing discrepancies remain future features.

## Validation

- Backend unit suite: `cd backend && npm test`.
- Reporting and settlement integration tests require a disposable PostgreSQL
  server: set `TEST_DATABASE_ADMIN_URL`, then run
  `node --import tsx --test tests/integration/reports.test.ts tests/integration/settlement.test.ts`.
  These check salon date boundaries, pagination, privacy, authorization, exact
  method/refund totals, full settlement, duplicate protection and atomic receipts.
- Frontend money tests: `cd frontend && npm test`.
- Type checking/build: `cd backend && npm run typecheck`; `cd frontend && npm run build`.
- Browser check: open a confirmed booking, save an outcome, verify insufficient
  cash disables finalization, verify PHP 1,000 tendered for PHP 780.30 produces
  PHP 219.70 change, finalize in a test environment, and check the receipt and
  refreshed queue/collection totals. An existing PHP 100 appointment fee must
  remain separate, producing PHP 880.30 total collections in this example.
