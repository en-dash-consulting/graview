---
"@graview/core": patch
"@graview/ship": patch
---

A store can prove its own fold. `snapshotHash(snapshot)` is the graph's fingerprint, `sha256:<hex>` over a canonical form: nodes by id, edges by identity, keys sorted. Node, edge and key order do not change it, and it runs in a page or a worker as well as in Node. `store.verify()` refolds the log and compares. It returns `{ ok: true, hash }`, or the two hashes, the op after which they part (`divergedAfter`) and the finding in a sentence.

`openStore({ verify: true })` verifies on open. When the stored graph disagrees with its log, the graph is rebuilt from the log and saved, and the opened store reports `rebuilt: { from, to, divergedAfter }`. If the log does not fold, there is nothing to rebuild from, so the open refuses (FR-20).

Compatibility: additive — `snapshotHash`, `VerifyResult`, `Store.verify()` and the `verify` option are new; `OpenedStore` gains optional `verified` and `rebuilt`. Stored formats and the wire are unchanged.
