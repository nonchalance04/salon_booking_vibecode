# Salon Booking and Appointment System

Repository for the Salon Booking and Appointment System.

The backend foundation uses Node.js, TypeScript, Express, PostgreSQL, Prisma, and
Zod. Admin/Cashier authentication and Admin account management are implemented.
The React/TypeScript/Vite frontend provides login, session restoration, role-aware
workspaces, and account management. Booking and settlement remain later-phase work.

See [the roadmap](docs/ROADMAP.md) for phases and
[foundation verification](docs/FOUNDATION_VERIFICATION.md) for current evidence and gaps.

## Local backend setup

Requirements: Node.js 24 (`.nvmrc`), npm, and PostgreSQL. Database tests have been
verified with PostgreSQL 18. Use a dedicated development database.

```bash
nvm use
cd backend
npm ci
cp .env.example .env
```

Edit `backend/.env`: provide your development `DATABASE_URL`, a random `JWT_SECRET`
of at least 32 characters, and your own development Admin/Cashier seed credentials.
Do not overwrite an existing `.env` when repeating setup. Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run from `backend/`:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` applies checked-in migrations; it does not reset the database. All
Prisma commands explicitly use `prisma7.config.ts`. Seeding is for development
only, rejects production mode, and refuses to rewrite configuration once an
appointment exists. Re-seeding refreshes fixture credentials/configuration.

`GET http://localhost:3000/api/health` reports application liveness, not database
readiness. `PORT` can override the default port.

## Build and validation

Run from `backend/`:

```bash
npm run check
npm start
```

`check` validates/generates Prisma, type-checks application/seed/test code, runs
API/configuration tests, and compiles the backend. `start` runs the compiled
`dist/src/server.js`; build before starting. Environment validation is required
at startup. Generated code, compiled output, and secrets are ignored by Git.

## PostgreSQL integration tests

Use a dedicated local/CI PostgreSQL server and a role with `CREATEDB` permission.
Set `TEST_DATABASE_ADMIN_URL` explicitly in your shell; tests do not load `.env`
or fall back to `DATABASE_URL`.

```bash
export TEST_DATABASE_ADMIN_URL='postgresql://USER:PASSWORD@localhost:5432/postgres'
npm run db:generate
npm run test:db
```

The suite creates a uniquely named `salon_test_*` database, applies migrations,
seeds development fixtures, tests constraints/transactions, and drops only its
own database afterward. Do not point it at a production server. An interrupted
test process can leave its disposable database behind for manual cleanup.

GitHub Actions runs backend checks and database tests against a disposable
PostgreSQL service, plus the frontend production build. No production credentials are needed.

## Frontend and authentication

With the backend running on port 3000, open another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and use the Admin/Cashier credentials you supplied
when seeding. The Vite server proxies `/api` to `http://127.0.0.1:3000` without
rewriting the browser Origin. Run `npm run build` in `frontend/` for production
assets. For production, serve the frontend over HTTPS and reverse-proxy `/api`
to the backend on the same site.

Backend `TRUSTED_ORIGINS` contains exact comma-separated browser origins, with no
paths or trailing slashes. Its development default is
`http://localhost:5173,http://127.0.0.1:5173`. Production requires explicit HTTPS
origins and `NODE_ENV=production`; cookies then use `Secure`. `COOKIE_SAME_SITE`
defaults to `lax`; `none` requires production HTTPS. The frontend currently uses
same-origin `/api` requests. A separate frontend/API host deployment would also
need a frontend API-base configuration and an appropriate cookie topology.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `POST /api/auth/login` | Trusted browser origin | Email/password login; sets an 8-hour HttpOnly cookie |
| `POST /api/auth/logout` | Trusted browser origin | Clears the session cookie; safe when already signed out |
| `GET /api/auth/me` | Active authenticated account | Returns current profile and database role |
| `GET /api/users` | Admin | Lists safe account fields |
| `POST /api/users` | Admin + trusted origin | Creates an Admin/Cashier account |
| `PATCH /api/users/:id` | Admin + trusted origin | Edits account fields, password, role, or active status |

Account creation requires `email`, `password`, `firstName`, `lastName`, and `role`;
`isActive` defaults to true. Updates accept a nonempty subset of those fields.
Passwords for new accounts and password changes require at least 12 characters
and at most 72 UTF-8 bytes to avoid bcrypt truncation. Emails are normalized to
lowercase. No delete route or public registration is provided.

State-changing requests require an exact trusted `Origin`, or a trusted `Referer`
when Origin is absent. This includes login and logout. Protected requests verify
the JWT and load the database account, so role changes and deactivation affect
existing tokens. Account mutations and redacted audit records commit atomically.
Passwords and hashes never appear in API responses or audit payloads.

Logout clears the browser cookie. This bounded stateless JWT design does not
revoke copies of an already issued token or invalidate them upon password change;
deactivation blocks access immediately. No refresh-token/session-store feature was added.

## Request and error conventions

Use `validateRequest(schema)` with a Zod object containing the relevant `body`,
`params`, and `query` fields. Controllers consume the parsed data from
`res.locals.validated`; business logic belongs in services. `ApiError` carries a
safe public status/code/message. Central error handling returns
`{ "error": { "code": "...", "message": "..." } }` without internal traces.
Operational failure logs include a generated request ID and omit request bodies,
credentials, URLs, and raw errors. Business audit logging belongs to the later
transactional workflows and is separate from operational logging.

## Governing documents

- `AGENTS.md`: repository engineering instructions.
- `docs/SYSTEM_RULES.md`: business behavior.
- `docs/DATABASE_MODEL.md`: entities, relationships, constraints, and concurrency.
- `docs/ARCHITECTURE.md`: architectural boundaries.
- `docs/ROADMAP.md`: phase sequence; stop after the requested phase.
- `docs/DECISIONS.md`: approved architectural decisions.
