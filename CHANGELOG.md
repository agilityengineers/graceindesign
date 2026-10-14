# Changelog

## 0.2.0 — notifications: SendGrid senders, Slack, texts and auto sign-in through Call Flow Tracker
- Email now goes out from the right verified SendGrid sender per message (noreply@ / support@ / consultation@ / newsletter@); the outbox records sender and Reply-To, and the admin outbox shows them.
- Consultation requests are notified to the sales inbox (consultation@) with Reply-To the visitor; Caribbean Connection submissions and newsletter sign-ups to the support inbox.
- Slack incoming-webhook notifications (Block Kit, "Open in admin" / "Open Call Flow Tracker" buttons) for consultation requests, other public forms and Call Flow Tracker call events; toggles in Form builder → Notifications.
- Texts to Grace (and every other SMS) are sent through Call Flow Tracker's Twilio connection from her tracking number (`CFT_SMS_FROM`), falling back to direct Twilio, then the logged outbox.
- Auto sign-in links into Call Flow Tracker (`/go/cft/<token>`, 24h, hashed, audited, revocable) carried by the text and Slack post; "Open in Call Flow Tracker" in the lead drawer for signed-in team members.
- New secrets documented in `.env.example` and `docs/replit-notifications-setup.md`; migration `drizzle/0001_notifications.sql`; `npm run test:notifications`.

## 0.1.0 — first complete build (all four phases)

### Phase 1 — site, funnel, leads, pipeline
- Public site rebuilt from the design prototypes: homepage (classic/cinematic hero, admin-switchable), About, Services index, nine StoryBrand service landings, Healthy Home Resources hub + AIP Products + WELLness Resources + Home Health Series, Caribbean Connection, News & Insights, Contact, privacy/terms/accessibility, internal Roadmap.
- Shared chrome: utility bar with "Schedule a Consultation" modal, hover dropdown navigation, footer with admin-managed social links. Responsive below 1440 (stacks at 1024 and 720).
- Consultation funnel: 5-step wizard or single page, path inference from the source page, shared + per-path fields from the form builder, built-in time picker over admin availability, honeypot + rate limit + UTM capture, confirmation email with `.ics` and pre-consult checklist PDF, SMS confirmation, admin notification, 24h reminder job.
- Admin: dashboard, Leads (table + drag-and-drop board, drawer with activity log, notes, calls, emails, texts, proposal attachments, archive/delete, "Mark signed → create project"), Project Pipeline (board grouped by phase, table, drawer with invoices, milestones, documents, approvals, portal link, delete), Configure pipeline (phases, stages, per-stage automation, project fields, conversion rules), Calendar (week grid, book for a lead, availability blocks, booking settings), Form builder (shared and per-audience questions, reorder, notifications, form mode), Hero editor (style, headline, CTA, scenes with photo upload, before/after).
- Auth: invite-only magic links, sessions, roles owner/editor/sales/social + super admin, Call Flow Tracker SSO child endpoints.
- Integrations layer: inbound CFT webhook, outbound HMAC-signed webhooks with retries, email/SMS outbox (SendGrid/Twilio or logged), cron jobs via `/api/cron/<job>`.

### Phase 2 — CMS, products, RSS, Caribbean Connection
- Content (CMS): pages with block list, generic block editor, draft → preview → publish, SEO, new custom pages at `/p/<key>`; Services CRUD with reorder/nesting; News & Insights (written posts + RSS imports, publish, feature, share); Testimonials; About & team with photo upload; Media library (upload, replace slot, alt text, delete, Generate with Magnific); Site settings (contact & footer, social links, users & roles with invite/deactivate/delete, integrations status).
- Etsy products: paste a listing URL to import, featured toggle, category/tag edits, reorder, refresh from Etsy, cron sync.
- RSS feeds: sources with sync/pause/remove, imported items with publish/unpublish/delete, display settings.
- Caribbean Connection admin: resource directory and events moderation (approve with email, reject with reason, unpublish/restore, edit, delete), regional news sources, countries on/off, newsletter subscribers with CSV export and "Compose issue".
- Admin search across leads, projects, products, posts, pages, services and directory listings.

### Phase 3 — social
- Accounts: OAuth connect/disconnect for Facebook, Instagram, LinkedIn, Pinterest, YouTube (tokens encrypted).
- Compose with image, schedule or publish now, drafts, weekly content calendar, retry failed posts.
- Auto-share published blog posts to the networks enabled in settings; on-site Instagram feed toggle and count; engagement stats from stored metrics and social-attributed leads.

### Phase 4 — client ops
- Email & SMS drip sequences by stage and path, with steps, manual enrollment and backfill.
- SMS templates with merge fields and send-to-lead.
- Proposals with built-in e-signature (`/proposal/<token>`), PDF download, optional Dropbox Sign.
- Invoices (Stripe hosted invoices when configured, manual otherwise) with the Stripe webhook marking payments.
- Client portal (`/portal/<token>`) with schedule, documents, invoices and approvals.
- Webhook subscriptions UI (events, signing secret, ping, retry), outbox viewer, scheduled job runner, HubSpot sync.
- Unsubscribe page for newsletters.

### Tooling
- Drizzle migrations (`drizzle/0000_init.sql`), `scripts/migrate.ts`, `scripts/seed.ts` (`--force`, `--if-empty`), `scripts/reset.ts`, `scripts/cron.ts`, `scripts/fetch-media.ts`.
- `tests/smoke.mjs` (funnel + route smoke test) and `tests/shot.mjs` (full-page screenshots, with dev login).
- `.replit` autoscale deployment: build runs migrate + seed-if-empty + `next build`.
