# Imported project

Keep the finished Next.js app's existing structure, stack, and features. The user requested setup exactly as imported, not a rewrite, restructuring, or feature additions.

## Publishing

The publishing build explicitly includes development dependencies (`npm ci --include=dev && npm run build`) because production-mode npm otherwise omits TypeScript, Tailwind, and other required build tools. Keep `NODE_ENV=production` for the production build and server.

Do not run migration or seed scripts in the publishing build. This project uses Replit-managed PostgreSQL; publishing manages production schema changes and the initial data copy. Development migrations remain in the existing development setup workflow.

## After task merges

Replit runs `scripts/post-merge.sh` to install the locked dependencies and run the existing database setup with `--if-empty`, then restarts the configured workflow. The script does not reset existing data or run a production build alongside the development server.

## Running on Replit

- Dependencies are installed from the existing npm package definitions.
- Replit PostgreSQL provides `DATABASE_URL`.
- Configure `SESSION_SECRET`, `BASE_URL`, and `CRON_SECRET` in Replit Secrets. Never commit their values.
- Development sign-in destinations use the runtime-managed preview domain before inherited `BASE_URL`, keeping fork links isolated. Production still uses `BASE_URL`.
- Use the existing **Start application** workflow:
  `npm run db:setup -- --if-empty && npm run dev`
- Next.js serves on port 5000. The homepage `/` and `/login` were visually checked and returned HTTP 200.

## Safe authentication diagnostics

The development login confirmation redirects only to `/login?sent=1`. Its link is kept in bounded, process-local storage for five minutes and retrieved using a scoped HttpOnly cookie, never a URL lookup handle. Reloads work during that window; restarting the server or eviction requires requesting another link. Production and configured email delivery never expose this UI. Login responses are private/no-store.

Verification links use `/auth/verify#token=…`. A standalone, no-store page removes the fragment from the current history entry before exchanging it in a JSON POST body; no token is sent in HTTP request URLs or referrers. JavaScript is required. Old query-string links are not consumed; request a fresh link. Existing email copies, browser extensions, history synchronization before script execution, and JavaScript-disabled browsers are outside this guarantee. Do not log Cookie headers, request/response bodies, or full emailed links. Email-provider click tracking must not wrap sign-in links in credential-bearing redirect URLs.

Run `npm run test:dev-link-store` for expiry and isolation tests. The auth browser smoke also checks login history, outgoing request URLs, and referrers without printing credentials.

Use `npm run dev` / `npm start`, not bare `next`: the launcher redacts auth query values from both Next.js output streams, including worker errors. Request paths, statuses, timings, and ordinary messages remain visible. Sign-in email previews omit their body; actual delivery and the development login-page link are unchanged. This only protects application console output, not browser history, proxy access logs, or stored email bodies.

Run `npm run test:log-redaction` for synthetic logging regression tests. Run the existing browser auth smoke with `AUTH_SERVER_LOGS_REDACTED=1 node tests/auth-smoke.mjs` against that launcher; never enable traces or raw credential diagnostics.

`npm run test:auth-logging` starts its own development server on port 5000 and captures logs in memory while testing login, the dev-link UI, email persistence, verification, and invalid-link errors. Stop the normal workflow first, run against a development database without SendGrid configured, then restart the workflow. It removes its temporary account and auth records and never follows credentials to a different origin.

## Concurrent sign-in regression

`npm run test:magic-link-concurrency` starts its own development server on port 5000; stop the normal workflow first and restart it afterward. Run only against the development database. It holds a row lock until eight real verification requests contend for the same token, then checks that exactly one session is created. Replay, expired/used tokens, inactive users, and missing users must fail. Test accounts and auth records are removed, redirects are not followed, and credential-bearing diagnostics are never printed.

## Workflow argument forwarding

The `db:setup` script ends with `npm run db:seed --` so the workflow's `--if-empty` argument reaches `scripts/seed.ts`. Populated databases skip seeding and continue to app startup without resetting existing data.
