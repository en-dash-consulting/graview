---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
---

A log a seat may not fully see is redacted, not gapped. `seenBy` used to leave out the ops that touched what a seat may not see, which left holes in the seq that `OperationLog.from` refuses, so a served store had no log it could send. Those ops now stay in place as withheld ops, `withheld: true`. A withheld op keeps its id, seq, batch, time and `undoes`. Its author is `WITHHELD_AUTHOR` ("Someone") and its intent is `WITHHELD_INTENT` ("A change you cannot see"). The mutation, inverse and batch intent are dropped. Its primitives, reads and writes keep only what the seat sees, so the seat's copy of a record it can see still moves. `redact(ops, sees)`, `withhold`, `touchesUnseen`, `touchedBy` and `isWithheld` do the redaction, and `logSeenBy(store, principal)` and `seesId(store, principal)` read it for one seat.

A log with withheld ops loads, folds and undoes around them. `checkUndo` refuses to take back a withheld op and says only that it was "a change you cannot see". When a withheld op stands in the way, it says "a later change you cannot see depends on it", without its sentence, id or what it read, and offers no batches to bring along. `seenBy(...).canUndo` judges over the redacted log, and `Store.undo` judges a seat with sights that way first, so neither a refusal nor a 409 quotes a change the seat may not see. The activity rail shows a fully withheld batch as "A change you cannot see", with no author, nothing it touched and no undo. A record's page leaves withheld ops out of its history (FR-16).

Compatibility: additive for ops: `Operation.withheld` is a new optional field, an op without it reads as before, and no store makes one for itself. Changed for readers of `seenBy(store, principal).log` and `.batches()` under a policy with `sees`: ops a seat may not see now come back withheld in their place rather than being left out. `checkUndo` now takes any `LogReading` (`all`, `undoneIds`, `epochs`), which an `OperationLog` still is. Stored formats are unchanged.
