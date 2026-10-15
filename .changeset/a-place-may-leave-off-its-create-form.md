---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/skills": patch
---

A place may leave off the forms that begin its kind. Every place's page ended with the create form for the kind it stands on, which on a page that is read, not written (a summary, a report) is a form nobody came for. A lens says `"create": false` and its page offers none; the kind's list and the bar still do. A per-place key rather than a form folded behind a button, because the author knows which places are read: a button would still put an act on every summary, and a place that is written keeps its form open as before. The document's shape types it (`lenses[].create`, a boolean, in `document.schema.json`), `graview check` warns at `lenses.<i>.create` when it is not one (`lens-create`), `add-lens` takes it ("its page offers no form to add one"), and `DrawnLens.create` carries it to whoever draws the place.

Compatibility: the declaration and check finding codes: a lens takes a new key, `create`, a boolean; a document that does not say it is unchanged, and one that says something other than true or false is refused by the document's shape, or warned of (`lens-create`) in a TypeScript declaration. The `add-lens` edit takes `create`. Ops, stored formats, the wire and derived tool schemas are unchanged.
