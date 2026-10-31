# Screen → route checklist

Every design file in `design/` mapped to what was built. "Deviation" lists anything intentionally different from the prototype; everything else follows the prototype's layout, copy and behaviour.

| Design file | Route(s) | Status | Deviations / notes |
| --- | --- | --- | --- |
| `SiteNav.dc.html` | component `src/components/site/SiteNav.tsx` on every page | Done | Services and Healthy Home Resources menus come from the `services` table (nav group, nesting, published state). |
| `SiteFooter.dc.html` | component `src/components/site/SiteFooter.tsx` | Done | Social icons and contact details come from Site settings. "Admin login" / "Build roadmap" links show for signed-in team members. |
| `ConsultForm.dc.html` | modal on every page (utility bar "Schedule a Consultation") and `/contact` | Done | Wizard or single page per admin setting; visitor toggle optional. Booking slots come from Calendar → Availability blocks. |
| `Grace In Design Homepage.dc.html` | `/` | Done | Hero style (classic/cinematic) switchable from the floating admin pill or Hero editor. Featured products and news rows read from the database. |
| `About.dc.html` | `/about` | Done | Copy verbatim; founder card from About & team. |
| `Services.dc.html` | `/services` | Done | Rows render from the `services` table (order and nesting editable). |
| `Service.dc.html` (template) | `/services/residential`, `/services/residential/design-refresh`, `/services/residential/model-home`, `/services/aging-in-place`, `/services/aging-in-place/virtual`, `/services/commercial`, `/services/project-management`, `/services/start` (general), `/healthy-home-resources/aip-partners` | Done | All nine slugs from `services-data.js`. Before/after slider appears where the service has a pair. Model Home tier pricing is a labelled placeholder (open item). |
| `Residential Alt.dc.html` | `/services/residential` with the classic hero | Done | Same page; the alternate is the hero style toggle, persisted per service. |
| `Healthy Home Resources.dc.html` | `/healthy-home-resources` | Done | — |
| `AIP Products.dc.html` | `/healthy-home-resources/aip-products` | Done | Grid and carousel read from the product catalog (Amazon, Etsy or other store links); filters come from the products' categories; "View on Amazon" / "View on Etsy" per card. |
| `WELLness Resources.dc.html` | `/healthy-home-resources/wellness` | Done | Lead magnet emails the checklist PDF and records a newsletter subscriber. |
| `Home Health Series.dc.html` | `/healthy-home-resources/home-health-series` | Done | Episode data seeded from the prototype. |
| `Caribbean Connection.dc.html` | `/caribbean-connection` | Done | Directory, events and regional column read from moderated tables; forms create Pending items and email the submitter. |
| `News-and-Insights.dc.html` | `/news`, `/news/[slug]` | Done | Written posts and RSS imports; RSS items link out to the source. |
| `Contact.dc.html` | `/contact` | Done | Steps strip + full consultation form; `?from=<page>` pre-selects the path. |
| `Roadmap.dc.html` | `/roadmap` (team members only) | Done | Kept as an internal page. |
| `Admin.dc.html` — Dashboard | `/admin` | Done | Stats and lists are live queries. |
| `Admin.dc.html` — Leads | `/admin/leads`, `/admin/leads/new` | Done | Table + board, source pills, search, archived filter, CSV export, drawer. |
| `Admin.dc.html` — Project Pipeline | `/admin/projects`, `/admin/projects?view=config`, `/admin/projects/new` | Done | Board grouped by phase with horizontal scroll; config screen as designed plus invoices/milestones/documents/approvals/portal in the drawer. |
| `Admin.dc.html` — Calendar | `/admin/calendar` | Done | Added "Book for a lead" (phone bookings) and booking status actions. |
| `Admin.dc.html` — Form builder | `/admin/forms` | Done | Added audience (path) editing and a "new audience" form. |
| `Admin.dc.html` — Content (CMS) | `/admin/content`, `/admin/content/services`, `/admin/content/services/[id]`, `/admin/content/posts`, `/admin/content/posts/[id]`, `/admin/content/testimonials`, `/admin/content/team`, `/admin/content/media`, `/admin/content/settings` | Done | Sub-sections are separate routes with a tab strip. Block editor is a generated form (JSON-driven) rather than inline editing on the page. |
| `Admin.dc.html` — Hero editor | `/admin/hero?page=<key or service slug>` | Done | — |
| `Admin.dc.html` — Products | `/admin/products` | Done | Paste an Amazon or Etsy link; details read from the public listing page; inline edits for title, description, link, store, category, tag, price, rating. |
| `Admin.dc.html` — RSS feeds | `/admin/rss` | Done | — |
| `Admin.dc.html` — Caribbean Connection | `/admin/caribbean?tab=resources|events|sources|countries|subscribers` | Done | "Compose issue" queues the newsletter through the outbox (no external ESP). |
| `Admin.dc.html` — Social media | `/admin/social` | Done | Engagement numbers come from stored post metrics; zero until networks are connected. |
| (not in prototype) Client ops | `/admin/ops?tab=sequences|sms|proposals|invoices|approvals|webhooks|outbox|jobs` | Added | Phase 4 screens the prototype did not include: drips, SMS templates, proposals, invoices, approvals, webhooks + Call Flow Tracker status, outbox, scheduled jobs + HubSpot. |
| (not in prototype) Search | `/admin/search?q=` | Added | Header search box from the prototype now returns results. |
| (not in prototype) Sign in | `/login` | Added | Magic-link sign in; shows the link on screen until SendGrid is configured. |
| (not in prototype) Booking details | `/booking/[id]?e=<email>` | Added | Linked from confirmation emails; `.ics` and checklist PDF downloads. |
| (not in prototype) Client portal | `/portal/[token]` | Added | Phase 4. |
| (not in prototype) Proposal | `/proposal/[token]` | Added | Phase 4 e-sign page + `/api/proposal/[token]/pdf`. |
| (not in prototype) Unsubscribe | `/unsubscribe?e=` | Added | Linked from newsletter emails. |
| (not in prototype) Custom CMS pages | `/p/[key]` | Added | Pages created in the CMS. |
| (not in prototype) Legal | `/privacy`, `/terms`, `/accessibility` | Added | Footer links; editable as CMS pages. |

## Global deviations

- **Hosting/stack**: Replit + own Postgres/auth/storage instead of Vercel + Supabase (owner's direction). See `DECISIONS.md`.
- **Images**: stock placeholders in the prototypes are media slots. Generated Magnific photos are referenced by creation id and fetched with `npm run media:fetch` on Replit; until fetched, slots fall back to the prototype's stock URL or a labelled placeholder.
- **Email provider**: SendGrid (owner's direction) instead of Resend.
