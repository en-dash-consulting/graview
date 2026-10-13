---
"@graview/core": patch
"@graview/tools": patch
"@graview/studio": patch
---

Archive and merge are offered after a record's own acts and its edit, just ahead of remove, never first (FR-173). Settled to one press, `archive-<kind>` and `merge-<kind>` led every strip: on the studio's selected kind, "Archive the kind" came first and pushed "Add a field" past the rows shown before "Show more". "Bring it back" keeps its place, since it is only offered on an archived record. A kind can now say `archives: false` on `defineNode`, and is then given no `archive-<kind>`, `unarchive-<kind>` or `merge-<kind>` (its `remove-<kind>` stays): the studio's meta-schema says it on every kind, because a kind, a field or a relation is in the declaration or not, never set aside.

Compatibility: derived tools — the studio's meta-schema loses the archive, unarchive and merge tools it gained in 0.1.29 for its kinds, and a kind declaring `archives: false` has none. Every other kind's tools are unchanged; only the order acts are offered in moves.
