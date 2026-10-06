# Phase 3 verification — 2026-10-03

Phase 3 (Salon configuration and management) is complete locally. Phase 4 has
not started. No models or migrations were added in this phase.

## Implemented scope

Admin APIs and screens cover the singleton salon profile, services, staff,
qualifications/commission rates, opening hours, closures, recurring schedules,
staff unavailability, and prospective immutable booking-policy versions. Public
APIs return salon information and active services. Existing account management
remains under the Admin Accounts tab.

Writes validate strict inputs, enforce live Admin authorization, take shared or
exclusive salon coordination plus ordered Staff locks where applicable, and
commit audit records atomically. Changes cannot invalidate protected confirmed
or live pending-payment reservations, including their buffer intervals. Rejected
changes identify affected booking codes. Deactivation preserves referenced
records; transactional snapshots and policy references remain unchanged.

## Executed checks

| Check | Result |
| --- | --- |
| Backend `npm run typecheck` | Passed |
| Backend `npm test` | 10 results passed; no failures/skips |
| Backend `npm run build` (including Prisma generation) | Passed |
| Backend `npm run test:db` | 26 results passed; no failures/skips |
| Frontend `npm run build` | Passed |
| Browser Admin login and configuration navigation | Passed against disposable database |
| Browser conflicting closure | Rejected; displayed PREVIEW-RESERVATION and 9:00–9:45 AM Manila reservation |
| Browser valid closure and reload | Saved 10:00–11:00 AM Manila closure; persisted after reload |
| Browser policy publication | Created version 2 with changed default buffer; version 1 remained visible and uneditable |

The database runner's 26 results include a parent authentication test plus its
subtests. The combined reported count is 36, not 36 independent test cases.

Database tests use PostgreSQL 18 and isolated randomly named databases with the
existing migrations and seed. Tests cover full-buffer schedule coverage, local
dates and timezone transitions, unioned windows, inclusive effective dates,
adjacent closure boundaries, live/expired payment holds, removed/terminal rows,
rollback/audit integrity, historical snapshot preservation, role/CSRF protection,
public-response privacy, and immutable prospective policies.

Concurrency tests hold real database locks: an exclusive configuration writer
waits for a reservation transaction and then sees its committed reservation;
a staff-specific writer waits until a payment hold expires and uses fresh time
after acquiring the lock. These are reservation fixtures, not a booking endpoint.

## Timestamp correction

Verification exposed a Prisma pg adapter conversion issue with non-UTC database
sessions: UTC parameters could be interpreted as local wall time, and raw clock
results could carry an incorrect instant. Application and seed pools now force
UTC sessions; the post-lock clock reads numeric epoch milliseconds. Regression
tests compare actual PostgreSQL stored instants and explicitly exercise a non-UTC
session. The salon calendar still uses the configured IANA timezone.

No existing user database was inspected, migrated, or repaired during these
checks. If earlier data was written through a non-UTC session, its stored instants
need review before operational use. Do not automatically shift historical data.

## Manual test instructions

1. Follow the README to install both applications, configure the development
   database and credentials, apply existing migrations, and seed an empty
   development database. Do not reseed a database containing appointments.
2. Start the backend and frontend, sign in as your seeded Admin, and select
   **Salon management**.
3. Add/edit configuration and reload to confirm persistence. Verify a blank
   service buffer versus zero, commission percentages, staff selection, active
   flags, weekly times, inclusive schedule dates, and local closure/time-off times.
4. Publish a new policy with blank activation time for immediate activation, or
   a future activation time. Earlier versions must remain read-only.
5. Sign in as Cashier and confirm management is unavailable. Direct unauthorized
   API requests are also rejected by the automated suite.
6. Run `npm test` and `npm run test:db` from backend with an explicitly configured
   disposable `TEST_DATABASE_ADMIN_URL` to exercise reservation conflicts and races.

## Limits and next boundary

Production deployment, remote CI execution, and full accessibility/responsive
acceptance were not verified. The UI browser checks are focused smoke tests;
the integration suite verifies the broader mutation and authorization behavior.
Availability calculation, customer booking, reservation creation, payments, and
settlement are later phases. Phase 4 is the next authorized-task candidate and
must wait for a new user instruction.
