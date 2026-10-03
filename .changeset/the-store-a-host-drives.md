---
"@graview/core": patch
"@graview/react": patch
---

The store a host drives. An op made without a `now` option is stamped with the current time, not the epoch. `applyAll` and `undo` given an `intent` keep each op's own sentence, from its act's `describe()` or "Undo: …", and record the intent beside it as `batchIntent`, which is what the batch reads as; an act with no `describe` takes the caller's words as its sentence, as before. `store.previewAll(calls)` previews several calls as one gesture, each compiled on the graph the one before it left, without writing anything. `store.append(ops)` lands ops a host built itself (example content, a seeded beginning, a repair) as ordinary, undoable history, filling in the seq, id, batch, time, inverse and writes it was not given, all or nothing. A blocked undo throws `UndoBlockedError`, a `GraphError` carrying the `UndoCheck` it was refused on and the ops in the way as `blockedBy`. Reopening on a snapshot never folds the log, so a log naming a kind the new declaration dropped opens as history (FR-18).

Compatibility: additive for the stable contract — `Operation.batchIntent` is a new optional field, and an op without it reads as before. `Store.previewAll`, `Store.append`, `AppendOp`, `UndoBlockedError` and `UndoRefused` are new. Changed in meaning for callers of `Store`: the default clock is the current time, and `ApplyOptions.intent` no longer replaces an op's `describe()` sentence (read `batchIntent`, or `Batch.intent`, for the gesture's words). Stored formats, the wire and derived tools are unchanged.
