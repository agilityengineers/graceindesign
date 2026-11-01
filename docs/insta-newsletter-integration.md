# Newsletter review and Insta-Newsletter integration plan

*Written 2026-10-31 from a read of both repositories (`agilityengineers/graceindesign` at `61ac172`, `agilityengineers/InstaNewsletter` at `d2a2582`). No code was changed in either repository as part of this review. The live site at insta-newsletter.com could not be reached from the review environment, so every statement about Insta-Newsletter describes the code in the repository, not the deployment.*

Think of the two systems as two buildings on the same street. Grace In Design's website has a **mailbox at the front door** where visitors drop their address, and a small **back room** where those addresses are kept and the occasional plain-text letter is mailed out. Insta-Newsletter is a **print shop and post office**: it is built to design, schedule and deliver newsletters and to keep the subscriber list healthy. Today nothing connects the mailbox to the print shop. The integration is a courier that carries each new address from the first building to the right account in the second, every time, automatically.

---

## 1. How the newsletter works on the website today

### 1.1 Two lists, two forms

The site keeps **two separate subscriber tables** in its own Postgres database (`src/lib/db/schema.ts`), each fed by one public form.

| List | Table | Where people sign up | What is captured | What happens on sign-up |
| --- | --- | --- | --- | --- |
| Caribbean Connection newsletter | `cc_subscribers` | The `cc_newsletter` block on `/caribbean-connection` (`NewsletterForm` in `src/components/site/CaribbeanForms.tsx`) posting to `POST /api/caribbean/subscribe` | email (unique), `segment` (one of four "I am…" choices), `location` (free text), `country` (derived: Jamaica / Diaspora / null), `consentedAt`, `unsubscribedAt` | Upsert on email (a returning address is re-subscribed and its segment updated). Plain-text welcome email from `newsletter@`. Slack and support-inbox notice through `notifyTeam`. |
| Healthy Home list | `newsletter_subscribers` | The `LeadMagnetForm` on the WELLness resources page posting to `POST /api/newsletter/checklist` | email (unique), `source` (`wellness-checklist`), `consentedAt`, `unsubscribedAt` | Insert-if-absent. Emails the Healthy Home Walk-Through PDF from `newsletter@`. Slack notice. |

Both routes share the same protections: a Zod schema, a DB-backed fixed-window rate limit per IP (10 per hour for subscribe, 5 per hour for the checklist, `src/lib/server/rate-limit.ts`) and a `website` honeypot field that is silently swallowed. Neither form asks for a name. Neither does double opt-in: the Caribbean form carries consent wording under the button, and the row is live the moment it is written.

The domain logic for both lives in `src/lib/server/caribbean.ts` (`subscribeCaribbean`, `sendChecklistLead`).

### 1.2 Unsubscribe

`/unsubscribe?e=<email>` (`src/app/(site)/unsubscribe/page.tsx`) is a server action that stamps `unsubscribedAt` on **both** tables for that address and redirects to a confirmation. It is `noindex`. The link is included in the welcome email and in every issue footer.

### 1.3 Sending an issue

Admin → Caribbean Connection → *Newsletter subscribers* has a **Compose issue** card (`composeIssue` in `src/lib/actions/catalog.ts`). It takes a subject, a plain-text body and an optional segment, and queues one `outbox` row per active Caribbean subscriber (`relatedType: "cc_issue"`), which the `outbox` cron job delivers through SendGrid from `newsletter@`. There is a "send a test to me" switch. The Healthy Home list has no compose at all; it is a lead-capture list only.

### 1.4 Admin and export

The same tab lists the most recent 500 Caribbean subscribers with segment counts, per-row unsubscribe / re-subscribe / delete, and a CSV export (`/api/admin/export?kind=cc-subscribers`). A second card lists Healthy Home subscribers with delete and its own export (`?kind=newsletter`). Sign-ups also appear in the team's Slack channel when *Form builder → Notifications → Slack on other forms* is on.

### 1.5 Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `SENDGRID_API_KEY` | Replit Secrets | Without it mail is written to `outbox` with status `logged`. |
| `EMAIL_FROM_NEWSLETTER` | Replit Secrets | Defaults to `Grace In Design <newsletter@graceindesign.net>` (`src/lib/email-senders.ts`). One of four verified senders. |
| `notifications.slackOnOtherForms`, `adminEmail` | Admin → Form builder → Notifications (`site_settings`) | Where sign-up notices go. |
| `SLACK_WEBHOOK_URL` | Replit Secrets | |

There is **no email service provider in the picture**. `DECISIONS.md` records the launch-time decision as "newsletter ESP → the built-in outbox", and `docs/handoff/README.md` still lists "newsletter ESP choice" as an open item. Insta-Newsletter is the answer to that open item.

### 1.6 Findings about the current setup

These stand on their own, whether or not the integration goes ahead.

1. **Unsubscribe is by bare email with no proof of ownership.** Anyone who knows an address can open `/unsubscribe?e=that@address` and press the button. It is a form post, so mail scanners will not trigger it, but it is still unauthenticated. Insta-Newsletter's equivalent (`/unsubscribe/:contactId`) uses an unguessable id. If Insta-Newsletter becomes the sender, this page should forward the request (see §5.2) or be replaced by Insta-Newsletter's preferences page.
2. **Unsubscribing from one list unsubscribes both.** The page ignores the `list=cc` parameter that `composeIssue` appends and clears both tables. Intentional as a conservative choice, but worth knowing.
3. **Issues are plain text only.** No template, no images, no open or click tracking, no scheduling, no public archive, no "view in browser". This is exactly the ground Insta-Newsletter covers.
4. **No outbound event for a new subscriber.** The site's HMAC-signed webhook dispatcher (`src/lib/server/webhooks.ts`, Admin → Client ops → Webhooks) fires `lead.*`, `booking.*`, `project.*`, `invoice.paid`, `proposal.signed` and `cc.submission.*`, but nothing when someone subscribes. This is the one small code change the website needs (see §5.2).
5. **Consent is recorded but not confirmed.** `consentedAt` is stamped at submit time. There is no double opt-in. Insta-Newsletter can supply one if you want it.
6. **Two tables with one shape.** `cc_subscribers` and `newsletter_subscribers` differ only in which extra columns they carry. Not a problem, and not something the integration needs changed.
7. **The consultation form has no newsletter opt-in.** Leads and subscribers are disjoint populations. A future nicety, out of scope here.

---

## 2. What Insta-Newsletter offers today (the parts that matter here)

**Accounts.** An "account" is a row in `users` (`shared/schema.ts`). Every contact, audience, campaign and newsletter carries an `ownerId` pointing at it, and a send only ever reaches the campaign owner's own contacts. Elevated roles (admin, partner, client advisor) work *in* another account through the header's working-account switcher; `resolveTargetOwner` (`server/ownerFilter.ts`) is how routes honour that. The Grace In Design account is simply one `users` row, and "tied to the account level" means "every write names that row's id".

**Contacts and audiences.** `contacts` is unique on (`ownerId`, `email`) and carries `firstName`, `lastName`, `status` (`active | unsubscribed | bounced`), `source` (one of `manual | import | signup | invite | send`), `consentAt`, `consentIp`, free-form `tags` and `customFields` (JSONB, usable as personalization tokens) and a persona `segment`. Audiences are `contact_lists` (many-to-many through `contact_list_members`, unique on the pair), and a list can be marked `isPublic` so readers can join or leave it from the preferences page. Campaigns target audiences.

**Audience growth (migration `0010_audience_signup`).** Each account can switch on a hosted signup page at `/join/<handle>` (Contacts → *Grow your audience*). It offers the public audiences, carries a honeypot and a signed-timestamp trap, is rate limited, caps at 200 sign-ups per account per rolling day, and by default does **double opt-in**: the post writes a `signup_requests` row and emails a confirmation link; the contact row is created only when the person clicks *Yes, subscribe me*, with `source: 'signup'`, `consentAt` and `consentIp` stamped. With double opt-in off the same code path writes the contact at once. Unconfirmed requests do not count against the plan's contact cap.

**Authentication, and why the website cannot simply call `/api/contacts`.** The API is built for a person at a browser: a 15-minute JWT access token (cookie or bearer) refreshed by a 30-day rotating cookie, a double-submit CSRF cookie on everything under `/api`, and CORS locked to `APP_URL` / `ALLOWED_ORIGINS` in production. There is **no concept of an API key or a long-lived machine credential** for an account. The only third-party secrets stored are the account's own SendGrid and NeverBounce keys (AES-256-GCM via `ENCRYPTION_KEY`). So a browser on graceindesign.net cannot post to Insta-Newsletter's API (CORS and CSRF), and the website's server cannot either without logging in as a person every fifteen minutes.

**Public pages outside `/api`** (CSRF-exempt by construction, registered ahead of the SPA fallback): `/join/*`, `/unsubscribe/:contactId`, `/preferences/:contactId`, `/n/:slug` (a newsletter's live web page), `/e/:sendId` (a sent issue, frozen) and `/webhooks/sendgrid`. Helmet's default frame guard means `/join` cannot be embedded in an iframe on another site.

**Prior art.** `docs/archive/GID_GAP_ANALYSIS.md` (March 2026, now archived) assessed this exact client and listed "Website signup form / embed widget" and "no webhook endpoint for external forms to push contacts" as HIGH gaps. The hosted signup page has since closed the first half. The second half, a server-to-server door, is still open. `PRODUCT_REVIEW_2026-09.md` adds a product-level caution for Phase 3: "A public API only if it stays on the pricing page." The design below is deliberately *not* a public API; it is a narrow, per-account inbound credential, the same shape as the signup page.

**Guardrails any Insta-Newsletter change must pass** (from `CLAUDE.md`):

- `npm run check` and `npm test` (vitest, three projects) are the CI gate on every `claude/**` branch and pull request.
- `server/route-guards.test.ts` scans a fixed list of route files. A new route file must be added to that list; a public token-scoped route goes on its `PUBLIC` allowlist; a state-changing `/api` route needs `authenticate` plus `requireVerifiedEmail` and `requireActiveAccount` where it creates on the account's behalf.
- Any `shared/schema.ts` change needs `npm run db:generate -- --name <change>` committed (the CI schema-drift step), and `server/migrations-down.test.ts` requires a `migrations/down/<tag>.sql` beside every forward migration from `0010` on.
- Secrets are stored hashed (SHA-256, as refresh and signup tokens are) or encrypted (`encryptValue`), never plain.
- Public handlers outside `/api` wrap their whole body in try/catch (the global error handler answers JSON).

---

## 3. The gap in one sentence

Insta-Newsletter has a door for people (the hosted signup page) and a door for the account owner at a browser (the API), but **no door a trusted server can walk through to add a subscriber to one specific account**.

---

## 4. Options considered

| | What Insta-Newsletter needs | What the website needs | Verdict |
| --- | --- | --- | --- |
| **A. Replace the website form with a link to `/join/<handle>`** | Nothing | Swap `NewsletterForm` for a link | Works today, but loses the segment and location questions, sends visitors off-brand and off-site, and the page cannot be iframed. A fallback, not an integration. |
| **B. The website's server posts to the `/join/<handle>` form** | Nothing | Fetch the page, scrape the signed trap token, wait three seconds, post form-encoded fields, parse an HTML answer that deliberately does not say whether the address was new | Brittle by design: it defeats the bot trap the page exists for, it is capped at 200 a day, and the website cannot tell success from "already subscribed". Not recommended. |
| **C. The website's server calls `POST /api/contacts`** | Nothing | Log in as a person, keep a 15-minute JWT and CSRF cookie alive | Not viable for a server; `ownerId` in the body is also exactly the kind of cross-account write the route guards exist to police. |
| **D. Insta-Newsletter polls a subscriber feed on the website** | A per-account poller, stored URL and secret, a signed feed on the website | A signed `GET` feed | More moving parts, poll lag, and the pull direction is the wrong way round for a form that fires one event at a time. Not recommended. |
| **E. Account-scoped inbound signup webhook on Insta-Newsletter, fed by the website's existing outbound webhook dispatcher** | One small additive feature (§5.1) | Two new event names and four `emitEvent` calls (§5.2); the subscription itself is configured in the admin, not in code | **Recommended.** Each side uses the mechanism it already has. The credential is cut for one account and one purpose. |

---

## 5. Recommended design: a website signup source for the account

The analogy is a **key cut for one door**. Insta-Newsletter lets the Grace In Design account mint a signing secret that opens exactly one door: "add a subscriber to *my* audiences". The website keeps that secret and signs every sign-up it sends. Nothing else is reachable with it, and revoking it closes the door without touching anything else.

### 5.1 On Insta-Newsletter

This is the change that has to be understood and agreed before it is made. It is additive: no existing table, route or behaviour changes.

**Data.** A new table, `signup_sources`:

| Column | Purpose |
| --- | --- |
| `id` | uuid |
| `ownerId` → `users.id` (cascade) | The account the key belongs to. **This is the account-level tie.** |
| `name` | "Grace In Design website" |
| `secretHash` | SHA-256 of the signing secret; plaintext shown once at creation |
| `secretPrefix` | First 8 characters, for display |
| `defaultListIds` (jsonb) | Audiences a sign-up joins when the payload names none that match |
| `listRouting` (jsonb, optional) | `{ "<key the website sends>": [listIds] }`, e.g. `caribbean-connection` → *Caribbean Connection*, `healthy-home` → *Healthy Home* |
| `doubleOptIn` (boolean) | Whether a sign-up from this source must confirm by email first |
| `createdBy`, `createdAt`, `lastUsedAt`, `revokedAt` | Audit and revocation |

Vocabulary changes in `shared/signupPage.ts`: add `'website'` to `CONTACT_SOURCES` (label "Signed up on your website") and to `SIGNUP_SOURCES`. The contact insert schema already restricts `source` to that enum, so this is the only place to add it.

Migration: `npm run db:generate -- --name signup_sources` plus `migrations/down/0018_signup_sources.sql`.

**Routes.** A new file `server/routes/signupSources.ts`, added to the scan list in `server/route-guards.test.ts`.

Owner side, under `/api`, guarded like the signup page routes (`authenticate`, `requireVerifiedEmail`, `requireActiveAccount`, `resolveTargetOwner` so an admin working in the account can set it up on Grace's behalf):

- `GET /api/signup-sources` — list the account's sources (never the secret)
- `POST /api/signup-sources` — mint one; the response carries the plaintext secret once and the endpoint URL
- `PUT /api/signup-sources/:id` — rename, change audiences or double opt-in
- `POST /api/signup-sources/:id/rotate` — new secret
- `DELETE /api/signup-sources/:id` — revoke

Inbound, **outside `/api`** (so it is CSRF-exempt by construction, like `/join` and `/webhooks/sendgrid`), rate limited with `signupRateLimiter`:

```
POST /hooks/signup/:sourceId
Content-Type: application/json
X-Signature: sha256=<hex HMAC-SHA256 of the raw request body, keyed by the source secret>

{ "event": "newsletter.subscribed" | "newsletter.unsubscribed" | "ping",
  "sentAt": "2026-10-31T19:00:00Z",
  "data": {
    "email": "someone@example.com",
    "firstName": null, "lastName": null,
    "list": "caribbean-connection",
    "tags": ["caribbean-connection", "Living in Jamaica"],
    "customFields": { "segment": "Living in Jamaica", "location": "Kingston, Jamaica", "country": "Jamaica" },
    "consent": { "at": "2026-10-31T19:00:00Z", "ip": "203.0.113.5", "page": "https://graceindesign.net/caribbean-connection" }
  } }
```

That envelope is the one the website's dispatcher already sends (`{ event, sentAt, data }`); the website only has to add the `X-Signature` header beside its existing `X-GID-Signature` (or the receiver can read either header; §5.2 notes the one-line choice).

**Behaviour of the receiver**, in order:

1. Load the source by `:sourceId`; 404 if missing or revoked. Load the owner; 404 unless `status === 'active'`.
2. Verify the signature over `req.rawBody` (already captured by `express.json` for the Stripe webhook) with a constant-time compare. 401 on mismatch. Everything before this point must not reveal whether the source exists beyond the 404.
3. Enforce the account's daily cap (`SIGNUP_DAILY_CAP_PER_OWNER`, counting website sign-ups alongside page sign-ups) and the plan's contact allowance (`resolveContactAllowance`); answer `{ status: 'capped' }` or `{ status: 'limit' }` with 200 so the sender does not retry forever, and audit it.
4. `ping` → 200 `{ ok: true }`.
5. `newsletter.subscribed`:
   - validate and lowercase the email;
   - resolve audiences: `listRouting[data.list]` if present, else `defaultListIds`, always restricted to lists the owner actually owns;
   - if `doubleOptIn` is on, run the same path as `requestSignup` with `source: 'website'` (a `signup_requests` row and a confirmation email; the contact appears on confirmation); answer `{ status: 'confirmation_sent' }`;
   - otherwise write the contact through `storage.createContact` (idempotent on owner + email), with `status: 'active'`, `source: 'website'`, `consentAt` and `consentIp` **as reported by the integration** and `tags` / `customFields` merged; if the address exists and is unsubscribed, leave it unsubscribed and answer `{ status: 'suppressed' }` (the website's re-subscribe is not a reader's own click); otherwise answer `{ status: 'created' | 'already', contactId }`;
   - add to the resolved lists (unique index makes retries harmless).
6. `newsletter.unsubscribed`: find the contact by owner and email; `unsubscribeContactById`; 200 either way.
7. `logAction(null, 'signup.website', 'contact', …, { ownerId, sourceId })` on every write; bump `lastUsedAt`.

Unlike the public page, this endpoint may say `already`: the caller is the account's own system, not an anonymous visitor.

**UI.** A fourth tab in the Contacts page's *Grow your audience* panel (`client/src/components/contacts/GrowAudienceSheet.tsx`), "Website", listing sources, with *New source* (name, default audiences, routing rows, double opt-in switch), the endpoint URL and the secret shown once, and *Rotate* / *Revoke*. Nothing else in the client changes.

**Tests.** A routes test in the style of `server/signup.routes.test.ts` (signature accepted and rejected, revoked source, inactive owner, cap, limit, idempotent repeat, unsubscribe, double opt-in path), a unit test for the signature helper, and the route-guards scan list entry.

**What this is not.** Not a public API: no reads, no listing, no campaign or newsletter access, no pricing-page promise. One secret opens one account's subscribe door. A leaked secret can add addresses to Grace's own list and spend her own daily cap, which rotation and revocation fix; it cannot reach any other account.

**Size.** Roughly one to two days of focused work including tests and the panel tab.

### 5.2 On the website

The website already has the courier; it only needs to be told to carry subscribers too.

1. **Two new events** in `GID_EVENTS` (`src/lib/server/webhooks.ts`): `newsletter.subscribed` and `newsletter.unsubscribed`. They appear automatically as checkboxes in Admin → Client ops → Webhooks.
2. **Emit them** from `subscribeCaribbean` and `sendChecklistLead` (`src/lib/server/caribbean.ts`), from the `/unsubscribe` server action, and from the admin `subscriberAction` unsubscribe / re-subscribe / delete. The payload is the envelope in §5.1 with `list` set to `caribbean-connection` or `healthy-home`. Pass the visitor IP into `subscribeCaribbean` from the route so it can travel in `consent.ip`.
3. **One header.** Either the website's `deliver()` adds `X-Signature` beside `X-GID-Signature` (one line), or Insta-Newsletter's receiver accepts `X-GID-Signature` as an alias. Adding the generic header on the website is the cleaner choice and keeps Call Flow Tracker untouched.
4. **No new admin UI.** The subscription is created in Admin → Client ops → Webhooks: paste the Insta-Newsletter endpoint URL, tick the two events, and copy the signing secret the website shows once into the Insta-Newsletter source (or the other way round; one side generates, the other pastes). *Send ping* tests it. Retries with backoff, delivery history, pause and resume all come for free from `webhook_deliveries` and the `webhooks` cron job.
5. **Optional.** Add an `insta_newsletter` row to the integrations registry (`D.INTEGRATIONS` in the seed and `liveStatus` in `src/lib/actions/settings.ts`) so the Site settings → Integrations card shows it as connected when a subscription targeting Insta-Newsletter is active.

Roughly half a day including a test alongside `tests/email-senders.test.ts`.

### 5.3 Who owns what after cutover

| Responsibility | Today | After |
| --- | --- | --- |
| Capturing sign-ups, segment, location, consent | Website | Website (unchanged) |
| Welcome email and Healthy Home PDF | Website | Website, unless double opt-in is chosen, in which case Insta-Newsletter's confirmation becomes the welcome and the website's welcome should be switched off to avoid two emails |
| Subscriber list of record | Website tables | **Insta-Newsletter.** The website tables become the capture log and a mirror |
| Designing, scheduling and sending issues | Compose issue (plain text) | Insta-Newsletter campaigns. Hide or retire *Compose issue* once the first campaign has gone out |
| Unsubscribe | `/unsubscribe?e=` | Insta-Newsletter's footer link (`/unsubscribe/:contactId`, `/preferences/:contactId`). The website page keeps working and forwards the event. A reader who unsubscribes in Insta-Newsletter is not mirrored back to the website; that only matters if the website keeps sending, which it should stop doing |
| Open and click tracking, bounces, archive | None | Insta-Newsletter |

---

## 6. What I need from you in Insta-Newsletter

None of this blocks the code change; it is what the cutover needs.

1. **Which account is Grace In Design's** (the login email), and whether it is on Free, Starter, Professional or Enterprise. The Free plan caps contacts at 500 (`shared/plans.ts`); the current Caribbean and Healthy Home counts come from the two CSV exports, and the backfill plus growth must fit under the cap or the receiver will start answering `limit`.
2. **Two audiences** created in that account: *Caribbean Connection* and *Healthy Home*. Mark them public if you want readers to manage them on the preferences page.
3. **Sending identity.** Either Insta-Newsletter's platform SendGrid key or the account's own key under Settings → SendGrid, with `newsletter@graceindesign.net` as a verified sender, and the CAN-SPAM mailing address on the account. The website's SendGrid account already has that sender verified; the same key, or a restricted one from the same account, can be used.
4. **Platform mail**, only if you choose double opt-in: the confirmation email is sent as platform email, and `PUT /api/signup-page` already refuses double opt-in when it is not configured.
5. **A decision on double opt-in versus single step** (§8).
6. **The two CSV exports** for a one-time backfill through Contacts → Import. The import reads a `status` column and honours `unsubscribed`, so export unsubscribed rows with that value rather than dropping them, and the suppression carries over.

---

## 7. Cutover sequence

1. Ship the Insta-Newsletter change (§5.1) on a `claude/**` branch; CI runs typecheck, tests and the schema-drift check.
2. In Insta-Newsletter: create the two audiences, create the website source (routing `caribbean-connection` and `healthy-home` to them), copy the endpoint URL.
3. Ship the website change (§5.2).
4. In the website admin: Client ops → Webhooks → add the subscription with that URL and the two events; paste the secret across; *Send ping*; watch the delivery land.
5. Backfill: import the two CSVs into the matching audiences.
6. Submit a test sign-up on `/caribbean-connection`; confirm the contact appears in Insta-Newsletter with `source: website`, the right audience, segment and location in custom fields.
7. Send the first issue from Insta-Newsletter to a test list, then to the audiences.
8. Hide *Compose issue* on the website and repoint the welcome email's "unsubscribe anytime" line at Insta-Newsletter's preferences page, or keep the website page as the forwarding door.

---

## 8. Decisions to make

- **Double opt-in or single step for website sign-ups?** Single step keeps today's experience (one welcome email, PDF arrives at once) and treats the website's consent wording and honeypot as sufficient; `consentAt` is then "as reported by the website". Double opt-in gives a cleaner consent record and filters typos and bots, at the cost of a second email and a confirmation click before the Healthy Home PDF can be tied to a contact. Recommendation: single step for launch, with the switch available per source.
- **Does the Healthy Home list flow too?** It is a lead-magnet list rather than a newsletter audience. Routing it to its own audience keeps the choice open.
- **Retire *Compose issue* and the email-only unsubscribe page**, or keep them as a fallback for a quarter?
- **Fix the unauthenticated unsubscribe** (§1.6 item 1) now, or let Insta-Newsletter's tokenised links take over?
- **Confirm the production host and version.** insta-newsletter.com was not reachable from the review environment, so confirm that the deployment runs the repository's `main` and that `APP_URL` is set (the signup and preferences links are built from it).
