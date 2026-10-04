---
"@graview/core": patch
---

A glance is an edit. A document says what a glance at a kind says (`kinds.<kind>.glance`, FR-39), and `editDocument` had no op to choose it: a host that changes documents by edits could read the choice, compile it and diff it, but not make it. `{ "op": "set-glance", "kind": "vendor", "fields": ["quote", "due"] }` now makes it, in the order given, and says "A glance at a vendor says quote and due, in that order."; an empty list takes the choice away, and says so. Each name is checked like any name an edit gives: a field the kind does not have is refused at `edits.<i>.fields.<n>` with the fields it has as the fix, a name given twice is refused, and so is a kind the app does not have. `diffDocuments` says "What a glance at a vendor says changes." for it, as it does for any different choice. `EDIT_OPS` lists `set-glance`, and `DocumentEdit`, the shape of one edit as `editDocument` takes it, is exported from `@graview/core/document`.

Compatibility: the edit op surface — additive: `EDIT_OPS` gains `set-glance`, and every edit that applied before applies the same. A tool schema that enumerates `EDIT_OPS` offers one more op. `DocumentEdit` is a new type. The document format (`graview-document@1`), ops, stored formats, the wire and check codes are unchanged.
