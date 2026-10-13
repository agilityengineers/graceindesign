# Admin authentication verification

Verified on 2026-10-13 through the actual HTTPS Replit preview.

## Configuration and result

**PASS: sign-in links target the current preview and the complete browser flow
passes without origin remapping.**

The environment configuration check confirmed that `BASE_URL` exists as a secret
for development and production; its value was neither retrieved nor printed.
The previous verification established that the inherited setting targeted another
origin. No secret was changed: development now selects the runtime-managed
`REPLIT_DEV_DOMAIN` before inherited canonical settings. Production continues to
prefer `BASE_URL`; local development without a managed preview also honors it.
This works for both main-workspace and fork previews without baking in either URL.
Production itself was not modified, contacted, or verified.

`tests/base-url.test.ts` covers preview isolation, production precedence, and
local/domain fallbacks. All three tests pass. Type checking and linting the changed
application files pass. An initial type check raced Next's regeneration of its
generated route types; it passed after startup settled.

## Browser checks

`tests/auth-smoke.mjs` passed through the real proxied preview:

- Signed-out admin is gated; unknown addresses get a generic confirmation.
- The actual login form creates a hashed, unused, expiring token.
- The generated link targets this preview; mismatches fail before following it.
- Development email is recorded as logged, never sent.
- Link consumption renders admin, consumes the token, and records a session.
- Reload and protected navigation retain authentication.
- Signed-in login redirects to admin; requested internal destinations work.
- Both GET and POST sign-out clear the cookie and revoke the session.
- Revoked cookies and used, invalid, or expired links cannot restore access.
- No browser runtime errors occurred.

The temporary owner uses a unique reserved `.invalid` address. Its account,
sessions, tokens, and outbox records were removed afterward.

## Cookie investigation

The strict original SameSite=Lax browser assertion failed because the managed
HTTPS preview delivers the cookie as **SameSite=None; Secure**. HTTP-only,
root scope, and persistent expiry are preserved.

A separate diagnostic consumed a fresh link directly against this same server's
loopback port, with redirects disabled. Its raw Set-Cookie response confirmed
**SameSite=Lax**, HTTP-only, root scope, persistent expiry, and no Secure flag in
development. This demonstrates the attribute change happens between the server
and the preview browser, not in application session creation.

The test now asserts None plus Secure only for the exact managed HTTPS preview
origin, and Lax for direct/local runs. It also checks the direct server response.
The application cookie policy remains unchanged. The loopback diagnostic is
separate from the completed preview browser flow, not origin remapping.

## Safe reproduction

Use only a development database/server without SendGrid configured. Suppress
server stdout/stderr before testing because development email and request logs
can contain credentials. Do not enable tracing or network logging.

```sh
# Temporarily use this workflow command:
npm run db:setup -- --if-empty && npm run dev > /dev/null 2>&1

# In a separate shell, with the workflow running:
AUTH_SERVER_LOGS_SUPPRESSED=1 node tests/auth-smoke.mjs
npx tsx --test tests/base-url.test.ts
```

Leave `AUTH_SMOKE_BASE` unset to use the actual managed preview. No token is sent
to another deployment or real email. Diagnostics print only assertion names and
cookie attributes, never raw headers or credentials. Restore the ordinary workflow
command afterward. Permanent credential-log protection is separate work.

The login page was visually checked; authenticated UI was exercised by the browser
test. The broader smoke test was not run because it creates unrelated business data.
