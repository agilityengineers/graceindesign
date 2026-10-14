# Notifications setup: SendGrid, Slack, and Call Flow Tracker (texts + auto sign-in)

This is the checklist for switching the notification wiring on in Replit. Picture it as three doors
into the same room: **email** (SendGrid), **Slack** (one webhook), and **text message** (sent through
Call Flow Tracker's Twilio number, carrying a link that signs Grace straight into Call Flow Tracker).
Everything works with nothing configured (messages are logged to Admin → Client ops → Outbox), and
each door opens independently as you add its secret.

## 1. SendGrid: which address sends what

The domain and the four addresses are already verified in SendGrid. The app now picks the sender
per message:

| Sender | Used for |
| --- | --- |
| `noreply@graceindesign.net` | Sign-in links, signed-proposal receipts, internal team notices (new request, schedule install, portal responses). Nothing to reply to. |
| `support@graceindesign.net` | General questions that are not sales: Caribbean Connection directory/event receipts and moderation replies, client portal links, approvals, invoices, welcome-aboard, thank-you notes. |
| `consultation@graceindesign.net` | Anything sales-related: consultation-request confirmations, booking confirmations and 24h reminders, proposals, drip sequences, emails sent to a lead from the admin. |
| `newsletter@graceindesign.net` | Newsletter welcomes, the Healthy Home checklist download, newsletter issues and their test sends. |

Where a **form submission lands** (the inbox the team is notified at):

- Consultation / "Schedule a consultation" forms on every service page → **consultation@** (sales).
- Caribbean Connection directory and event submissions, newsletter and checklist sign-ups → **support@**.
- Those inboxes are editable in Admin → Form builder → Notifications (Sales inbox / Support inbox).

Team notification emails go out from `noreply@` with **Reply-To set to the visitor**, so hitting
Reply answers the person who filled in the form.

**Replit Secrets (graceindesign):**

| Secret | Value |
| --- | --- |
| `SENDGRID_API_KEY` | Your SendGrid API key (Mail Send permission). |
| `EMAIL_FROM_NOREPLY`, `EMAIL_FROM_SUPPORT`, `EMAIL_FROM_CONSULTATION`, `EMAIL_FROM_NEWSLETTER` | Optional. Defaults are already `Grace In Design <addr@graceindesign.net>`; only set them to change the display name. |
| `ADMIN_NOTIFY_EMAIL` / `SALES_NOTIFY_EMAIL` | Optional fallbacks for the two inboxes (defaults: support@ / consultation@). |

In SendGrid, keep **click tracking** off for transactional mail if you can (Settings → Tracking); the
app already disables it per-message on sign-in emails.

## 2. Slack: one Incoming Webhook

1. In Slack: **Apps → Incoming Webhooks → Add to Slack** (or create a Slack app with the Incoming
   Webhooks feature). Pick the channel. A **private channel or a DM-style channel with Grace** is
   recommended, because posts can include her auto sign-in link to Call Flow Tracker.
2. Copy the webhook URL (`https://hooks.slack.com/services/…`).
3. Replit Secret: `SLACK_WEBHOOK_URL=<that URL>`.

What gets posted (each is a toggle in Admin → Form builder → Notifications):

- New consultation requests (name, phone, email, audience, timeline, budget, notes, booked time), with
  **Open in admin** and **Open Call Flow Tracker** buttons.
- Caribbean Connection directory/event submissions, newsletter and checklist sign-ups.
- Calls, leads, dispositions and appointments reported by Call Flow Tracker's webhooks.

## 3. Text messages to Grace through Call Flow Tracker

Call Flow Tracker (CFT) owns the Twilio account and Grace's tracking number, so this app does not
talk to Twilio directly. Instead it signs in to CFT as Grace (server-side, using CFT's
master-dashboard SSO) and uses CFT's own messaging API to send the text **from her tracking number**.
The thread then also appears in CFT → Messages, and any reply she sends from her phone lands there.

**In Call Flow Tracker (its Replit Secrets):**

| Secret | Value |
| --- | --- |
| `MASTER_DASHBOARD_SECRET` | A long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. If CFT already has one (a master dashboard is already connected), reuse the existing value, do not replace it. |
| `BASE_URL` | CFT's public URL (already set if CFT is live). |

Then restart CFT. Its boot log should no longer say `MASTER_DASHBOARD_SECRET not set`.

**In this app (graceindesign Replit Secrets):**

| Secret | Value |
| --- | --- |
| `CFT_URL` | CFT's public URL, e.g. `https://callflowtracker.example.com` (no trailing slash). |
| `CFT_MASTER_DASHBOARD_SECRET` | The exact same value as CFT's `MASTER_DASHBOARD_SECRET`. |
| `CFT_MASTER_APP_ID` | Leave at the default `608c99a8-0a2b-41d7-8930-f2dc3b0fe964` (fixed inside CFT). |
| `CFT_SMS_FROM` | Grace's tracking number in CFT, E.164 (`+1770…`). It must be SMS-capable. |
| `CFT_SMS_SENDER_EMAIL` | Optional. CFT login email of the user who "sends" the text. Leave blank to use the notification user below. |
| `ADMIN_NOTIFY_PHONE` | Optional. Grace's mobile (E.164). The admin setting below overrides it. |

**In the admin (Form builder → Notifications):**

- Tick **Text Grace on a new consultation request** and enter **Grace's mobile**.
- Set **Team member the texts and sign-in links are for** to Grace's **Call Flow Tracker login email**
  (default `info@graceindesign.net`). This email must be an active user in CFT. If her CFT login is a
  different address, put that address here (and, ideally, give her GID account the same email).

**In Call Flow Tracker (one-time, as an admin):**

- Make sure Grace's CFT user is active and may send from the tracking number (she is the campaign
  owner, or an admin). CFT admins can always send from the house account.
- The number must have SMS enabled in Twilio and, for US traffic, be attached to an approved A2P
  10DLC campaign; CFT routes through its Messaging Service automatically when one is registered.

Check it: Admin → Content → Site settings → Integrations → **Re-check** next to Twilio / Call Flow
Tracker, then submit the consultation form on the site. The text should arrive from the tracking
number and show up in CFT → Messages; the outbox row shows provider `cft`.

If `CFT_SMS_FROM` is blank, texts fall back to this app's own `TWILIO_*` secrets; if those are blank
too, texts are logged only.

## 4. The auto sign-in link

Every text (and, if enabled, every Slack post) carries a link like
`<configured-site-origin>/go/cft#token=<credential>`. When Grace taps it:

1. The browser removes the fragment from history and exchanges it in a same-origin JSON POST. This app atomically consumes the link (valid for 20 minutes and one use; revoked if her account
   is deactivated; every tap is audited).
2. It mints a fresh two-minute CFT SSO token for her and redirects to `<CFT_URL>/sso/launch?token=…`.
3. CFT signs her in (matching her by email on the first tap and remembering her afterwards) and lands
   on its dashboard, where she can open Calls / Messages to see who called, listen, and act.

Signed-in team members also get an **Open in Call Flow Tracker** button in each lead's drawer; it
signs them in to *their own* CFT account the same way.

Without `CFT_MASTER_DASHBOARD_SECRET`, the links still work but open CFT's normal login page.

> CFT's `/sso/launch` currently always lands on its dashboard. If you'd like the link to open the
> call log directly, CFT needs a one-line change to honour a `?next=/calls` parameter on that route;
> this app already passes the target hint along internally so nothing here would change.

## 5. Call Flow Tracker → this app (already built; switch on when ready)

- **Call events**: CFT → Settings → Outbound webhooks → add `<BASE_URL>/api/webhooks/cft` for
  `lead.created`, `call.completed`, `disposition.changed`, `appointment.booked`; paste the signing
  secret into `CFT_WEBHOOK_SECRET` here. Events create/update leads and post to Slack.
- **Open this admin from CFT**: CFT → Administration → Connected Apps → add this app with app id
  `5f1d4a8e-8c3b-4b7e-9c2a-7f3a0d6e1b42` and launch URL `<BASE_URL>/api/sso/launch`; paste the secret
  into `CFT_SSO_SECRET` here.

## 6. Deploy notes

- The schema migration `drizzle/0001_notifications.sql` adds `outbox.from_addr`, `outbox.reply_to`
  and the `cft_launch_links` table. The Replit workflow (`npm run db:setup -- --if-empty`) applies it
  in development; for the published deployment run `npm run db:migrate` once, or let Replit's
  publishing step manage the schema as documented in `replit.md`.
- Secrets set in the workspace are not automatically copied to the published deployment: add them
  under **Deployments → Secrets** as well.
- `npm run test:notifications` runs the unit tests for sender routing, the CFT token format and the
  Slack payload.
