---
"@graview/core": patch
---

Two-way sync on top of the op log: a declarative resource mapping, an inbound
change that arrives as an ordinary op with a `system` author, echo suppression
from the version the remote produced for our own write, conflicts surfaced as
violations with repairs rather than resolved silently, and offline degrading to
local-only. A Google Calendar transport is included.
