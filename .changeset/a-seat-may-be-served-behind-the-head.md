---
"@graview/core": patch
"@graview/ship": patch
"@graview/react": patch
"@graview/tools": patch
---

A seat's served state may end before the store's head, and nothing promises it does not. `docs/stability.md` gains "Served state and the head": a policy may serve a seat through an earlier seq as narrowing, the same kind of change as FR-55's narrowing by record, so `GET /graview/since?seq=N` answers the ops after N that the asking seat is served and a socket's `welcome.seq` is the last seq the seat is served — the head in this build. `Store.servedSeq` says where what a store serves ends, read-only: a store's own is its head, `pastOf(store, seq)`'s is `seq`, and a seat's view says the seq that seat is served through. The doc comments of `seenBy`, `Store.seenBy`, a provider's `store`, `useGraph`, `useLiveStore`, an agent's reads and a seat's model prompt now say "the app as this seat is served it", and the seat view's cache is keyed by everything serving reads, one line from taking where a seat is served through. A compaction never passes a seq somebody is served at: `CompactOptions.pins` (`store.checkpoint`, ship's `opened.compact`) are such seqs, and the horizon stops at the lowest, so the reader's past still folds from the log. A write is judged at the head whatever its seat is served, and a test now holds a stale-write check from a seat served behind the head to the head's revisions. An op's `publishedThrough`, a document's `publishing` and the wire's `servedThrough` are named as reserved, with no behavior, for the publishing lifecycle to come.

Compatibility: additive — `Store.servedSeq` and `CompactOptions.pins` are new and optional; the wire's `/graview/since` and the socket's seqs are reworded, not changed: every seat is still served through the head. Ops, stored formats, the document format, `WIRE_PROTOCOL` and derived tools are unchanged.
