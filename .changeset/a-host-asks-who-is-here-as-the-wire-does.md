---
"@graview/ship": patch
"@graview/core": patch
---

A host that answers who is here itself is told it as the wire tells it (FR-215), as Roadmap f-who-for-export asked. Since 0.1.54 (FR-211) a seat is told where somebody stands only as it is served the app, judged in the wire's `whoFor`, but no entry exported it, so Graview Cloud, which answers `/graview/here` and `/graview/who` over HTTP itself, kept a copy of the judgment. Now `whoFor(store, principal, who)` is on `@graview/ship/runtime` (and the root entry): the presences `who` as `principal` may be told of them — a visitor whose announced time has passed dropped, a stop, hover or caret on a record or field its sight withholds said as nowhere, and for a reader of an app that publishes nothing of a record, or a caret in text, it is not yet served. The wire's own routes and socket call the same function. Ship's FR-211 test also holds the exported function to tell each of three seats exactly what `/graview/who` tells it, and a reader nothing of a record not yet published.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged. The wire: unchanged; additive on `@graview/ship/runtime` (`whoFor`). `capabilities().shipped` gains FR-215. What Graview Cloud does: answers `/graview/here` and `/graview/who` with `whoFor(store, seat, alive)` from `@graview/ship/runtime` and drops its copy.
