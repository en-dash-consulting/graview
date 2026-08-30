---
id: "f62721da-3c9a-4e93-930c-971c2ede56e4"
level: "task"
title: "Operation log with reads-tracking and selective undo"
status: "pending"
priority: "high"
tags:
  - "core"
  - "undo"
  - "op-log"
  - "attribution"
blockedBy:
  - "aa5d62c9-4d32-4157-aa3d-61aa93642dde"
acceptanceCriteria:
  - "Every mutation records author, batch, intent, inverse, reads and writes"
  - "The graph is reconstructible by folding the log from empty"
  - "Interleaved human and agent ops undo selectively when the dependency check passes"
  - "When the check fails, the specific blocking op is named and offered for inclusion"
  - "Undo appends inverse ops — no log entry is ever mutated or removed"
  - "Undo previews as a diff, including any invariant it re-violates, before applying"
description: "The graph becomes a fold over an append-only operation log. Every op carries: author (human / agent / rule, with session), batch (one user gesture or one agent turn), intent, the typed mutation, its inverse computed at apply time, and the sets of nodes it READ and WROTE.\n\nCRITICAL SEQUENCING: reads-tracking must be present from the very first op. It cannot be retrofitted onto an existing log, because the historical reads simply are not recoverable. This constrains the mutation API — graph reads during a mutation need instrumentation, via a tracked read API or a proxy. Design that in now.\n\nThe reads set is what turns undo from a stack into a dependency graph. Undoing an op out of order is legal exactly when no later op read something it wrote — a checkable condition, so when it fails the framework names the specific blocking op and offers to include it rather than refusing or corrupting state.\n\nUndo APPENDS inverse ops rather than rewinding a pointer. History is never destroyed, redo is the undo of an undo, and the log doubles as an audit trail of what an agent did on your behalf. Because ops carry author plus causal reads, the log is already the right shape for later server reconciliation or CRDTs — adopting neither now costs nothing, foreclosing them would be expensive.\n\nKnown follow-on, not an oversight: the log grows forever, so snapshot-and-compact will be needed."
---
