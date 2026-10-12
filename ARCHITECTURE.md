# Architecture

Think of the app as one house with three doors: the **public site** visitors walk through, the **admin** the team works from, and a **service entrance** (APIs and webhooks) for Call Flow Tracker and the other systems that will be wired up after launch. All three doors open onto the same rooms: one Postgres database, one media store, one outbox for messages.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router, React 19, TypeScript), server components + server actions |
| Styling | Tailwind v4 base + hand-written design tokens in `src/app/globals.css` (navy `#1a2238`, sky `#6cb6e6`, Montserrat + Cormorant Garamond) |
| Database | PostgreSQL via Drizzle ORM (`src/lib/db/schema.ts`), migrations in `drizzle/` |
| Storage | Replit Object Storage (`@replit/object-storage`) with local `./.data/uploads` fallback; served through `/api/media/[...key]` |
| Email / SMS | SendGrid / Twilio through the `outbox` table (`src/lib/server/outbox.ts`) |
| PDFs / calendar | `pdf-lib` (checklist, proposals), server-generated `.ics` |
| Auth | Magic links + DB sessions + signed cookie; roles owner/editor/sales/social, super admin flag |
| Hosting | Replit Autoscale (`.replit`), port 5000 → 80 |

## Code map

```
src/app/(site)/        public pages (block-rendered CMS pages, service landings, news, caribbean, contact, portal, proposal)
src/app/admin/         admin screens (one folder per section)
src/app/api/           JSON endpoints: consult funnel, media, cron, CFT (sso, master, webhooks), social OAuth, stripe, exports
src/components/site/   nav, footer, heroes, carousels, consultation form, block renderer
src/components/admin/  shell, nav, drawers, boards, sortable lists, block editor, hero editor
src/lib/db/            schema, constants (client-safe), pool
src/lib/auth/          sessions, magic links, CFT SSO, signed routes
src/lib/server/        domain logic: consult, projects, settings, outbox, webhooks, cron, rss, etsy, social, sequences, stripe, esign, hubspot, magnific, storage, pdf, ics
src/lib/actions/       "use server" actions used by admin forms (auth + audit + redirect with toast)
src/lib/seed-data/     prototype content ported verbatim (services, form schema, pages/blocks, media slots, demo data)
scripts/               migrate, seed, reset, cron runner, media fetcher
drizzle/               SQL migrations
tests/                 smoke test and screenshot helper
```

## Request flow

- **Public pages** are server components. They read from the database through cached loaders in `src/lib/data/site.ts`, resolve `media://` slots through `src/lib/data/media.ts`, and render blocks with `src/components/site/blocks.tsx`. `?preview=1` shows draft content to signed-in team members only.
- **Consultation funnel**: the modal / `/contact` form fetches `/api/consult/schema?from=<page>` and `/api/consult/slots`, then POSTs `/api/consult/submit`. `submitConsultation()` creates the lead (+ booking), sends the confirmation (email + `.ics` + checklist PDF, optional SMS), notifies the admin, emits `lead.created` / `booking.created` webhooks and enrols drip sequences.
- **Admin** pages call `requireArea("<area>")` and render forms whose `action` is a server action in `src/lib/actions/*`. Every action runs through `adminAction()` (auth → work → audit log → revalidate → redirect with `?ok=` / `?err=` toast). Drag and drop calls small actions directly (`moveLeadStage`, `moveProjectStage`, `reorder*`).
- **Permissions** (`src/lib/auth/session.ts`): owner → everything; editor → pages, services, posts, media, hero, rss, products; sales → leads, calendar, projects, ops; social → social, posts, media. `requireOwner()` guards users & roles. Super admins are owners who can manage other super admins.

## Scheduled work

`/api/cron/<job>` (bearer `CRON_SECRET`) or `npm run cron -- <job>` runs: `reminders` (24h booking reminders), `rss`, `etsy`, `social` (publish due posts, sync feeds), `drips`, `webhooks` (retry deliveries), `outbox` (retry queued mail/SMS), `hubspot`, or `all`. Each run is logged in `cron_runs`. On Replit, create a Scheduled Deployment that runs `npm run cron -- all` every 15 minutes (plus `rss` hourly if you prefer a separate cadence).

## Call Flow Tracker integration (switched on after launch)

| Direction | Endpoint | Secret | Notes |
| --- | --- | --- | --- |
| CFT → GID events | `POST /api/webhooks/cft` | `CFT_WEBHOOK_SECRET` (`X-CallFlow-Signature: sha256=<hex hmac>`) | Call/contact events create or update leads (`leads.external_source = cft`, `external_id`), log activity and dedupe through `webhook_events`. |
| CFT → GID sign-in | `GET /api/sso/launch` | `CFT_SSO_SECRET` (+ `_PREVIOUS` for rotation), `CFT_SSO_APP_ID` | Connected Apps child: verifies the signed launch token, maps CFT role → GID role via `site_settings.cft_role_map`, creates/links the user (`users.cft_user_id`) and opens a session. |
| CFT ⇄ user directory | `GET/POST /api/master/users`, `PATCH/DELETE /api/master/users/[id]`, `POST /api/master/sessions/revoke` | signed with `CFT_SSO_SECRET` | Lets CFT provision, update, deactivate and sign out users. |
| CFT dashboard tile | `GET /api/dashboard-metrics` | signed | Lead, booking, project and revenue counts for the CFT master dashboard. |
| GID → CFT (or any CRM) | Admin → Client ops → Webhooks | per-subscription `whsec_…` (`X-GID-Signature`) | Events: lead.created/updated/stage_changed, booking.created/cancelled, project.created/stage_changed, invoice.paid, proposal.signed, cc.submission.created/published. Retries with backoff; deliveries visible in the admin. |

Set `CFT_URL` so the login page can link back to CFT, register this app's launch URL (`<BASE_URL>/api/sso/launch`) under CFT → Administration → Connected Apps, and paste the secrets into Replit Secrets. Nothing else changes.

## Replit runbook

1. **Create the Repl** from this repository (Node 20 + PostgreSQL modules are declared in `.replit`). Replit injects `DATABASE_URL`.
2. **Secrets** (Tools → Secrets): `SESSION_SECRET` (required), `BASE_URL` (your published domain, e.g. `https://graceindesign.net`), `CRON_SECRET`, then `SENDGRID_API_KEY` + `EMAIL_FROM`, `TWILIO_*`, and later the Phase 3/4 keys listed in `.env.example`.
3. **Run**: the "Project" workflow runs `npm run db:setup -- --if-empty && npm run dev`. First run creates the schema and seeds the prototype data, including the two owner accounts (`info@graceindesign.net`, `emailme@clarencewilliams.com` as super admin) and the demo team.
4. **Sign in**: open `/login`, enter an owner email. Until SendGrid is configured the sign-in link is shown on screen; afterwards it is emailed.
5. **Images**: run `npm run media:fetch` once in the Replit shell (needs `MAGNIFIC_API_KEY`, or `-- --stock` to self-host the prototype stock photos) so generated photos are stored under `public/media/`; or upload replacements through Content → Media library.
6. **Publish**: Deployments → Autoscale. The build command runs migrations, seeds if the database is empty, and `next build`; run command is `npm run start`. Point the custom domain at the deployment.
7. **Scheduled jobs**: Deployments → Scheduled → command `npm run cron -- all`, every 15 minutes (same secrets).
8. **Object Storage**: create a bucket and set `REPLIT_OBJECT_STORAGE_BUCKET` so uploads persist across deployments (otherwise they live on the instance disk).

## Local development

```
cp .env.example .env            # edit DATABASE_URL etc.
npm install
npm run db:setup                # migrate + seed
npm run dev                     # http://localhost:5000
node tests/smoke.mjs            # funnel + route smoke test (dev server must be running)
node tests/shot.mjs --login emailme@clarencewilliams.com /admin /admin/leads   # screenshots
npm run verify                  # typecheck + lint + production build
```

`npm run db:seed -- --force` wipes and reseeds; `npm run db:reset` drops everything.
