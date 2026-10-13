# Imported project

Keep the finished Next.js app's existing structure, stack, and features. The user requested setup exactly as imported, not a rewrite, restructuring, or feature additions.

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

## Workflow argument forwarding

The `db:setup` script ends with `npm run db:seed --` so the workflow's `--if-empty` argument reaches `scripts/seed.ts`. Populated databases skip seeding and continue to app startup without resetting existing data.
