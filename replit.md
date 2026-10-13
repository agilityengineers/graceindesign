# Imported project

Keep the finished Next.js app's existing structure, stack, and features. The user requested setup exactly as imported, not a rewrite, restructuring, or feature additions.

## Running on Replit

- Dependencies are installed from the existing npm package definitions.
- Replit PostgreSQL provides `DATABASE_URL`.
- Configure `SESSION_SECRET`, `BASE_URL`, and `CRON_SECRET` in Replit Secrets. Never commit their values.
- Use the existing **Start application** workflow:
  `npm run db:setup -- --if-empty && npm run dev`
- Next.js serves on port 5000. The homepage `/` and `/login` were visually checked and returned HTTP 200.

## Imported workflow caveat

During setup, npm expanded `db:setup -- --if-empty` into `npm run db:migrate && npm run db:seed --if-empty`, then invoked `tsx scripts/seed.ts` without the flag. The first seed succeeded against the empty database, but the seed script refuses to run against populated data without `--if-empty`. This may prevent subsequent workflow starts. The existing workflow and scripts were deliberately left unchanged per the user's setup-only instruction.
