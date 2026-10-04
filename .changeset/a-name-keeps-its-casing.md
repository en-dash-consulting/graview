---
"@graview/studio": patch
---

A name the studio is given is kept as it was written. `add-edge` with the label `tendedBy` declared the relation `tendedby`, and `add-field` with `lastChecked` the field `lastchecked`, because every new name was folded to lower case — a different relation and field from the ones `editDocument` and Graview Cloud's builder make for the same words, so the document the studio handed back was not the one the host would have written. A label that is already a legal name (a relation in kebab-case or one camelCase word, a field in camelCase) is now the name; words that are not yet one ("Looked After By") are still made into one (`looked-after-by`). Held by documentHash equality with `editDocument` for `add-relation` and `add-field` on Cloud's household-chores template.

Compatibility: the studio's `add-edge` and `add-field` acts keep a camelCase label's casing where they lower-cased it; a node id they make (`edge:<kind>.<name>`, `field:<kind>.<name>`) follows the name. Every other label is named as before. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
