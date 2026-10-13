# Admin authentication verification

Verified on 2026-10-13 without changing application authentication or features.

## Result

**Local authentication works; the configured BASE_URL does not target this fork's preview.**
The overall auth smoke command therefore exits **1**, not a false success.
The secret value was not read or printed. Only the origin of the generated
development sign-in link was compared with the test server's origin.
No request carrying a token was sent to the other origin.

The local run passed:

- Signed-out `/admin` redirects to login.
- Unknown addresses receive the generic confirmation without a development link.
- The actual login form issues a hashed, unused, expiring magic-link token.
- Development email is recorded with `logged` status and the console provider;
  no real email is sent.
- Consuming the link renders `/admin` and marks the token used.
- A database session records the magic-link source; the local cookie is HTTP-only,
  SameSite=Lax, root-scoped, and persistent (Secure is false in development).
- Reload and navigation to `/admin/leads` preserve authentication.
- Signed-in `/login` redirects to admin.
- GET sign-out through the UI clears the cookie and revokes the session.
- Restoring a revoked cookie cannot restore access.
- Used, invalid, and expired links are rejected without creating a session.
- A requested internal destination (`/admin/leads`) is honored.
- POST sign-out returns 303 to login, clears the cookie, and revokes the session.
- Admin access is gated again after sign-out; no browser runtime errors occurred.

The test account, its sessions, tokens, and development email records were removed.
The app's ordinary login rate-limit counters are not reset by the test.

## Boundaries and reproduction

`tests/auth-smoke.mjs` uses the actual Next.js login form, verification route,
session cookie/database state, protected UI, and both sign-out methods.
It creates a unique temporary owner at a reserved `.invalid` address, not a real
team member. It refuses to run when SendGrid is configured or NODE_ENV is production.
Use only against a development database/server.

The development outbox prints email bodies, and Next.js request logging can include
token URLs. **Suppress server stdout and stderr before running** (for example,
`npm run dev > /dev/null 2>&1`). Do not enable browser tracing or network logging.
The test itself reports named assertions, never raw errors, URLs, cookies, or tokens.

The completed local run used:

```sh
AUTH_SMOKE_BASE=http://127.0.0.1:5000 AUTH_SERVER_LOGS_SUPPRESSED=1 node tests/auth-smoke.mjs
```

Without AUTH_SMOKE_BASE the test uses the public Replit development domain.
The proxied attempt reached the signed-in admin but did not pass the strict cookie
attribute assertion; the completed cookie/session checks above were on the local
server, not a claim that all proxy behavior passed.

When the generated origin differs, the test records a failure and uses browser
interception to send verification requests only to the test server, translating
redirect destinations back to that server. This permits local authentication
diagnosis, **not** confirmation that the configured BASE_URL works end-to-end.
Follow-up should confirm the intended development origin and rerun without needing
this remapping. A task fork can inherit configuration intended for another preview.

The login page was also visually checked. Authenticated UI was exercised by the
browser test (no screenshots containing links or credentials were retained).
The existing broad smoke test was not run: it creates consultation/newsletter data
outside this task. The existing screenshot helper was not used because it inserts
a token directly and would skip the actual magic-link request.

The workflow was temporarily run without database setup and with output suppressed;
its original command was restored afterward. The separate startup task owns the
seed/startup fix.
