# Phase 1 foundation verification

Assessment date: 2026-10-03. Evidence covers the current working tree, including
pre-existing uncommitted source and migrations. No new models or business
workflows were added during this phase.

## Verified

- Dependency installation from the lockfile completed using offline `npm ci
  --ignore-scripts`, followed by successful `npm rebuild` outside the sandbox.
- Existing Prisma schema validation and client generation passed with the
  explicit `prisma7.config.ts` configuration.
- Type checking passed for application code, generated code, the seed, Prisma
  configuration, and tests. Including the seed exposed a missing ESM import
  extension, which was corrected.
- The production TypeScript build passed.
- The compiled backend started successfully, `/api/health` returned HTTP 200
  with the expected response and a request ID, and SIGTERM shutdown exited with
  code 0. This liveness check used a temporary port and did not connect to an
  application database.
- Four API/configuration tests passed: public health response, request parsing,
  validation/error handling, payload limits, redacted errors/logs, and environment
  validation.
- Eight database tests passed against a disposable PostgreSQL 18 instance.
  Both existing migrations applied successfully. Repeated seeding produced
  2 users, 1 salon profile, 1 policy, 7 operating-hour records, 30 services,
  3 staff, 90 qualifications, and 21 staff schedules. Password hashes were verified.
- Database tests exercised positive prices/durations, nonnegative buffers,
  commission limits, schedule ordering, active sequence uniqueness, removed
  service history, fee-obligation uniqueness, successful service-payment
  uniqueness, restrictive deletion, and multi-record transaction rollback.
- Catalog checks verified Numeric money, timezone-aware appointment instants,
  the three custom partial unique indexes, and restrictive foreign keys.
- Seed tests verified refusal in production, with another salon profile, and
  after appointments exist. No application database was used for these tests.

## Foundation changes

- Explicit Prisma scripts, build/start commands, Node 24 requirement, test scripts,
  and a GitHub Actions workflow with PostgreSQL.
- Central request validation and safe API errors, generated request IDs, bounded
  JSON payloads, validated environment settings, and server shutdown handling.
- Development seed production guard and updated local setup instructions.

## Verification limits

Phase 1's local completion criteria are satisfied. The following limits remain:

- The GitHub Actions workflow has been written but has not run on GitHub here.
- A fresh machine without the available npm cache has not been tested. Local
  dependency installation was verified from the existing cache.

## Specification audit and later-phase responsibilities

The existing schema/migration review found the documented entity groups,
Decimal money/rate fields, timestamp conventions, required indexes, and custom
partial uniqueness. No foundation migration correction was identified by the
checks performed; this is not a certification of unimplemented domain behavior.

The specification explicitly leaves several invariants to application logic:
single salon profile, sequential service adjacency, exact duration/buffer
derivation, current qualification, reservation blocking, fresh post-lock time,
policy selection, historical immutability, and payment/commission finalization.
The seed guards the profile invariant during bootstrap; later configuration
services must maintain it. Future domain phases must implement and test the
remaining invariants with real PostgreSQL transactions and concurrency tests.

Authentication currently consists only of the pre-existing JWT helper. Guest
security, booking, payment-provider verification, audit/outbox mutations, and
frontend workflows remain later-phase work. Phase 1 is complete; stop before
Phase 2 until the user requests advancement.
