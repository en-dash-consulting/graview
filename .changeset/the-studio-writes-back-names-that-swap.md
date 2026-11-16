---
"@graview/studio": patch
---

The studio writes back names that swap. Renaming kind `a` to `tmp`, `b` to `a` and `tmp` to `b` left two kinds with each other's names, and `studio.document()` said that as "rename `a` to `b`, rename `b` to `a`": `editDocument` refused the first, since there was already a kind `b`, so no document came back. The studio's renames of kinds, of a kind's fields and of relations are now ordered so none lands on a name still taken, and a cycle of them (a swap, or three names turned one place round) goes through a name of its own (`a-renaming`, a field's `dueRenaming`, a camelCase relation's `growsNearRenaming`) that the document never keeps. Each field still continues the values of the one it was, and a rule over a field that swapped names is read in its new name with no change to the rule said. Held by a unit test of the studio (`the-studio-writes-back-names-that-swap`).

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The JavaScript API is unchanged; `studio.edits()` may now say a rename through a name of its own. What Graview Cloud does: nothing.
