---
id: "e1153e9b-ba4b-4160-a640-d3954bb1b8f8"
level: "feature"
title: "Graph core — @graview/core"
status: "completed"
priority: "critical"
tags:
  - "core"
  - "headless"
  - "schema"
  - "invariants"
source: "Session planning — build sequence step 2"
startedAt: "2026-08-30T04:03:23.071Z"
completedAt: "2026-08-30T04:03:23.071Z"
endedAt: "2026-08-30T04:03:23.071Z"
acceptanceCriteria:
  - "The household example's seven node kinds and six edge kinds express as defineNode declarations"
  - "The household example's four invariants produce output identical to its hand-rolled engine"
  - "Registering a view for an undeclared node kind is a compile error, not a runtime one"
  - "Interleaved human and agent operations undo selectively, with blocking ops named when the check fails"
  - "The whole package runs headlessly in CI — no DOM, no GPU, no browser flag"
description: "The headless heart of the framework: schema registry, invariant engine, operation log, and diff stream. Plain TypeScript with no React, no DOM and no GPU dependency, so it runs in CI without a browser flag.\n\nDeliberately PARALLEL to platform validation, not blocked by it. If the platform questions go badly, everything here survives intact — that is the point of the tier split.\n\nDesign constraints agreed:\n- Declaration-driven. One `defineNode()` is the source of truth; AI tool schemas, drag legality, aggregate view contents and a11y labels all derive from it. Every derived value stays inspectable and overridable — nothing sealed.\n- Agent-first DX. Mistakes surface at BUILD time: a view registered for an undeclared node kind, an edge pointing at an undeclared kind, or an invariant referencing a renamed field must all fail `tsc`. Ship a `check` CLI and generated llms.txt/agents.md, following vgpu's playbook.\n- Schema system underneath (Zod / Standard Schema) so runtime validation, TS inference and JSON Schema for tool definitions come from one source.\n- Invariants carry `repairs` — naming the mutations that would fix a violation. This is the seam that feeds derived affordances.\n- Reads-tracking in the op log from the very first op. It cannot be retrofitted onto an existing log.\n- Framework owns the reactive in-memory graph; persistence is a pluggable adapter."
---

## Children

| Title | Status |
|-------|--------|
| [Invariant engine with repairs](./invariant-engine-with-repairs.md) | completed |
| [Operation log with reads-tracking and selective undo](./operation-log-with-reads-f62721.md) | completed |
| [Persistence adapter and the household example graph load](./persistence-adapter-and-16267b.md) | completed |
| [Schema registry — defineNode with build-time type safety](./schema-registry-definenode-with-aa5d62.md) | completed |
