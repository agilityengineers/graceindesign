---
name: Launch notification scope
description: Owner-approved exclusions from production notification readiness.
---

Skip Slack integration for this launch. The user will set it up later and considers it nonessential for production.

**Why:** The user explicitly asked to close the launch checklist item rather than delay production for Slack.

**How to apply:** Treat Slack as deferred, not implemented or tested. Do not request its webhook again or block publishing on it unless the user reopens that scope.

Call Flow Tracker is also deferred to follow-up work rather than required for this launch.

**Why:** The user explicitly asked to skip Call Flow Tracker and make it a follow-up item.

**How to apply:** Do not block publishing on its SMS, automatic sign-in, or webhook setup. Preserve existing functionality; resume configuration and live verification when the user takes up the follow-up.
