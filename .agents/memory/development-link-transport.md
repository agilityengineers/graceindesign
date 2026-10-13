---
name: Development link transport boundaries
description: Why development link previews use ephemeral process-local storage and what remains outside its protection
---

Keep development link display state ephemeral and development-only; a server restart may require requesting a new link.

**Why:** This is a convenience for local no-email development, not a production delivery mechanism. Process-local bounded storage avoids persisting another raw sign-in credential or needing schema changes for a development-only feature.

**How to apply:** Never move its lookup handle into a URL. This protects the login confirmation URL only, not the existing verification URL, stored email bodies, or logs configured to capture cookies/bodies.
