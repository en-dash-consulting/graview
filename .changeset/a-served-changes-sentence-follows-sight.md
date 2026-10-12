---
"@graview/core": patch
"@graview/tools": patch
---

A change's sentence follows sight. `answerSeenBy` redacted what a change made to the seat's sight and still passed its sentence through, so "Draw a match: Ann gives to Bo" reached a Secret Santa participant who may not see that match, from the answer to their own act. The same happened in a served log: what a caller said a whole batch was for ("Draw: Ann for Bo, Bo for Ann") rode on every op of it the seat was served, over the wire, in the activity rail and in a seat's history. Now a change the seat is served none of says only "A change you cannot see". One it is served part of (an op withheld, or a link left out) is said from the sentences of the ops it is served, and a batch's own sentence goes from a log the seat sees only part of. A preview now judges a record it would make by its kind and by the links the preview gives it, so a seat is not shown a record of a kind it may not see in a preview's diff, primitives or sentence. A seat that sees everything is told every sentence as it was written.

`answerSeenBy` moves to `@graview/core/answer`. Only an answering seat needs it, and `@graview/core`'s index brought it into every hosted page's first load.

Compatibility: ops, stored formats, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. What a seat is served narrows: a batch's `batchIntent` is left off the ops of a batch the seat is served only part of, and an answer's `intent` to such a change is said from the ops the seat is served. No field is added, and `WIRE_PROTOCOL` is unchanged (`docs/stability.md`). `answerSeenBy` is no longer exported from `@graview/core`. What a host does: import it from `@graview/core/answer`. A hosted page's first load is 1,703 bytes smaller.
