---
name: Authentication test isolation
description: Safe browser testing when a fork inherits a different canonical origin
---

Treat a generated magic-link origin mismatch in a fork as a configuration finding,
not permission to follow the link to another deployment.

**Why:** Forks can inherit a canonical origin for another environment. Following it
could send test credentials outside the server under test; local auth success under
origin remapping does not prove that canonical-origin configuration works.

**How to apply:** Keep tokens and cookies out of diagnostics. Browser interception
must handle verification responses and their redirects explicitly: intercepting
only the initial navigation does not reliably intercept its redirected requests.
Report remapped local verification separately from an unmodified end-to-end pass.
