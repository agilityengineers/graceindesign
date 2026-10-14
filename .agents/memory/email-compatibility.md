---
name: Email compatibility expectations
description: Owner's email-client support expectations and limits of available mailbox coverage
---

The owner wants support for all email apps and devices and wants the level of
effort explained before narrowing coverage. Their approved test mailboxes use
Google Enterprise / Google Workspace.

**Why:** The owner explicitly stated these requirements. Google-hosted
mailboxes alone cannot establish behavior for other corporate gateways.

**How to apply:** Distinguish broadly compatible implementation from verified
client/version coverage. Do not claim universal certification or Microsoft
Safe Links validation based on Google mailbox results. Keep recipient addresses
and authentication credentials out of memory.

Treat click tracking and open tracking as separate provider behaviors.

The owner confirmed that the sending domain is authenticated and verified,
the SendGrid key has Mail Send permissions, and both notification inboxes
receive incoming mail.

**Why:** These are owner-confirmed external settings, not facts established
by local code inspection.

**How to apply:** Do not repeatedly request this setup confirmation. Distinguish
it from actual delivery testing, and recheck if provider errors indicate a change.

**Why:** A real SendGrid canary delivery preserved the fragment URL without a
redirect wrapper but still inserted an open-tracking image despite per-message
click tracking being disabled.

**How to apply:** Classify image URLs separately from link targets when checking
received HTML. Never interpret every additional provider URL as a rewritten
sign-in link, or assume disabled click tracking also disables open tracking.

Use the actual site-header logo on outbound Grace In Design communications
where images are supported, not a typographic approximation.

**Why:** The owner explicitly requested the original logo after receiving an
email with a recreated wordmark.

**How to apply:** Reuse the original artwork in HTML emails and generated
documents; text-only channels retain the business name. Embedded email artwork
avoids depending on a development preview being publicly reachable.

Keep SendGrid from transforming URLs in all outgoing Grace In Design emails,
not just authentication messages. Main-app links should use the main site
domain; the owner will attach the custom domain only after they are satisfied.

**Why:** The owner explicitly prioritized URL preservation and deferred custom
domain attachment.

**How to apply:** Do not switch production links to an unattached domain.
Preserve intentional third-party destinations rather than replacing every URL
with the application origin.
The owner explicitly chose the Replit-hosted production address for publishing
until the custom domain is connected; use the verified deployment address
rather than assuming the custom domain is ready.

Preserve automatic Call Flow Tracker sign-in rather than replacing notification
links with a manual-login requirement.

**Why:** The owner explicitly chose to retain automatic sign-in and harden it.

**How to apply:** Protect credential transport, logs, message previews, and
retention while preserving the automatic handoff. Treat the external CFT
service's SSO contract and logging as a separate boundary, not something local
tests certify.
