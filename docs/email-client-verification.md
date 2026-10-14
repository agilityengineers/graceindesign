# Emailed sign-in link compatibility

## Status — 2026-10-13

**SendGrid URL-preservation work verified; broader client interaction testing
remains unverified and is separate follow-up scope.**
The initial development secret-existence check found no `SENDGRID_API_KEY`;
it has since been added according to the workspace notification. The owner has
approved two test recipients and identified support@graceindesign.net as the
intended sender. Both recipients use Google Workspace (described by the owner
as Google Enterprise). Recipient addresses are intentionally not retained here.
One approved Gmail mailbox is now connected. Two non-authenticating test emails
were sent; no live sign-in credentials were created or collected. Client/device
access and corporate rewriting-policy details remain unavailable.
Local browser results in `auth-verification.md` are not email-client evidence.

## Final URL-preservation check

The owner prioritized ensuring SendGrid does not transform any outbound URL
and keeping application links on the main site domain, with custom-domain
attachment deferred until they are satisfied.

The shared outbox delivery path now unconditionally disables both HTML and
plain-text click tracking for every SendGrid email, including retries and
HTML-only content. Previously this override applied only when plain text
matched the sign-in link shape.

A new harmless sample used the verified published origin
`https://graceindesign.replit.app`, with an authentication-shaped canary fragment
and an ordinary contact link with a query parameter. SendGrid accepted it (202);
the connected Gmail Inbox received both exact URLs in plain text and unchanged
explicit HTML anchor targets. No click-tracking wrapper was present. The SDK
sample used the same tracking-policy function as the outbox; it did not create
an outbox record or authenticate a user. Ten focused tests and type checking
passed, and the application restarted successfully.

Application-generated sign-in, proposal, booking, review, admin, and CFT launch
links use the central base URL. Production honors `BASE_URL`, while managed
development uses its own preview origin. No production setting was changed or
its secret value inspected. Attach and verify the custom domain before changing
production `BASE_URL`; keep the working live origin until then. Historical
emails retain their original links. User-authored URLs and legitimate external
services (payments, external signing, CFT) are not rewritten to the main domain.
The current app uses passwordless sign-in, not a separate password-reset flow.

This result establishes SendGrid preservation for the delivered samples, not a
guarantee about recipient-side click-time security gateways or every email app.

## Call Flow Tracker automatic sign-in hardening

The owner chose to retain automatic sign-in. New notification links place a
43-character credential in `/go/cft#token=…`, not a URL path. The standalone
browser page scrubs history before a JSON POST; there are no third-party
subresources. Legacy path links return 410 and their shorter tokens are rejected.
Existing legacy links must be replaced; new links expire in 20 minutes and are
consumed atomically once, including concurrent attempts.

Credential-bearing SMS uses the existing authentication outbox expiry/preview
protections. Sent/logged bodies are cleared immediately; failed delivery retains
content only within the expiry and three-attempt limit. Scheduled outbox cleanup,
admin preview reads, and retry checks enforce those limits. Legacy saved
path-link bodies are cleared by cleanup. Slack logging redacts both link formats;
provider error bodies are not logged. Notification results no longer return
the credential URL.

Local database tests cover concurrent single use, expiry, revocation, unconfigured
Slack/SMS logging, preview hiding and saved-content cleanup, without contacting
CFT or sending messages. Live CFT SSO remains unverified. CFT's existing
short-lived SSO handoff still uses its external URL contract; its own logs and
session behavior require verification in that service. Recipient mail, SMS and
Slack systems necessarily receive message content; local redaction cannot remove
their retained copies. Use private Slack channels and approved recipients.

A synthetic browser transport check confirmed a credential-free initial GET,
history scrubbing before POST, a marker-free subsequent local navigation, and
no third-party requests. The success response was intercepted locally rather
than contacting CFT. Negative checks confirmed invalid input did not redirect
to CFT or echo credentials, and the legacy route returned 410. This is not an
end-to-end CFT sign-in result.

## Observed delivery results

- SendGrid returned HTTP 202 for each approved recipient. This establishes
  provider acceptance, not receipt at both addresses.
- The connected Gmail mailbox received its message in Inbox, not Spam.
- Both decoded MIME parts (`text/plain` and `text/html`) contained the original
  `/auth/verify#token=…` canary URL with an unchanged fragment and empty query.
  The canary was a fixed test marker never registered as an authentication token.
- The authentication-shaped test URL was not wrapped by SendGrid or rewritten
  in the received MIME. No test marker appeared in URL query/path components.
  This does not establish click-time redirect behavior or tenant-wide policy.
- SendGrid added an open-tracking image to the HTML. Its URL did not contain
  the canary. Do not confuse this image with a click-tracking redirect wrapper:
  disabling click tracking does not disable open tracking.
- The delivered HTML had no explicit anchor for the test URL, consistent with
  the current application's text-to-HTML conversion.
- The second recipient's receipt is unverified; only one mailbox was connected.

### Test boundaries

The send used the installed SendGrid SDK, the current application's
`textToHtml` function extracted from source, and the same explicit click-tracking
settings as authentication delivery. It sent directly from the owner's approved
support sender, bypassing database/outbox creation and the real sign-in issuer.
It therefore does **not** validate the outbox, the configured noreply sender,
real-token consumption, rendered Gmail auto-linking, embedded browsers, or
physical-device handling. No application code or sender settings were changed.

Only the uniquely labeled compatibility test message was fetched through Gmail.
Message bodies were decoded in memory and only sanitized assertions returned;
raw MIME, credentials, cookies, and full tracking URLs were not saved in project
files. The harmless test emails remain in the recipients' mailboxes. No Gmail
write/delete operation was performed.

## Findings from code inspection (not delivery verification)

- The sign-in URL carries its credential in `/auth/verify#token=…`.
- The latest GitHub implementation selects the `noreply` sender for sign-in
  messages. That differs from the owner's proposed support sender for testing;
  a test from support alone would not verify the current sign-in sender.
- The authentication email includes both text and HTML MIME content. The HTML
  converter emits the URL as text, **not an explicit anchor**. Clickability and
  fragment preservation therefore depend on the client's auto-link detection.
  Clients that do not auto-link may require copying the complete URL.
- For all outgoing emails, the SendGrid request sets both `clickTracking.enable` and
  `clickTracking.enableText` to false. The canary delivery above confirmed an
  unwrapped test link under these settings for the connected Google mailbox.
- The verification route uses browser JavaScript and a JSON POST. A client that
  strips the fragment, or an embedded browser that disables JavaScript, cannot
  complete this flow.
- A URL fragment is absent from the initial HTTP request, but an email security
  service can read the full email link and encode it in a wrapper's query or path.
  Disabling SendGrid tracking does not control corporate rewriting.

## Client-interaction matrix — all rows NOT TESTED

### Branding follow-up

The shared HTML email template now uses the original site-header PNG as an
inline CID attachment. Generated consultation checklist and proposal PDFs embed
the same artwork; plain-text email and SMS remain text-only. Existing previously
generated outbox messages and PDFs are not retroactively rewritten.

An updated harmless branding sample was accepted by SendGrid (HTTP 202) and
received in the connected Gmail Inbox. The received HTML referenced the logo
CID and included its matching 72,415-byte PNG MIME part. Browser rendering of the
template was visually checked with the CID resolved to the same image bytes.
That visual check is not a Gmail/Outlook/Apple Mail client-rendering certification.
Three focused tests and TypeScript checking passed. No live credentials were
included in this branding sample.

Confirm the supported clients with the owner before execution. Record exact
versions, OS, browser, MIME mode, and mail-security policy with each result.

| Client / environment | Plain text | HTML | Fragment preserved | No credential in redirect URLs |
| --- | --- | --- | --- | --- |
| Gmail web / desktop browser | Not tested | Not tested | Not tested | Not tested |
| Outlook web / desktop browser | Not tested | Not tested | Not tested | Not tested |
| Outlook for Windows | Not tested | Not tested | Not tested | Not tested |
| Apple Mail / macOS | Not tested | Not tested | Not tested | Not tested |
| Apple Mail / iOS | Not tested | Not tested | Not tested | Not tested |
| Gmail / Android | Not tested | Not tested | Not tested | Not tested |
| Outlook / iOS or Android | Not tested | Not tested | Not tested | Not tested |
| Corporate Microsoft Safe Links tenant | Not tested | Not tested | Not tested | Not tested |

No client is certified as supported by this document yet. Corporate results
apply only to the tested tenant policy; they cannot certify all rewriting systems.

## Safe execution procedure once access is approved

1. Use an isolated development environment, verified SendGrid sender, approved
   test recipients, and disposable least-privileged accounts. Confirm the link
   targets this environment without printing it. Never follow an unexpected
   origin or remap it and report an end-to-end pass.
2. First send a non-authenticating canary in the same URL shape through the same
   delivery and rewriting policy. Inspect both decoded MIME parts and client
   link targets in memory. Report booleans only: wrapper present, fragment
   intact, and canary encoded in a redirect query/path. Do not persist full URLs,
   raw MIME, redirect headers, screenshots of links, traces, or HAR files.
3. If a wrapper puts the canary in a query/path, stop before issuing live
   credentials to that route. Mark it unsafe under that policy and request an
   approved rewriting exclusion or alternative sign-in method. Do not disable
   corporate protection without the administrator's approval.
4. Only after the canary check passes, exercise fresh real links for each MIME
   mode and client. Confirm successful sign-in, one-time use, and that the
   fragment survives client handoff. Use separate links for separate cases.
   Provider acceptance alone is not evidence of delivery or client behavior.
5. Keep diagnostics credential-free, including POST bodies and cookies.
   Inspect redirect handling in memory with recording disabled, outputting only
   assertion results. A successful sign-in alone does not prove URL safety.
6. Revoke test sessions/tokens and remove test messages and test outbox records
   under the approved cleanup policy. Do not export credentials as evidence.
   Record only sanitized outcomes, versions, policy, date, and limitations.

Email and provider systems necessarily process message contents. Agree on their
retention and cleanup before live testing; do not claim zero provider retention.
Stored-email access restrictions are separate work.
