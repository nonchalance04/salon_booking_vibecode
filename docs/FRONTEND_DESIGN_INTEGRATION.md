# Frontend2 design integration

The runnable application remains `frontend/`. The customer interface adapts the
layout, colors, cards, calendar, booking steps and CSS supplied in `frontend2/`.
The source reference in `frontend2/` is retained unchanged. No backend schema,
business rule, seed data or payment provider configuration was changed.

## Run locally

Start `npm run dev` in `backend/` and in `frontend/`, using the existing configured
database. Open `http://127.0.0.1:5173/`. The existing Vite `/api` proxy remains in use.
For production, continue serving the frontend and `/api` on the same origin and
provide the SPA index fallback for frontend routes.

| Route | Behavior |
| --- | --- |
| `/` | Customer homepage and live service cards |
| `/services` | Searchable backend service catalog |
| `/about` | About layout with backend salon contact information |
| `/booking`, `/availability` | Four-step booking using live qualified staff and availability |
| `/manage`, `/appointment` | Secure guest lookup, payments, receipts and appointment changes |
| `/help` | Existing salon guide, presented in the new public layout |
| `/staff`, `/login`, `/admin` | Existing authenticated Admin/Cashier workspace |
| `/payment`, `/confirmation/:reference` | Secure appointment lookup; a reference alone does not authorize access |

Booking permits ordered service occurrences and per-service staff assignment,
including Any Available. Calendar dates use the backend salon timezone; exact
starting instants come from `/api/availability`. Changing selections invalidates
previous availability, including in-flight searches. Booking uses the existing
contact form and `/api/appointments`, then displays the actual server reservation,
hold countdown and payment controls. Confirmation requires the backend payment
transition. Existing cancellation/rescheduling, recovery and receipt handling are
reused. Guest tokens stay in memory; saved private links carry tokens in fragments.

The demo's hardcoded prices, staff, add-on charges, illustrative slots, browser
appointment storage and simulated confirmation are not used. The backend catalog
is authoritative, including any separately configured blow-dry services. Notes
and arbitrary payment choices were omitted because the booking API does not
accept those fields.

The reference did not include its six photo assets. CSS salon artwork fills the
hero/about areas until real photographs are supplied. Styles are scoped to the
public customer shell to preserve staff screens and receipt printing. No new
runtime dependencies are required; the implementation uses React and TypeScript
already installed in `frontend/`.

## Verification

- `cd frontend && npm run build` checks TypeScript and the production bundle.
- `cd backend && npm test` checks existing backend contracts.
- Browser checks: homepage catalog, service search and booking preselection;
  ordered selections, qualified staff, salon-local calendar and real availability;
  contact form, secure guest lookup and staff login; narrow and wide layouts.
- Actual external payment collection still requires the existing configured
  provider and its acceptance testing. The integration does not configure or
  certify a live payment account.

Verified locally on 2026-10-08: frontend TypeScript/production build passed and
all 54 backend unit/API tests passed. Browser checks confirmed the live catalog,
service search, qualified staff, salon-local calendar, actual available times,
assigned staff summary, contact form, secure guest lookup screen and staff login
screen. Narrow (390px) and wide (1366px) layouts were inspected; the mobile homepage
has no horizontal overflow and its navigation opens/closes correctly. No real
reservation or external payment was submitted during these browser checks.
