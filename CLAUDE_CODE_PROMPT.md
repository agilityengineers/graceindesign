# Claude Code — Build Prompt: Grace In Design

You are building the production website, consultation funnel, admin/CMS and project pipeline for **Grace In Design Services, LLC** (Atlanta interior design, aging-in-place, project management).

## Start here
1. Read `design_handoff_grace_in_design/README.md` in full. It is the spec: stack, tokens, every screen, interactions, data model, roles, phases, assets, open items.
2. Open `design_handoff_grace_in_design/design/Roadmap.dc.html` — the in-site build plan (4 phases, data model with fields, roles matrix).
3. Review `design_handoff_grace_in_design/screenshots/` for the intended look of every screen (homepage, about, services, 3 service-landing variants, healthy-home-resources, caribbean-connection, consultation-form, 6 admin tabs, roadmap).
4. Treat every `design/*.dc.html` as the **source of truth** for layout, copy, colors, type, spacing and behavior. These are HTML design references, not production code — recreate them pixel-faithfully in the stack below. `services-data.js` and `form-schema.js` are the content seeds; port them into database seeds verbatim.

## Stack (decided)
Next.js 15 App Router + TypeScript + Tailwind · Supabase (Postgres, Auth, Storage, RLS) · Vercel on **graceindesign.net** · Resend (email) · Twilio (SMS) · server-generated `.ics` · cron for reminders, RSS and Etsy sync · Etsy stays the storefront (list + link only). Phase 3: Meta Graph, LinkedIn, Pinterest, YouTube APIs. Phase 4: Stripe, e-sign, HubSpot sync.

## Non-negotiables
- Match the designs **100%**: 1440px frame with 72px gutters, Montserrat + Cormorant Garamond, navy `#1a2238` / sky `#6cb6e6` palette, pill buttons, card radii/shadows, section rhythm, all copy verbatim (About page and Model Home copy are final).
- Responsive below 1440 (stack grids at ≤1024 and ≤720); prototypes are desktop-only, extend sensibly.
- Everything in the README's **Interactions & Behavior** section must actually work: cinematic/classic hero switch (admin-controlled, per page), rotating scenes, before/after slider, carousels, hover dropdowns, consultation modal + /contact wizard with path inference and built-in booking, drag-and-drop Leads and Project boards, lead → project conversion on "Mark signed", configurable project phases/stages, Caribbean Connection moderation queues, CMS publish flow, hero editor, form builder.
- Public pages render from the database (block-based `page_blocks`) so the CMS is real.
- Roles enforced with RLS: Owner, Editor, Sales, Social manager.
- Build in phase order (1 → 4); each phase ships working. Phase 1 first: site + consultation funnel + leads + Project Pipeline + calendar + form builder + hero editor + notifications + auth.

## Images — fill the gaps
Most interior/lifestyle photos in the prototypes are stock placeholders from `img.magnific.com`; some render blank in the screenshots. **Do not leave gaps and do not block on image questions.** The Magnific app (https://www.magnific.com/app) is connected to this project — use it to search or generate photography that matches each slot's subject and aspect ratio (e.g., Caribbean/Jamaican homes and older adults for Caribbean Connection; model-home interiors for Model Home Design; accessible bathrooms/kitchens for Aging-in-Place; offices/clinics for Commercial). Store chosen images in Supabase Storage and register them in the `media` table so the admin can swap them later. Keep the real brand assets in `design/assets/` (logos, Grace's B&W headshot, couple and team photos) exactly where the designs use them.

## When something is unspecified
Make the choice the designs imply, note it in a `DECISIONS.md`, and keep going. Only stop for the README's **Open Items** (Model Home pricing, street address, official reversed logo, RSS/Etsy URLs, social credentials) — stub those with clearly labeled placeholders the admin can edit.

## Deliverables per phase
- Running app on a Vercel preview URL, seeded with the prototype data.
- Supabase migrations + seed scripts.
- `DECISIONS.md` and a short CHANGELOG.
- A side-by-side checklist mapping each `design/*.dc.html` screen to its implemented route, with any intentional deviations called out.
