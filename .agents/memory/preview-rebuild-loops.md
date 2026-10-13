---
name: Preview rebuild loops
description: Environment-specific causes of interrupted navigation and preview failures.
---

Keep Tailwind content discovery limited to application source rather than the whole Replit workspace.

**Why:** Workspace-wide discovery coincided with continuous idle rebuilds, interrupted navigation, and intermittent JSON parsing failures. Restricting discovery and restarting the server produced zero idle rebuilds and successful browser navigation across the main menu.

**How to apply:** When expanding source locations, add only directories that contain application classes, not tooling or generated output. Verify real link clicks and an idle interval, not just HTTP responses.

Restart the development server after dependency reinstalls.

**Why:** A server surviving an `npm ci` continued failing with missing Next.js worker and PostgreSQL dependency modules even after those files existed again on disk.

**How to apply:** Check that post-merge reconciliation actually replaces the server process before diagnosing missing-module errors as missing package declarations.

Do not run a destructive dependency reinstall underneath the live preview during routine task merges.

**Why:** Repeated source-only merges triggered `npm ci`, which removed dependencies while Next was serving requests and repeatedly broke navigation. A successful install afterward did not repair the already-running server's module state.

**How to apply:** Preserve unchanged dependencies during merge setup; if a clean reinstall is necessary, stop the workflow first and restart it afterward.
