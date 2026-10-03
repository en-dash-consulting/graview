---
"@graview/core": patch
"@graview/ship": patch
---

A store holds records that no longer fit while still checking new writes. Loading a graph holds every record as it was stored: nothing is parsed into something else, no default is filled in, no field is stripped, and a record an older declaration wrote no longer stops the store from opening. `store.findings()` says what does not fit. Writes are still held to the declaration: a node added must fit, an edge must be declared, and a patch must fit in what it writes and may not leave the record fitting less than before. A misfit the patch does not touch stays as stored, so renaming a record is not refused over an old field. Folding a log holds an op the current declaration refuses as it was written. Undoing a change that was not an act, such as a repair or a migration, puts back exactly what it took, misfits included, while the undo of an act is still refused when the declaration will not have it. `Graph.applyPrimitives` and `Graph.preview` take `{ restoring }` for primitives that put back what was there (FR-28).

Compatibility: stored format — snapshot 1 and op 1, unchanged; a snapshot that used to be refused at open now opens, and nothing at open rewrites a record. Ops and primitives: a fold no longer throws on an op the declaration refuses, and holds it as written instead. `GraphOptions.validate` now checks writes only, not loads; `ApplyPrimitivesOptions` is new.
