---
name: Launch notification scope
description: Owner-approved exclusions from production notification readiness.
---

Skip Slack integration for this launch. The user will set it up later and considers it nonessential for production.

**Why:** The user explicitly asked to close the launch checklist item rather than delay production for Slack.

**How to apply:** Treat Slack as deferred, not implemented or tested. Do not request its webhook again or block publishing on it unless the user reopens that scope.
