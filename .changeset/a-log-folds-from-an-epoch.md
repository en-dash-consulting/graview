---
"@graview/core": patch
"@graview/ship": patch
---

A log can be folded from a base. An `Epoch` is a base graph and the seq where the log starts folding onto it. The log carries its epochs: `OperationLog.from(ops, epochs)`, `log.epochs()`, `log.lastEpoch()` and `log.markEpoch(epoch)`. `log.fold(schema, { from: epoch })` folds that epoch's base with the ops from its seq on. A store takes `epochs` beside `log`, and `store.verify()` folds from the last epoch, so a log that spans two declaration versions verifies. A store opened on a snapshot alone takes the snapshot as its first epoch. Undo does not reach back across an epoch that changed the declaration, and the refusal names the change.

`openStore` records an epoch whenever the graph it opens on did not come from the log. A new scope gets one at its seed, and a migration run gets one at the graph it left, naming the change. A store from before epochs gets one at what it holds, or from empty when its whole log folds to it. The opened store says which in `epoch`. Adapters keep epochs through the new optional `loadEpochs` and `saveEpochs`: the memory, file (`epochs.json`) and browser (`<prefix>:<scope>:epochs`) adapters have them, and the sqlite adapter does not yet (FR-27).

Compatibility: stored format — additive. Epochs are stored beside the snapshot, log and meta, and no format number moves: a store without them reads as before and is given one on open. Ops and primitives are unchanged; `OperationLog.from` and `fold` take new optional arguments. Undo of an op made before a migration, which used to write the old shape back, is now refused.
