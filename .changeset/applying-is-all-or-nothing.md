---
"@graview/core": patch
---

Applying primitives is all or nothing. A batch whose third primitive fails leaves the graph as it was, and a listener hears nothing. `Store.receive` applies every op it is handed before any joins the log; one that does not fit puts the graph back and throws a `ReceiveError` naming the op, with the graph's own error as `cause`. A host no longer needs to rehearse a repair or a migration on a copy before trusting it (FR-26).

Compatibility: additive — `ReceiveError` is new; `Store.receive` now throws it, not the graph's error, for an op that does not fit, and leaves the store unchanged where it used to keep the ops before the failing one.
