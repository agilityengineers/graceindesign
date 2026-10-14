# Launch content patch

The public site is rendered from the database, not from the files in `src/lib/seed-data/`. The seed runs once, on an empty database, and a publish never reseeds. So the content corrections from Grace's pre-launch review (October 13, 2026) have to be applied to the databases that already exist: the Replit workspace (development) database and the production database.

`scripts/launch-content.ts` does that. It is idempotent and conservative:

- Text updates apply only where the current value still equals the prototype value. Anything already edited in the admin is left alone.
- Deletions match only rows the prototype seed created, by their seeded titles, slugs, emails, project codes or tokens.
- Nothing is wiped. Leads, bookings, sessions and directory entries added in the admin are untouched.

## Run it

```bash
# 1. Preview: prints every change, writes nothing
npm run content:launch -- --dry-run

# 2. Apply to the workspace database (DATABASE_URL from the Replit workspace)
npm run content:launch

# 3. Apply to production: Replit → Database → Production → copy the connection string
DATABASE_URL='postgresql://…' npm run content:launch -- --dry-run
DATABASE_URL='postgresql://…' npm run content:launch

# Optional: also remove the sample operations data (see below)
DATABASE_URL='postgresql://…' npm run content:launch -- --ops
```

Running it a second time reports `0 change(s)` for automatic changes. Any `REVIEW REQUIRED` messages remain separate and do not mean the database is fully launch-ready.

### Cleanup safety

Social posts must match the seed body, networks, status and metrics, with no media, links or provider results. Social accounts must match the seed profile and have no credentials, external identity or synchronization history. Subscribers must match the seed identity and profile, including the original bounded padding list; an `@example.com` address alone is never enough. Newsletter subscribers are untouched because the seed did not create them.

Leads, projects, proposals and portal links are now **retained for manual review**, even when their identifiers match the seed. Removing those records could delete real linked activity or signed work. The original operations inventory below describes what the prototype planted, not a promise that all of it is automatically deleted. Review demo public links before launch.

## What it changes

| Area | Change |
|---|---|
| Site settings | Placeholder footer address lines cleared; credential casing in the footer blurb and default meta description |
| Services | Aging In Place authority line and plan step 3 (assessment, recommendations, contractor coordination); "hundreds of…" claims removed; Project Management rewritten as owner-side coordination; Commercial hero scene "open office" → "workspace"; Model Home "20+ years" → "25+ years" (matches Grace's bio); model-home testimonial placeholder cleared |
| Pages and blocks | Hero CTA "Get Started — It's Free" → "Book a Free 15-Minute Call"; Project Management card blurb; AIP Products header without admin instructions; News badge; unique meta descriptions; "Aging In Place" casing in prose, "Certified Aging-in-Place Specialist (CAPS)" for the credential |
| Products | Seven invented listings deleted; the Home Readiness Assessment is kept but hidden, with the invented price and review count cleared, until the listing URL and price are confirmed in Admin → Etsy products |
| Caribbean events | All eight prototype events deleted (four named GID as host or partner) |
| Posts | Six invented regional headlines attributed to real publishers deleted; the eleven prototype articles set to draft with the "placeholder" paragraph removed (any that were rewritten in the admin stay published) |
| RSS sources | Faked "last synced" time and item counts cleared where a source never actually synced |
| Testimonials | Three invented quotes deleted (none were shown publicly) |
| Team, form paths, drip sequences | Casing only |

## `--ops`: sample operations data

The prototype also planted operations data that visitors cannot see but that matters at launch:

- Two sample team accounts (`marcus@graceindesign.net`, `dana@graceindesign.net`) that can sign in by magic link if those mailboxes exist. Deactivated, unless the account has actually signed in (then it is reported and left alone).
- Eight sample leads with bookings, seven sample projects with invoices and milestones, two sample proposals and client portal links at fixed public URLs (`/proposal/demo-shah-proposal-v2`, `/portal/demo-shah-portal`). Deleted.
- Social accounts shown as "connected" without credentials, and sample social posts. Deleted.
- 418 sample newsletter subscribers (413 at `@example.com`). Deleted, so the first real "Compose issue" does not bounce.
- Three sample pending directory submissions and one rejected one. Deleted. The nine curated organizations (NCSC, Ministry of Health, PATH, …) are kept for Grace to verify.

## Decisions still open for Grace

The script applies sensible defaults; each of these is a one-field edit in the admin if she decides differently.

1. Free 15-minute consultation: the hero now says "Book a Free 15-Minute Call" and the form rail says "Free · No obligation". If the call is not free, change the CTA in Hero editor → Homepage and the rail text in `src/components/site/ConsultForm.tsx`.
2. Footer service-area line: the address fields are empty. Type an approved line (for example "Serving Metro Atlanta") into Site settings → Contact & footer → Address.
3. Products: confirm the Home Readiness Assessment listing URL and price in Admin → Etsy products, press "Refresh from Etsy", then show it. Paste further listing URLs to add them.
4. Events and directory: add genuine events; verify the nine curated directory organizations.
5. Articles: the eleven drafts are topic ideas, not published pieces. Publish only what Grace writes. Confirm the RSS feed URLs in Admin → RSS feeds and Caribbean Connection → Sources, then "Sync now" each one.
6. Home Health Series episodes and WELLness guides are prototype content typed into code (`src/lib/seed-data/demo.ts`: `EPISODES`, `WELLNESS_GROUPS`) with no real videos or downloads behind them. Either supply the real episodes and guides or unpublish those two pages in Content → Pages until they exist.
7. Years of experience: the site now says "more than 25 years" (Grace's bio) rather than the prototype's "20+ years"; the firm itself was founded in 2008.
