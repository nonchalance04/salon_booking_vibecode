# Phase 5 verification — 2026-10-03

Phase 5 (Booking, temporary holds, and guest access) is complete locally. Phase 6
has not started. No models or migrations were added, and domain rules are unchanged.

## Implemented scope

`POST /api/appointments` validates an exact ordered plan and contact details,
acquires shared salon coordination and ordered Staff locks, reloads policy and
availability, and atomically creates Customer, Appointment, AppointmentService
snapshots, and a redacted audit entry. New staff discovery or mid-transaction
policy activation causes a complete rollback/restart. Final time checks prevent
stale lead-time or hold decisions. The appointment begins `PENDING_PAYMENT`.

`POST /api/appointments/access` verifies the hashed secure token and returns a
safe guest view. A code alone is insufficient. Private credentials are absent from
API paths, query strings, audit payloads, and persisted plaintext. Guest links use
fragments cleared from the current history entry; tokens remain in UI memory.

The standalone hold worker uses common reservation locking and a fresh database
clock to expire bounded batches, preserving historical service rows and writing
one audit per transition. Logical expiration affects availability and guest status
without waiting for cleanup. No approved notification event describes unpaid hold
creation/expiration, so no confirmation/payment outbox event is emitted early.

## Executed checks

| Check | Result |
| --- | --- |
| Prisma validation/generation, backend type checking | Passed |
| Backend unit/API tests | 21 passed; no failures/skips |
| PostgreSQL integration suite | 43 reported results passed; no failures/skips |
| Backend production build, including worker | Passed |
| Frontend type checking and production build | Passed |
| Browser booking submission | Passed; contact form creates a 10-minute hold and displays PHP 100.00 fee |
| Browser private-link retrieval | Passed; correct appointment displayed and fragment removed from current URL |
| Browser expired state | Passed; expired status replaces hold/countdown and offers another search |
| Compiled hold worker | Persisted EXPIRED and exactly one expiration audit in the disposable database |

The database result count includes an authentication parent and its subtests.
All database tests apply existing migrations and seeds to randomly named disposable
databases. Browser and worker checks used a separate disposable database on an
isolated PostgreSQL 18 instance. No user database was migrated or seeded.

The sandbox cannot open local sockets; HTTP tests and PostgreSQL/server processes
were run with the required execution permissions. Initial sandbox-only checks
failed on socket creation; permitted reruns passed.

## Business-critical coverage

- Atomic sequential service snapshots, final service end excluding trailing buffer,
  Decimal prices/commission rates, policy fee and deadline, and token hashing.
- Exactly one competing specific-staff booking succeeds with no orphan customer.
- Fresh deterministic Any Available assignment allows parallel staff reservations.
- An infeasible later service leaves no customer, reservation, or audit fragments.
- Booking waits for configuration writes and rejects fresh deactivation; committed
  holds prevent later configuration from invalidating their staff intervals.
- A policy activates and a competing hold expires during a Staff lock wait.
- New staff discovered after a lock wait triggers a complete ordered retry.
- A real database insert delay crosses policy activation: customer/snapshot writes
  roll back, and retry uses the new fee/buffer with one committed customer/audit.
- A competing hold expires during insertion: Any Available assignment is recomputed
  and the transaction retries if the preferred staff member changes.
- Lead-time boundary crossings during lock waits reject stale booking requests.
- Guest reads show logical expiration before cleanup; concurrent cleanup workers
  produce one audit, retain reservation history, and allow the interval to be reused.
- Cleanup reloads status after locks and cannot overwrite a confirmed appointment.
- Strict HTTP validation, trusted origins, no-store responses, wrong/missing tokens,
  code-only access rejection, and safe response fields.

## Reproduction and limits

Run backend `npm run check`, frontend `npm run build`, and backend `npm run test:db`
with a dedicated `TEST_DATABASE_ADMIN_URL`. Run `npm run worker:holds` for development
or `npm run start:holds` after building. See README for endpoints and worker setup.

Open `/availability`, select a visit, submit contact details, save the private link,
and reopen it to verify guest access. Holds expire without payment. Payment provider
integration, confirmation, receipts, notification delivery, production load testing,
remote CI execution, and deployment remain outside this phase. The all-staff lock
set intentionally serializes booking decisions for the small-salon MVP.

A lost booking HTTP response is not automatically retried by the client; this phase
does not add booking-submission idempotency or guest-token recovery. Save the private
link after a successful response. Unpaid holds release automatically.

Stop at Phase 5. Phase 6 requires a separate user instruction.
