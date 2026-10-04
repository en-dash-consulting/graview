---
"@graview/core": patch
"@graview/studio": patch
---

A diff reads what a document means, not the order its keys were written in. Two documents with one `documentHash` are one document, but `diffDocuments` compared their parts as JSON text, so an act whose description was written last "changed": between Cloud's vendors document and the document `studio.apply()` handed back for one added field — the same hash apart from that field, its keys in the order the schema lists them — the diff said nine bogus sentences ("The act \"Add a category\" changes.", "vendor's status is described differently."). Every comparison in the diff now reads canonical JSON, keys sorted as `documentHash` sorts them, so two hash-equal documents differ in nothing and the studio's document says exactly the one change. The same holds for a JSON Patch `test` op, for `planMigration`'s "converted" and patch comparisons, and for the studio's `documentEdits`. `canonicalize` takes any part of a document, not only a whole one.

Compatibility: additive. `diffDocuments` says fewer sentences — none — for a difference only of key order, and `unchanged` is true for two documents with one hash; every real difference is said as before. A JSON Patch `test` now passes for an object equal but for key order, as RFC 6902 says it should. `canonicalize`'s parameter widens from `GraviewDocument` to any value; its output for a document is unchanged, so every `documentHash` is the same. The document format, the edit op surface, ops, stored formats, the wire, tool names and schemas, and check codes are unchanged.
