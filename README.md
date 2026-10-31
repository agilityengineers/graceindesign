# Grace In Design — website, consultation funnel, admin & client ops

Production build of graceindesign.net for Grace In Design Services, LLC (Atlanta interior design, aging-in-place and project management). One Next.js app serves the public site, the consultation funnel, the admin/CMS, the project pipeline, social publishing and client operations, backed by PostgreSQL and built to run on Replit.

- **Design handoff** (the spec this was built from): `docs/handoff/README.md` and the prototypes in `design/`.
- **What was decided along the way**: `DECISIONS.md`.
- **Screen-by-screen checklist**: `SCREENS.md`.
- **How it fits together, Call Flow Tracker integration, Replit runbook**: `ARCHITECTURE.md`.
- **Release notes**: `CHANGELOG.md`.

## Quick start

```bash
cp .env.example .env     # set DATABASE_URL (Replit provides it automatically)
npm install
npm run db:setup         # migrations + content seed (owners, pages, services, media slots). Add `-- --demo` for sample leads/projects
npm run dev              # http://localhost:5000
```

Sign in at `/login` with `info@graceindesign.net` or `emailme@clarencewilliams.com`. Without `SENDGRID_API_KEY` the magic link is shown on the page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run start` | Next.js dev server, production build, production server (port 5000) |
| `npm run db:migrate` | Apply SQL migrations from `drizzle/` |
| `npm run db:seed [-- --force | --if-empty | --demo]` | Seed site content (force = wipe first; if-empty = skip when data exists; demo = also plant sample leads, projects, team accounts and subscribers) |
| `npm run content:launch [-- --dry-run | --ops]` | Apply the October 2026 pre-launch content corrections to an already-seeded database without wiping it (dry-run prints the changes; ops also removes sample operations data). See `docs/launch-content.md` |
| `npm run content:products [-- --dry-run | --images | --refresh]` | Add the seeded product listings (`src/lib/seed-data/products.ts`), the store-neutral AIP Products wording and the WELLness-Products section on Healthy Home Resources to an already-seeded database, matched by URL so admin edits survive. See `docs/products.md` |
| `npm run db:reset` | Drop everything |
| `npm run cron -- <job>` | Run a scheduled job (`reminders`, `rss`, `etsy`, `social`, `drips`, `webhooks`, `outbox`, `hubspot`, `all`) |
| `npm run media:fetch` | Download generated/stock imagery into `public/media/` |
| `npm run verify` | Typecheck + lint + production build |
| `npm run test:notifications` | Unit tests for sender routing, Call Flow Tracker tokens and Slack payloads |
| `npm run test:amazon` | Unit tests for Amazon link/ASIN/cart helpers and the Product Advertising API request signing |
| `npm run test:shelves` | Unit tests for the named product shelves (WELLness-Products) and the Healthy Home Resources seed |
| `npm run test:cc-events` | Unit tests for the Community Events rule: a past event leaves the public page at midnight in its own time zone |
| `node tests/smoke.mjs` | Funnel and route smoke test against a running server (writes a test lead) |
| `npm run test:launch-content` | Read-only crawl of the public pages: no prototype/admin text, unique titles and descriptions, robots, sitemap, favicon, noindex, redirects |
| `node tests/shot.mjs --login <owner email> /route …` | Full-page screenshots (dev helper) |

## Where things live

Public site: `src/app/(site)`. Admin: `src/app/admin`. APIs (funnel, cron, Call Flow Tracker, social OAuth, Stripe): `src/app/api`. Domain logic: `src/lib/server`. Admin server actions: `src/lib/actions`. Schema: `src/lib/db/schema.ts`. Prototype content seeds: `src/lib/seed-data`.

## Environment

Everything configurable is listed in `.env.example`. Only `DATABASE_URL`, `SESSION_SECRET` and `BASE_URL` are needed to run; email, SMS, Slack, Call Flow Tracker, social networks, Stripe, e-sign and HubSpot switch on when their secrets are added, and the admin's Integrations panel shows which are live. The notification wiring (which SendGrid address sends what, Slack, texts and auto sign-in through Call Flow Tracker) is in `docs/replit-notifications-setup.md`.
