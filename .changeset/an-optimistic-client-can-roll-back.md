---
"@graview/core": patch
"@graview/ship": patch
---

An optimistic client can roll back through public API. `store.rebase({ confirmed, pending, drop })` rolls back this store's pending batches, lands the server's ops in its order, and applies the pending calls again on top under the same batch ids, author and intent; a call that no longer applies there is left off and named in `refused`. Subscribers hear one change, the net diff. `store.notify(diff, ops)` is public, for a host that changes the graph some other way and owes its subscribers the same news. A store's default batch ids carry a tag drawn fresh for each store (`batch:<tag>:<n>`), so two stores opened from the same log never mint the same one, and `batchIds` lets a server mint its own. `openRemote` lands everything the server sends through `rebase`, so an answered press's provisional op is replaced by the server's, not kept beside it, and a refused one is dropped rather than undone. This is the store's half of the optimistic live client; the live wire follows.

Compatibility: additive for ops and stored formats — `Store.rebase`, `Rebase`, `RebaseResult`, `StoreOptions.batchIds` and `OperationLog.truncate` are new, and `Store.notify` is now public. Changed for callers of `Store`: default batch ids read `batch:<tag>:<n>` and `undo:<tag>:<n>` rather than `batch:<n>`; nothing should parse them. Changed for `openRemote`: a browser's log holds the server's ops for its presses, not the provisional ones and a take-back beside them. The wire is unchanged.
