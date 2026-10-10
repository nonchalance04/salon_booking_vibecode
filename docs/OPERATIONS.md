# Salon operating instructions

Use the deployed HTTPS address supplied by the operator. All displayed appointment
and report dates follow salon time. Each person uses their own Admin/Cashier account.
Staff profiles do not provide login accounts.

## Customer booking and changes

1. Open `/availability`, select services in visit order, staff preference and date.
2. Choose a time and submit contact details. A temporary hold is not confirmation.
3. Keep your booking code. To reopen appointment details, use Your appointment and verify the phone number used when booking; SMS appointment links also open details automatically.
4. Pay the appointment fee through the configured checkout or salon collection
   procedure before the hold expires. Refresh and verify CONFIRMED.
5. Use the private link to reschedule or cancel while eligible under the booking's
   original policy. A failed change leaves the existing reservation intact.
6. For a missed visit, follow the recovery option if offered. Save the replacement's
   new link. Eligible fee credit transfers once; no second collection is recorded.

An expired hold cannot be restored by a late online payment. Contact the salon for
reconciliation. The guided assistant at `/help` explains services/policies and links
to booking; the availability screen remains authoritative for available times.

## Cashier

- **Appointment fees:** find the booking code, verify money actually received, and
  record its original transaction/cash collection reference. After an uncertain
  response, refresh or retry the same reference; do not invent a new collection.
- **Service settlement:** find the booking and mark each service performed/not
  performed. Review the full performed-service charge; the fee is separate.
  Verify collection and finalize once. Partial/split settlement is unavailable.
- If all services were not performed, finalize no-service closure. No fake zero
  payment, service receipt or commission is created; existing fee history remains.
- Use receipt controls for each stored receipt. Confirm the correct receipt and
  printer/page size in the print dialog. Report a printing/layout issue before
  issuing an incorrect receipt.
- **Collections:** select inclusive salon-local dates. Captures minus refunds is
  net cash movement, not profit. Review applied/unapplied and reconciliation values.
- A stale-review error requires Refresh appointment and a new review. Ask an Admin
  to correct saved outcomes before finalization. Finalized outcomes cannot be edited.

## Admin

- Manage accounts and deactivate access when no longer needed. Configure real salon
  profile, catalog, staff, qualifications, commissions, hours, schedules and policies.
- Policies apply prospectively. Historical bookings keep their governing policy and
  transactional snapshots. Deactivate referenced records rather than deleting them.
- Review appointments and mark no-show only after the start and salon procedure.
  Do not use no-show as a general cancellation override.
- Review/correct saved outcomes before finalization. Cashiers perform settlement.
- Inspect finalized commissions, historical receipts, payment reconciliation and
  authorized reports/audits. Carried credit is not a second payment.
- Reconcile actual merchant captures with the source transaction identity. Never
  manually record an already captured online payment as a new collection.

## Failures and daily close

If a submission times out, refresh the booking/payment/settlement state first.
Preserve the original reference and contact the operator with the booking code,
time, action, safe error message and request ID if shown. Never send private tokens,
passwords, API keys or full customer records in an ordinary incident report.

At daily close, compare Cashier collection totals with cash and merchant records.
Admin reviews required reconciliation and commissions. The operator reviews worker
health, notification failures and backups using DEPLOYMENT.md. A provider status of
SENT means provider acceptance; it does not guarantee inbox or handset delivery.

## Salon acceptance and release sign-off

Run representative guest/Admin/Cashier visits using approved test data. Confirm
service names/prices/durations, hours, policy wording, receipt content, commission
rates, accessibility on actual devices, printer output and provider delivery.
Record reviewer, date, environment, results and unresolved issues in
ACCEPTANCE_BACKLOG.md. The salon owner approves opening real bookings only after
release gates are satisfied. Local developer tests do not substitute for that sign-off.
