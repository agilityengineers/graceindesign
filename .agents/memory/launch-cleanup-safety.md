---
name: Launch cleanup safety
description: Conservative boundaries for removing prototype data before launch.
---
Automatically remove only closely matching seed records. Retain lead/project parents and proposal/portal records for explicit review rather than relying on seed identifiers.

**Why:** The user chose safer deletion rules. Parent deletion can cascade into real work added after seeding; a demo token does not prove a proposal has no real signatures. A missing social credential or an example.com address does not prove a record is disposable.

**How to apply:** Keep review warnings separate from automatic change counts. Zero automatic changes must not be described as full launch readiness while demo public links or ambiguous records remain. Production cleanup requires a separate authorized path; development changes do not clean production content.
