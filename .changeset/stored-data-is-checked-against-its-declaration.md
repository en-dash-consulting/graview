---
"@graview/core": patch
"@graview/ship": patch
---

Stored data is checked against its declaration. `validateGraph(app, snapshot)` reads a graph as it is stored and says what no longer fits, each finding with a code, an id and its smallest repair: `node-shape`, `kind-unknown`, `edge-dangling`, `edge-disallowed`, `rule-error` and `rule-budget`, the last two read off a violation's `status` rather than its words. A clean graph has none. `repairPlan(findings)` turns the findings into one batch that clears an optional field, coerces a required one to its default, or drops a record with its links, and says the plan in counted sentences. `store.applyPrimitives(primitives, { author, intent })` applies a batch of primitives as one ordinary op, logged, attributed and undoable, and `store.findings()` validates the store's own graph. `health()` counts the findings (FR-21).

Compatibility: additive — `validateGraph`, `repairPlan`, `GRAPH_FINDING_CODES`, `Store.applyPrimitives`, `Store.findings` and `HealthReport.findings` are new. The six finding codes are a stability surface from now on: a code never changes meaning (docs/stability.md §4).
