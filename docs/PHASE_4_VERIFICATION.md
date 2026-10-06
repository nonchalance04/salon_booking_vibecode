# Phase 4 verification — 2026-10-03

Phase 4 (Availability and staff assignment) is complete locally. Phase 5 has not
started. No models or migrations were added.

## Implemented scope

Dynamic availability uses the current effective policy, active services/staff and
qualifications, salon hours/closures, staff schedules/unavailability, and ACTIVE
AppointmentService reservations. It checks full durations and buffers, sequential
multi-service feasibility, inclusive lead/advance boundaries, salon-local dates,
status-dependent blocking, and logical hold expiration. Assignment ranks existing
pending/confirmed target-date reserved workload then staff ID. Completed original
reservations continue blocking until their reserved end.

Public APIs provide qualified staff and advisory searches. The customer screen at
`/availability` supports ordering multiple services, choosing staff, choosing a date,
browsing start times, and reviewing the assigned plan. Input edits clear stale
results and invalidate outstanding responses. No booking/hold is created.

## Executed checks

| Check | Result |
| --- | --- |
| Backend Prisma validation/generation | Passed |
| Backend type checking and production build | Passed |
| Unit/API tests | 19 passed; no failures/skips |
| PostgreSQL integration tests | 29 reported results passed; no failures/skips |
| Frontend type checking and production build | Passed |
| Browser public service/staff/date search | Passed using a disposable database |
| Browser edit/reorder clears results; past date empty state | Passed |
| Browser multi-service time selection | Passed; 08:00–08:30 haircut, buffer to 08:45, 08:45–09:15 manicure, buffer to 09:30, all Manila time |

The database count includes an authentication parent plus subtests. Tests create
random disposable databases and apply existing migrations/seeds. No user database
was migrated or reseeded. HTTP tests require local sockets outside the execution
sandbox; their first sandbox-only attempt could not open sockets, and the permitted
rerun passed.

Unit coverage includes null versus zero buffers, closing times, contiguous shifts,
schedule effective dates, closures/time off, exact overlap adjacency, full-plan
feasibility, specific versus any staff, target-day workload clipping/ties,
completed/removed/terminal rows, hold deadline equality, lead/advance equality,
exact-start searches, and DST/local-date boundaries.

Database checks verify actual persisted state filtering, active qualifications and
services, current policy selection, safe public payloads, no reservation writes,
strict HTTP validation, no-store responses, and ordered lock coordination. A search
waits for a Staff lock until a hold expires and then uses fresh time; another waits
for exclusive salon coordination and observes a committed service deactivation.

## Manual reproduction

1. Start both applications using README instructions and open `/availability`.
2. Choose services in order and select specific staff or Any Available.
3. Pick a date within the effective policy window and search. Select an available
   time and verify each service starts at the prior service's reserved-until time.
4. Edit staff, date, service, or service order and verify old results disappear.
5. Try a past/out-of-window date or an infeasible plan and verify the empty state.
6. Run backend `npm run check`, frontend `npm run build`, and backend `npm run test:db`
   with `TEST_DATABASE_ADMIN_URL` pointing to a dedicated test server.

## Limits and next boundary

Results are advisory. Phase 5 must acquire its own locks, select effective policy,
recheck fresh time, and revalidate before creating reservations. Production
performance, remote CI execution, deployment, and full accessibility acceptance
were not verified. Advisory searches currently serialize on all existing staff,
an intentional small-salon tradeoff. No booking, payment, hold worker, or guest
access flow was implemented. Stop here until Phase 5 is explicitly requested.
