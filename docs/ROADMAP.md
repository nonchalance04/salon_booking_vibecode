# Roadmap

This document controls implementation sequence. Business behavior remains governed by
`SYSTEM_RULES.md`, persistence by `DATABASE_MODEL.md`, and application boundaries by
`ARCHITECTURE.md`. This plan does not change those rules.

Planning does not authorize automatic implementation of subsequent tasks. Each
implementation task requires explicit instruction; stop after its agreed scope.

## Current position — 2026-10-03

**Phase 2 complete: authentication, access control, account management, and the
frontend login/workspace shell are implemented and verified. Phase 3 is next.**

See `FOUNDATION_VERIFICATION.md` and `PHASE_2_VERIFICATION.md` for evidence and verification limits.

This assessment is based on the current working tree, including uncommitted files,
not just committed history. It does not certify a running database or deployment.

| Area | Evidence | Assessment |
| --- | --- | --- |
| Repository and specifications | `AGENTS.md`, authoritative documents, updated README and verification report | Setup and validation instructions documented |
| Backend foundation | Express health API, environment/request validation, centralized errors, build scripts | Type checking, build, API tests, compiled startup, and clean shutdown pass |
| Database foundation | Existing schema/migrations and development seed | Disposable PostgreSQL migration, seed, constraint, and transaction checks pass |
| Authentication | Login/logout/current-user APIs, live database authorization, CSRF/CORS, Admin account management | Phase 2 complete; security tests pass |
| Booking and business workflows | Models exist, but no corresponding application services or routes found | Not implemented |
| Frontend | React/TypeScript/Vite login, Admin accounts, Cashier shell | Build and browser checks pass |
| Automated tests | Node test runner, PostgreSQL integration suite, CI workflow | 7 unit/API tests and 14 database test results pass; remote CI execution not yet observed |

Schema presence does not mean booking, payments, or reporting are functional.
The phase numbers below establish the implementation plan; the previous roadmap
listed only initial repository setup.

## Phase 0 — Repository and domain specification

**Status:** Initial setup complete.

- Maintain repository instructions and the authoritative business, database, and architecture documents.
- Keep the modular monolith with separate backend and frontend applications.
- Record approved changes in `DECISIONS.md` when they occur.

**Exit condition:** Contributors can identify the governing rules, scope, and next task.

## Phase 1 — Verify and finish the application/database foundation

**Status:** Complete; implementation, automated checks, and compiled-server startup/shutdown verification pass.

1. Reconcile the README with the actual repository and document reproducible local setup.
2. Verify dependency installation, TypeScript checking, backend startup, and `/api/health`.
3. Verify Prisma generation and the explicitly configured Prisma config path; compare existing schema/migrations with `DATABASE_MODEL.md`.
4. Validate migrations and development seeding against a disposable PostgreSQL database. Check required indexes, partial uniqueness, money precision, timestamps, and referential restrictions; track any gaps before feature work.
5. Establish request validation conventions, consistent API errors, safe operational logging, and a real test runner with PostgreSQL integration-test support.
6. Establish build/start scripts and CI checks appropriate for the existing backend.

Do not recreate existing models or treat a schema audit as authorization to add entities.
Any implementation corrections belong to a separately scoped task.

**Exit condition:** A fresh development checkout can start predictably, apply the existing
migrations, seed a disposable database, pass type checking, and run meaningful tests.

## Phase 2 — Authentication and access control

**Status:** Complete; backend security, account-management APIs/UI, and frontend shell verified locally.

- Implement Admin/Cashier login, logout, and current-user endpoints with hashed passwords and bounded JWTs in secure HttpOnly cookies.
- Validate the current database user, active status, and role on every protected request.
- Enforce role permissions, exact trusted-origin CSRF checks, and restricted credentialed CORS.
- Implement Admin management of Admin/Cashier accounts within the approved permissions.
- Initialize React/TypeScript/Vite, the API client, login page, and role-aware application layouts.
- Test invalid credentials, expired tokens, deactivated users, changed roles, CSRF failures, and forbidden actions.

**Exit condition:** Admin and Cashier can sign in and access only permitted operations;
direct API requests cannot bypass permissions. Stylists do not receive login accounts.

## Phase 3 — Salon configuration and management

**Status:** Not started at the application level.

- Implement salon profile, services, staff, qualifications, and commission-rate configuration.
- Implement operating hours, closures, recurring staff schedules, and unavailable periods.
- Implement prospective booking-policy version management without rewriting historical appointments.
- Add Admin management screens and public read endpoints for bookable services and salon information.
- Establish shared/exclusive salon coordination, ordered Staff locking, and affected-reservation validation for configuration writes.
- Add audit recording to configuration mutations; prefer deactivation for referenced records.

**Exit condition:** Configuration is manageable through authorized APIs/UI and cannot
invalidate protected reservations. Tests cover validation, permissions, historical
preservation, and locking behavior using reservation fixtures where needed.

## Phase 4 — Availability and staff assignment

**Status:** Not started.

- Calculate availability dynamically from hours, staff schedules, closures, unavailability, and blocking `AppointmentService` reservations.
- Enforce full duration, buffers, sequential multi-service timing, qualification, local timezone, and policy boundaries.
- Support specific staff and deterministic `ANY_AVAILABLE` assignment across a complete feasible service plan.
- Respect status-dependent blocking and logically expired holds even before worker cleanup.
- Add availability endpoints and the customer service/staff/date/time selection interface.
- Test overlap boundaries, buffers, closing times, multi-service feasibility, workload tie-breaks, and expired holds.

**Exit condition:** The UI displays valid candidate times, with the explicit understanding
that booking must revalidate them transactionally before reserving.

## Phase 5 — Booking, temporary holds, and guest access

**Status:** Not started.

- Implement authoritative booking logic in the appointments application service, with `AppointmentService` rows as the reservation unit.
- Create customer/contact data, appointment, service snapshots, booking code, and hashed guest-access token atomically.
- Acquire salon coordination and ordered Staff locks, reselect the effective policy, and revalidate the complete plan using fresh post-lock time.
- Restart transactions with a complete ordered lock set when fresh candidates or policy changes require it.
- Create `PENDING_PAYMENT` appointments and implement hold-expiration cleanup.
- Add customer booking submission, secure appointment retrieval, and hold/countdown UI.
- Add audit/outbox records within the corresponding transactions from this phase onward.

**Exit condition:** Competing requests cannot double-book a staff interval; guest access
requires the secure token rather than a booking code alone. Tests cover booking versus
configuration changes, policy activation, transaction restarts, and deadline crossings.

## Phase 6 — Appointment-fee payment and confirmation

**Status:** Not started.

- Implement the payment-provider boundary, authorized manual recording, and a development/test adapter.
- Integrate the selected online provider when merchant access and credentials are available; disable test providers in production.
- Verify provider events or server-to-server results, transaction identity, appointment, amount, currency, and capture status.
- Handle callbacks and retries idempotently, with transactional confirmation, applicable receipts, audit, and notification queue entries.
- Coordinate payment confirmation with hold expiration using fresh time after locks.
- Record late successful payments for reconciliation without restoring released reservations.
- Add payment/confirmation screens and an Admin reconciliation view within the approved scope.

**Exit condition:** Timely verified fee payment confirms a booking once; forged,
duplicate, late, and racing events cannot corrupt reservations or collection totals.

## Phase 7 — Appointment changes and no-show recovery

**Status:** Not started.

- Implement eligible customer rescheduling and cancellation with the appointment's governing policy.
- Preserve retained snapshots, snapshot newly added services, retain removed rows, and record complete change history.
- Implement Admin no-show marking and one eligible linked replacement booking.
- Apply eligible carried appointment-fee credit atomically without collecting or recording the same payment again.
- Preserve the original `NO_SHOW` record and original policy; require normal fee payment when carried credit is unavailable.
- Add customer appointment-management screens and permitted Admin appointment views/actions.

**Exit condition:** Cutoffs, reschedule limits, recovery grace, and single-use credit
are enforced. Tests include competing reschedules/bookings and concurrent credit reuse.

## Phase 8 — Service outcomes, settlement, receipts, and commissions

**Status:** Not started.

- Implement Cashier outcome recording and permitted Admin corrections before finalization.
- Settle all performed services through exactly one successful full `SERVICE_PAYMENT`.
- Atomically record payment, receipt, commissions, completion, immutable outcomes, audit entries, and applicable notification events.
- Allocate the eligible appointment fee proportionally using Decimal arithmetic and the specified deterministic rounding rules.
- Keep the appointment fee separate from the post-service charge.
- Implement all-`NOT_PERFORMED` closure without a fake zero payment, commissions, or a service-payment receipt.
- Add Cashier settlement screens and receipt viewing/printing.

**Exit condition:** Duplicate submissions cannot duplicate money, receipts, or commissions;
financial totals and cent-level allocations reconcile exactly. Both completion paths
are covered by transaction and authorization tests.

## Phase 9 — Notification delivery and reminders

**Status:** Not started. Earlier phases already enqueue required events.

- Implement email/SMS provider boundaries and the PostgreSQL-backed notification worker.
- Atomically claim work, use bounded processing leases, recover abandoned attempts, and reject stale-worker updates.
- Implement bounded retries, delivery failure recording, and applicable appointment reminders.
- Use provider idempotency support where available; external delivery is at least once.

**Exit condition:** Delivery failures do not undo bookings or payments, concurrent workers
cannot own the same live attempt, and worker crashes have tested recovery paths.

## Phase 10 — Reports and customer assistance

**Status:** Not started.

- Implement authorized appointment, payment, receipt, commission, and permitted collection reports using historical transactional records.
- Prevent carried credits, duplicate callbacks, and reconciliation cases from distorting reported collections.
- Add Admin dashboards, permitted Cashier collection summaries, and audit-log viewing.
- Implement the specified chatbot for salon FAQs, services, policies, and booking guidance using authoritative APIs.
- Keep availability, policy enforcement, staff assignment, and payment decisions in the backend domain services.

**Exit condition:** Reports reconcile with source transactions; the chatbot cannot invent
availability or bypass booking/payment rules. No new accounting or chatbot-history entities are introduced.

## Phase 11 — End-to-end acceptance and deployment

**Status:** Not started. Testing remains required throughout every earlier phase.

- Run complete guest, Admin, and Cashier workflows across the integrated frontend/backend.
- Repeat critical concurrency and security scenarios against PostgreSQL under realistic simultaneous requests.
- Verify responsive/accessibility behavior, error recovery, receipt printing, and role boundaries.
- Configure production secrets, HTTPS/cookies/origins, database migrations, API and worker processes, logging, backups, and restore procedures.
- Validate the production payment/notification integrations selected for release and disable development fixtures/providers.
- Complete salon user acceptance, operating instructions, and deployment/recovery documentation.

**Exit condition:** Approved workflows pass acceptance, financial reports reconcile,
backup restoration is demonstrated, and the deployed application can be operated reliably.

## Next implementation task

**Phase 3 — Salon configuration and management** is the next milestone. Phase 2
is complete, and work has stopped at that boundary. Proceed with Phase 3 only
when the user requests it; do not jump directly into booking.

## Scope boundaries and completion tracking

- Add tests for business-critical behavior in its implementation phase, not only before release.
- Mark a phase complete only when its exit condition has evidence; source files alone are insufficient.
- Track external provider credentials/access as dependencies without blocking local provider-boundary development.
- No inventory, payroll, loyalty, memberships, stylist accounts, detailed on-chair workflow, expense/profit accounting, or predictive scheduling.
- No partial/split service payments, automatic refund system, or post-finalization financial editing in the initial MVP.
- Future scope or business-rule changes require explicit instruction and corresponding decision records.
