# Changelog

## Unreleased — AIP Products: Amazon picks (any store), not Etsy-only
- The product catalog links to whichever store sells the item. Each listing records its store (`retailer`: Amazon, Etsy or other) and an optional description; cards read "View on Amazon" / "View on Etsy", Amazon photos sit on a light background, review counts name the store, and the page header counts listings beside an "Available on Amazon" badge. Migration `drizzle/0003_products_retailers.sql`.
- Admin → Products (was "Etsy products"): paste an Amazon or Etsy link and the listing page is read for title, photo, price and rating (Amazon may decline, so every field is editable, including the link, store and description). "Refresh" re-reads the store page; the scheduled `etsy` job keeps its name but refreshes prices, ratings and un-replaced photos for every store and never overwrites titles, descriptions or uploaded photos.
- AIP Products page: header, badge and the Healthy Home Resources card no longer say "our Etsy shop"; category filters come from the products' own categories (the block's list only orders them); an optional `disclosure` line prints under the grid for an affiliate note. Seed moved to `src/lib/seed-data/products.ts`.
- `npm run content:products` adds the seeded listings and the new wording to an existing database without overwriting admin edits (`--images` self-hosts photos, `--refresh` reads the store pages). See `docs/products.md`.
- Amazon shop: the Associates tracking id (Site settings → Amazon shop or `AMAZON_ASSOCIATE_TAG`) goes on every Amazon link; Amazon items with an ASIN get an **Add to Amazon cart** button (Associates add-to-cart link, checkout on Amazon), and the AIP Products grid and product shelves offer **Add all to your Amazon cart** in one click. Product cards became articles (photo and title link out; buttons sit below).
- Product shelf block (`product_shelf`): a product row with optional category filter, featured-only, limit, link and "add all" button that an admin can place on any block-based page from Content → Pages.
- Product Advertising API 5 (optional, `AMAZON_PAAPI_ACCESS_KEY` / `AMAZON_PAAPI_SECRET_KEY`): Admin → Products → Search Amazon adds items with live title, photo, price and rating; "Fetch & add", "Refresh" and the scheduled job read Amazon items through the API (batches of ten) when the keys are set. Requests are signed with AWS Signature V4 in `src/lib/server/amazon.ts`; `npm run test:amazon` checks the signing against reference values. The Amazon entry appears on the Integrations panel.
- Seeded the four products from the previous site's Amazon page (water bottle, two resistance band sets, Amazfit Bip 6) with condensed descriptions; their links are Amazon searches for the exact item until the real listing links are pasted in.

## Unreleased — image picker in the admin
- Every admin image field now offers **Upload from computer** or **Choose from library** (new `ImagePicker` component + `GET /api/admin/media`): page blocks, hero editor (scenes, classic photo, before/after), service photos, news/insights cover, team photos and social posts.
- Library picks are stored as `media://slot` when the image fills a slot, so swapping that image in the Media library still updates every page that uses it. Social posts resolve the pick to a real URL because networks need one.
- Hero editor: the classic photo can now be changed for services too (previously the upload was ignored for service heroes).

## 0.2.1 — pre-launch review (October 2026)
- Removed prototype/demo content from the public site: invented products, ratings and review counts, Caribbean events, regional headlines attributed to real publishers, placeholder article bodies, the model-home testimonial placeholder, and every admin-facing instruction visible to visitors (before/after note, lead-source pills, form-builder notes).
- Corrected claims: no unsupported volume claims ("hundreds of…"), Aging In Place wording describes assessment, recommendations and contractor coordination (not installation), Project Management describes owner-side coordination without outcome guarantees, Commercial hero reads "A workspace…".
- Brand casing: prose uses "Aging In Place"; the credential stays "Certified Aging-in-Place Specialist (CAPS)". URL slugs unchanged.
- Footer: placeholder address removed (fields render only when set); public "Admin login" link removed.
- Forms: service-page lead forms now require an explicit consent checkbox; consult form thank-you no longer says "You're booked" when no slot was chosen; newsletter form carries consent wording.
- Empty states for products, news, events and the regional column; product cards show title, price and "View on Etsy" (review counts only after a real Etsy sync); article cards credit RSS sources.
- SEO: sitemap, robots, favicon, canonical links, noindex on private pages, unique meta descriptions, GA4 via `NEXT_PUBLIC_GA_MEASUREMENT_ID`, 301 redirect map, media-library alt text on images.
- `scripts/launch-content.ts` (`npm run content:launch`) applies these content corrections to an already-seeded database; `npm run db:seed` is content-only unless `--demo`.
- `tests/launch-content.mjs` guards against prototype/admin text and checks the SEO plumbing.

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
- `.replit` autoscale deployment: build runs `npm ci --include=dev && npm run build` (migrations and seeding happen in the workspace workflow, not in the publish build).
