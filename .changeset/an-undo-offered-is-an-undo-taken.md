---
"@graview/core": patch
"@graview/primitives": patch
---

What a page offers to take back is what the store would take back. Activity's "undo" asked only the log (`canUndo`), and the corner's take-back control judged a change no act made as anybody's, so once undo came to judge a change no act made (an import, a sync, the app's own actor), a seat was offered an undo the store then refused — the watch's "offered then refused", on Activity at `?tidy=1`. `store.mayUndo(batches, principal)` now answers with the same judgment `undo` makes, log and policy both; Activity's row and the take-back control offer only what it allows, and `undo` itself refuses through it, so the two cannot drift. Core's undo test holds that every `mayUndo` answer agrees with what `undo` then does. A hosted page carries 0.2 KB more up front.

Compatibility: additive — `Store.mayUndo` is new; an undo control no longer appears on a change the seat may not take back.
