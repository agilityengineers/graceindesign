# Handoff: Grace In Design — Website, Consultation Funnel, Admin/CMS, Project Pipeline

## Overview
Full rebuild of graceindesign.net for Grace In Design Services, LLC (Atlanta; interior design, aging-in-place, project management). Deliverable is a production site with:
- Public marketing site (StoryBrand landing pages, cinematic/classic heroes, Healthy Home Resources, Caribbean Connection, News via RSS).
- Source-tracked consultation funnel (modal + /contact), built-in calendar booking, lead notifications.
- Admin: Dashboard, Leads (table + Kanban DnD), **Project Pipeline** (lead → project on signed agreement; configurable phases/stages), Calendar, Form Builder, CMS (pages/services/posts/testimonials/team/media/settings), Hero Editor, Etsy products, RSS, Caribbean Connection moderation, Social.
- Roles: Owner, Editor, Sales, Social manager.

## About the Design Files
Everything in `design/` is a **design reference built in HTML** (Design Component prototypes), not production code. Recreate these screens in the target stack **pixel-faithfully** — same layout, copy, colors, type, spacing, motion and behavior. The `.dc.html` files contain the full markup (inline styles) and the logic class (sample data, interactions). `services-data.js` and `form-schema.js` are the content/data seeds — port them into the database seed.

Open `design/Roadmap.dc.html` first: it is the in-site build plan (4 phases, data model, roles matrix, stack).

## Fidelity
**High-fidelity.** Reproduce exactly: 1440px design frame (content max-width 1440, 72px gutters), fonts, colors, radii, shadows, copy and interactions. The site must be responsive (fluid below 1440; stack grids at ≤1024 and ≤720) — the prototypes are desktop-only.

## Recommended Stack (user left this to us)
- **Next.js 15 (App Router, TypeScript) + Tailwind** for the public site and admin.
- **Supabase**: Postgres, Auth (email + magic link), Storage (media, PDFs), Row-Level Security by role.
- **Vercel** hosting on **graceindesign.net** (keep domain). Keep Etsy as the storefront (site lists + links only).
- Email **Resend**; SMS **Twilio**; `.ics` generated server-side; cron (Vercel Cron or Supabase) for reminders, RSS and Etsy sync.
- Social APIs (Phase 3): Meta Graph (FB + IG), LinkedIn, Pinterest, YouTube Data. Phase 4: Stripe, e-sign (Dropbox Sign/DocuSign), HubSpot sync.
- Public pages render from the database (block-based `page_blocks`) so the CMS is real.

## Design Tokens
Colors: navy `#1a2238` (primary/ink), sky `#6cb6e6` (accent), link blue `#3f9ad9`, body `#4b5569`, muted `#6b7486`, faint `#8c95a8`, border `#e9ecf1` / `#e3e6ec` / `#eef0f4`, surface `#f7f8fa` / `#f2f4f7`, light-blue tint `#e6f3fc` / `#f2f8fd`, white `#fff`. Status: success `#1f9d55`/`#dcefe4`/`#1f6b3f`, warning `#fff4d6`/`#7a5a00`, danger `#e0532f`, star `#f0a500`.
Type: **Montserrat** 400/500/600/700 (UI, body); **Cormorant Garamond** 400/500/600 (+italic) for display. Scale: h1 62–76px (line-height 1.02–1.05), h2 44–50px (1.1), h3 24–34px, body 15–18px (1.65–1.75), small 12–13px, eyebrow 11–12px 600 letter-spacing .16–.18em uppercase.
Radii: pills 999px, cards 14–18px, hero band 24px, inputs 10px. Shadows: card hover `0 24px 50px rgba(26,34,56,.10)`, page frame `0 30px 80px rgba(26,34,56,.18)`, CTA glow `0 12px 30px rgba(108,182,230,.35)`.
Spacing: section padding 96–112px vertical / 72px horizontal; grid gaps 24–32px; nav height 124px + 44px utility bar.

## Global Chrome (SiteNav.dc.html, SiteFooter.dc.html)
- **Utility bar** (navy, 44px): phone `(770) 691-1600`, email `support@graceindesign.net`, dynamic page label (home shows “Certified Aging-in-Place Specialists”), right-bleeding sky tab **Schedule a Consultation** → opens the consultation modal with `source_page` = current page key.
- **Header** (white, 124px, 72px gutters): logo `assets/logo-dark-transparent.png` at 60px tall, left; menu right: Home · About · Services ▾ · Healthy Home Resources ▾ · Caribbean Connection · News & Insights. Active item: navy text + 2px sky underline. Dropdowns open on hover, flush under trigger, 12px radius, shadow, pointer notch.
  - Services ▾: Residential Interior Design (nested: Design Refresh, Model Home Design) · Aging-In-Place & Home Assessments (nested: Virtual Home Assessments) · Commercial Interior Design · Project Management · View all services.
  - Healthy Home Resources ▾: AIP Products · WELLness Resources · Home Health Series · AIP Partners.
- **Footer** (navy): white wordmark `assets/logo-white-on-dark.png` (34px), blurb, social icon circles (FB, IG, LinkedIn, Pinterest, YouTube — admin-managed), columns Company / Healthy Home Resources / Contact, legal row (+ Admin login, Build roadmap in demo).

## Screens
Each is a `.dc.html` in `design/`. Copy and sample data live in the file; port verbatim.

1. **Homepage** — hero with admin-switchable style (Classic split hero vs Cinematic full-bleed rotating scenes: Residential/Commercial/Aging-in-Place/Design Refresh; 5s per scene, Ken Burns zoom, crossfade 1.1s, highlighted italic word + progress underline, right-rail scene list with progress bars, hover selects). 3-step strip; 7 service cards (4+3 grid) with “Learn More”; “Why Grace In Design” navy band with founder chip + 4 process cards; Featured products (Etsy-style, 4); News (3); CTA band; footer. Floating **Admin preview** pill toggles Classic/Cinematic (only visible to logged-in admins in production; persists per page).
2. **About** — hero (Founded 2008… + credential chips), “About Grace In Design” + 4 practice areas (Interior Design · Residential & Commercial; Aging In Place · Home assessments; Healthy Home Resources · WELLness focused resources; Project Management · Planning through delivery), founder card (B&W headshot `assets/grace-headshot-bw.jpg`, uncropped, 220px wide), quote, bio, Education/Credentials cards. Copy is final — use verbatim.
3. **Services index** — cinematic hero; 4 top-level rows (alternating image/text) with nested links on Residential (Design Refresh, Model Home Design) and Aging-in-Place (Virtual Home Assessments).
4. **Service landing** (`Service.dc.html`, one template, data from `services-data.js`, slugs: general, residential, design-refresh, model-home, aging-in-place, virtual-assessment, commercial, project-management, aip-partners) — StoryBrand order: Hero (Classic/Cinematic) → Problem/empathy/authority → Before/After drag slider (where `BEFORE_AFTER` exists) → Features grid → optional Tiers (model-home, virtual-assessment) + Approach strip (model-home) → Plan (3 steps) → Success vs failure → Lead form (shared base + per-path extras marked ●, source stamped) → related links. Model Home copy from the flyer (tiers Market Ready / Essential / Premium Model Home; approach Align→Design→Source→Install→Support; CTA “Schedule a 15-Minute Developer Consultation”).
5. **Healthy Home Resources hub** + **AIP Products** (filterable Etsy grid + auto/arrow carousel), **WELLness Resources** (WELL concept groups + carousel + lead magnet), **Home Health Series** (featured episode + carousel). Scroll-reveal on cards.
6. **Caribbean Connection** — hero, “Why this exists” (Jamaica launch + country roll-out chips), 4 pillars, Blog (GID posts + regional RSS column), Resource Directory (filterable) + **Suggest a resource / list my organization** form, Events + **Submit an event** form, Newsletter signup (segment + location). Submissions go to admin as Pending.
7. **News & Insights** — RSS-driven grid (featured + 6), category/date, feed image fallback.
8. **Contact / Consultation** (`Contact.dc.html` + `ConsultForm.dc.html`) — 5-step wizard (About you → Your project → Contact → Pick a time → Confirm) or single-page (admin picks default; user can toggle in demo). Path inferred from `source_page` via `PAGE_TO_PATH`, pre-selected and confirmed. 7 paths: residential, design-refresh, aging-in-place, virtual-assessment, commercial, model-home, project-management. Base fields + path fields from `form-schema.js`. Built-in time picker over admin availability blocks; 15-min discovery call. Confirmation: email + SMS + .ics + pre-consult checklist PDF; 24h reminder.
9. **Admin** (`Admin.dc.html`) — left nav: Dashboard, Leads (badge), Project Pipeline, Calendar, Form builder, Content (CMS), Hero editor, Etsy products, RSS feeds, Caribbean Connection (badge), Social media. Logo centered in sidebar (30px). See “Admin behavior” below.
10. **Roadmap** (`Roadmap.dc.html`) — phases, funnel, data model, roles, stack, open items. Keep as an internal page or drop; content is the spec.

## Interactions & Behavior (must work)
- Hero cinematic: autoplay with pause when tab hidden; clicking/hovering a scene jumps and resets progress; respects `prefers-reduced-motion` (static first scene).
- Before/After: pointer drag with capture, clamped 3–97%.
- Carousels: auto-advance 4s, pause on hover, prev/next, dots, visible-count by width.
- Dropdowns: hover on desktop, tap on mobile; keyboard accessible.
- Consultation modal: focus trap, ESC closes, scroll lock; success state links to booking details.
- Forms: HTML5 + server validation; required marked with red `*`; consent required; honeypot + rate limit; UTM capture.
- Leads board & Project board: HTML5 drag-and-drop between columns (highlight target), persists stage, logs activity “Moved to X (drag & drop)”; click opens drawer (ignore click immediately after a drag).
- Lead drawer “Mark signed → create project”: sets lead stage Won, creates project at first stage of first phase, copies answers/notes/documents, optional deposit invoice + welcome email (rules configurable).
- Project Pipeline “Configure stages”: add/rename/reorder/remove phases & stages; per-stage automation (none / request deposit / send invoice / client approval / schedule install / request review); project fields toggles; conversion rules. Board reflects changes immediately; stages with projects can’t be deleted without reassigning.
- Caribbean moderation: Pending → Approve (publish + email submitter) / Reject (reason emailed) / Unpublish / Restore. Country on/off switches gate what shows publicly.
- CMS publish: draft → preview → publish, per-page SEO; hero editor writes scenes/photos/style per page.

## Data Model (Supabase/Postgres) — see Roadmap for fields
`users(role)`, `leads`, `lead_activity`, `bookings`, `availability_blocks`, `paths`, `form_fields`, `projects`, `project_phases`, `project_stages`, `invoices`, `milestones`, `documents`, `pages`, `page_blocks`, `services`, `posts`, `rss_sources`, `products`, `testimonials`, `media`, `cc_resources`, `cc_events`, `cc_subscribers`, `cc_sources`, `social_accounts`, `social_posts`, `integrations`, `site_settings`. Enums: lead stage (New, Contacted, Consultation booked, Proposal sent, Won, Lost, Nurture); moderation status (pending, published, rejected); invoice status (pending, scheduled, paid). RLS: Owner all; Editor CMS tables; Sales leads/bookings/projects; Social manager social/posts/media.

## Phases (build in this order; each ships)
1. Site + consultation funnel + leads + Project Pipeline + calendar + form builder + hero editor + notifications + auth/roles.
2. CMS (pages/blocks, services, posts + RSS, testimonials, team, media, settings, Etsy), Caribbean Connection admin (moderation, sources, countries, newsletter).
3. Social (connect networks, compose/schedule, auto-share posts, on-site IG feed, analytics).
4. Follow-up ops (email drips, SMS, proposals + e-sign, Stripe invoicing, client portal, HubSpot sync).

## Assets
`design/assets/`: `logo-dark-transparent.png` (nav), `logo-white-on-dark.png` (footer/admin), `gid-circle.png`, `gid-square-navy.png`, `grace-headshot.jpg`, `grace-headshot-bw.jpg` (use B&W), brand photos (`couple-*.jpg`, `aip-*.png`, `com-meeting-1.png`, `pm-site-*.png`, `studio-team.png`). Other photos are `img.magnific.com` stock placeholders — replace with licensed/project photography; keep aspect ratios. `GID Model Home Flyer Final.pdf` is the Model Home copy source.

## Open Items (confirm with Grace)
Model Home tier pricing and a developer testimonial; business street address; official reversed (white) logo file; project photography; blog RSS URL(s); Etsy shop URL; social account access; newsletter ESP choice.

## Files
`design/*.dc.html` (screens + shared SiteNav/SiteFooter/ConsultForm), `design/services-data.js`, `design/form-schema.js`, `design/support.js` + `design/image-slot.js` (prototype runtime only — do not port), `design/assets/`, `design/GID Model Home Flyer Final.pdf`.
