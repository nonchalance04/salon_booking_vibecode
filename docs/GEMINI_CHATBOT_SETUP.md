# Gemini salon consultation

The public `/help` page uses `POST /api/chatbot`. Set `CHATBOT_PROVIDER=gemini`
to enable conversation-based consultation. The default `guided` provider works
without an external account. No database migration or permanent chat table is needed.

## Enable Gemini

1. Create a Gemini API key in https://aistudio.google.com/apikey.
2. Choose a Gemini model available to your project that supports Generate Content
   JSON structured output. Copy its exact model ID.
3. Add these settings to the backend `.env` or deployment secret environment:

   ```dotenv
   CHATBOT_PROVIDER=gemini
   GEMINI_API_KEY=your-private-key
   GEMINI_MODEL=your-selected-model-id
   CHATBOT_TIMEOUT_MS=15000
   ```

4. Start/restart the backend from `backend/` with `npm run dev`, or build with
   `npm run build` and run `npm start` for production. Restart the frontend dev
   server if necessary. Open `/help` on the frontend.
5. Ask about a concern, answer a follow-up question, and check the recommendation
   against the current service catalog. Replies identify AI consultation or guided
   mode, and provider failures display a fallback notice.

Keep the key out of Git and frontend/VITE variables. The backend uses Node's native
fetch against Google's Generate Content REST endpoint; no extra SDK is required.
Model IDs are configurable rather than pinned to a model that may be retired.

## Edit the answer guidance

The user's original file is copied verbatim to:

`backend/knowledge/salon_chatbot_guidelines.md`

The Gemini service reads this file for every generation request (maximum 50 KB).
In development, saved edits apply to the next request without restarting. The build
copies it to `backend/dist/knowledge/salon_chatbot_guidelines.md`; rebuild/redeploy
after changes in production. Paths are relative to the module, not the shell's
working directory. Never put secrets or private customer records in the document.

The file guides consultation and follow-up questions. Its example service names,
prices and durations are examples only. Active services priced above PHP 0 come from
the database. Cards are revalidated after generation and display database names,
descriptions, prices and durations, with application-generated booking URLs.

The guideline's example asking for an appointment reference in chat is superseded
by the application boundary: send customers to Manage my appointment for secure
lookup. The model has no database-write tools or private appointment access.

## Behavior and limits

- Six recent complete conversation turns are sent for context, at most 20,000
  history characters. Browser memory holds the displayed conversation; starting
  a new conversation or reloading clears it. The application does not persist it.
- Questions are limited to 1,000 characters. History is treated as untrusted input.
- Gemini returns a validated intent, answer and up to three service IDs/reasons.
  Unknown, inactive, nonpositive-price or newly removed recommendations cause
  guided fallback. Booking and management links come from the backend.
- Non-consultation intents use deterministic public information or handoff text.
  Actual availability, staff assignment, booking changes and payments stay in
  their existing domain services. General generated prose can still be inaccurate;
  verify representative salon scenarios before customer rollout.
- Timeout, quota/provider errors, safety-blocked/truncated/invalid responses, and
  missing/oversized guidance fall back to the guided assistant. Logs contain only
  a generic fallback event, not raw messages, keys or provider errors.
- The endpoint allows 20 requests per client per minute and 100 total per process
  per minute. Gemini generation concurrency is capped at four per service instance.
  Multiple-instance deployments need a shared ingress limit and provider quotas.
  Express uses the socket IP by default; configure only known proxy hops at the
  deployment layer before relying on client-IP limits behind a reverse proxy.
- Submitted messages, recent context, guidelines and public salon facts are sent
  to Google when Gemini is enabled. No application-persistent history does not
  imply a provider retention policy; review the terms for your selected API tier.

## Verify and troubleshoot

Run `npm run typecheck`, `npm test`, and `npm run build` in `backend/`.
Run `npm test` and `npm run build` in `frontend/`.
Automated tests use provider fixtures; they do not consume Gemini quota.

Test `/help` with an unclear concern, a follow-up, a valid recommendation, booking
handoff, unsupported service request, and a provider outage. Confirm the Book this
service link selects the service on `/booking?service=...`. Check prices against
the admin catalog and verify no chat request changes transactional records.

If every answer falls back, check key/model access, quota, model structured-output
support and that the deployed knowledge file exists. Keep diagnostic secrets out
of logs. Set `CHATBOT_PROVIDER=guided` and restart to disable external generation.

References: https://ai.google.dev/gemini-api/docs/api-key and
https://ai.google.dev/gemini-api/docs/generate-content/structured-output.
