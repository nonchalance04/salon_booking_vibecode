# Decisions

This document records important architectural decisions.

## 2026-10-03 — Phase 2 authentication implementation

Implements the existing authentication architecture without adding models or
changing scheduling/financial rules:

- Retain the existing eight-hour HS256 JWT lifetime. Store tokens in a host-only
  HttpOnly cookie scoped to `/api`; production uses Secure. Default SameSite is
  Lax, with explicit configuration for deployment topology.
- Require explicit HTTPS trusted origins in production. Development defaults
  allow only the two local Vite origins. Reject unsafe requests without a trusted
  Origin or, only when Origin is absent, a validated trusted Referer.
- Use bcrypt cost 12. New passwords require 12 characters and at most 72 UTF-8
  bytes; login still accepts existing shorter passwords without changing them.
- Normalize account emails to lowercase in application writes and login.
- Recheck active status and current database role on protected requests. Do not
  add refresh tokens, persistent sessions, or a token revocation model. Logout
  clears the browser cookie; password changes do not revoke issued tokens.
- Use same-origin frontend `/api` requests, with Vite proxying in development and
  a documented HTTPS reverse proxy for deployment.
- Audit Admin account changes in the same transaction, without storing password
  material. Deactivate accounts instead of deleting historical references.
