# Phase 2 — Authentication and access control

Completed locally on 2026-10-03. Work stops before Phase 3.

## Implemented

- Admin/Cashier login, logout, and current-user APIs with bcrypt and bounded JWTs
  in HttpOnly cookies. Production cookies require HTTPS and use Secure.
- Each protected request validates the token and loads the current active account
  and database role. Token role claims cannot preserve revoked Admin access.
- Exact trusted-Origin checks on browser authentication/account mutations, with
  validated Referer fallback only when Origin is absent. Malformed, empty, null,
  or untrusted Origins cannot use the fallback. Credentialed CORS uses the same
  explicit allowlist.
- Admin account listing, creation, profile/password updates, role changes, and
  deactivation. There is no account deletion or public registration endpoint.
- Account writes lock affected user records in sorted order and recheck Admin
  authority inside the transaction. The account write and safe audit record are
  atomic. Responses and audit data exclude passwords and password hashes.
- React/TypeScript/Vite login, session restoration, Admin account-management UI,
  Cashier workspace shell, error states, and logout. Credentials remain in
  HttpOnly cookies rather than browser storage. Stale session-refresh responses
  cannot overwrite a newer login/logout operation.
- Environment examples, setup/API documentation, frontend lockfile, and CI build
  job for the frontend. No models, migrations, or scheduling business rules changed.

## Validation evidence

- Backend type checking and production build passed.
- Frontend type checking and Vite production build passed.
- Seven unit/API tests passed, including JWT signature/expiration/claim checks,
  production cookie configuration, account input rules, and existing HTTP checks.
- PostgreSQL integration suite passed with 14 reported test results (including
  its parent authentication test). Coverage includes existing foundation checks,
  login failures, safe responses, cookie expiration, current-user restoration,
  CSRF/Referer/CORS, direct Cashier API denials, duplicate email handling, account
  creation/editing, audit redaction, stale JWT roles, deactivation, expired/forged
  tokens, logout, and edits that must not implicitly reactivate accounts.
- Browser verification against a disposable database passed: Admin login,
  session restoration after reload, editing another account, editing the current
  account with refreshed heading/table, logout, and the Cashier workspace without
  Admin controls. This used the compiled backend and the Vite development server.

## Limits and operational notes

- GitHub Actions is configured but its remote execution has not been observed.
- Production HTTPS/cookie deployment has not been exercised; cookie settings are
  covered by automated tests. The documented frontend setup uses same-origin
  `/api` with a development or production reverse proxy.
- Logout clears the browser cookie; copied JWTs remain valid until their 8-hour
  expiration unless the account is deactivated. Password changes do not revoke
  already-issued JWTs. No session store or refresh-token subsystem was added.
- Tests use disposable PostgreSQL databases. No application database was migrated,
  seeded, or changed for this phase's verification.
- Booking, salon configuration, payments, and settlement remain later phases.
