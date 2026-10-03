---
"@graview/core": patch
"@graview/studio": patch
---

Structural change is a vocabulary. `editDocument(doc, edits)` takes twenty-one operations, from add-kind to rename-relation to set-view, and returns the document with a sentence for each.

A rename sets `renamedFrom` and rewrites every reference, using the rule language's own walk, which knows a quoted word and another kind's field from this one:
- rules and templates;
- acts and the arguments they ask for;
- grants, repairs and views.

When a rename moves an agent's tools — `set-quote` becoming `set-price`, `edit-vendor` asking for `price` — the result says so.

The studio gains `rename-field`, the same operation over its own graph, through the same walk (`renameIn`). A test holds the studio and `editDocument` to the same declaration for the same change (FR-34).

Compatibility: the declaration — additive: new functions and a new studio act; derived tool names change only when an app renames what they are named for, and an edit says so.
