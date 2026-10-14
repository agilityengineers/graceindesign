---
name: GitHub synchronization
description: Prevent recurring pull conflicts after reconciling GitHub and workspace changes.
---
Prefer a history-preserving merge when reconciling this project's local security fixes and upstream changes.

**Why:** The Git panel repeatedly invoked pull with explicit rebase, replaying already reconciled security changes and conflicting over migration history. A local merge alone did not prevent the next pull from repeating the failure.

**How to apply:** Preserve a backup before recovery, fetch and merge upstream, and when the user authorizes full synchronization, push normally and verify identical local and remote main heads. Never force-push to work around this. Local pull configuration alone cannot override an explicit rebase command.
