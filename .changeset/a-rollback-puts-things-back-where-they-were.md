---
"@graview/core": patch
---

A rollback puts things back where they were. `Store.rebase` rolled pending ops back by applying their inverses, and a node or edge a pending op had removed came back at the end of the graph. The records were the same, but the order differed from the server's, and "as they come" reads that order, so two people saw one list two ways. The live wire's convergence test failed on it now and then in CI. The graph now gives each node and edge a rank as it goes in, and a rollback (`applyPrimitives(…, { inPlace: true })`, which `rebase` uses) puts back what it restores at that rank. An undo still adds at the end, as it always has, so a client that loaded after the removal agrees with the server.

Compatibility: ops and primitives unchanged; stored formats unchanged. `ApplyPrimitivesOptions` gains an optional `inPlace` (additive). A client's snapshot order after a rebase now matches the server's where it could differ before.
