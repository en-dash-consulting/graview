---
id: "e1153e9b-ba4b-4160-a640-d3954bb1b8f8"
type: "capability"
title: "Graph core — @graview/core"
slug: "graph-core-graview-core"
statement: "@graview/core declares a typed graph from a single defineNode declaration, evaluates invariants that name their repairs, records every change in an operation log that supports selective undo, and persists through a pluggable adapter, all headlessly with no DOM, GPU or browser."
criteria: [{"id":"c1","text":"The household example's seven node kinds and six edge kinds shall express as defineNode declarations."},{"id":"c2","text":"If a view is registered for an undeclared node kind, the typecheck shall fail."},{"id":"c3","text":"If an edge is declared to an undeclared node kind, the typecheck shall fail."},{"id":"c4","text":"The schema registry shall generate agent tool JSON Schema from the same declaration as the TypeScript types."},{"id":"c5","text":"The check CLI shall report schema problems with messages an agent can act on."},{"id":"c6","text":"The invariant engine shall produce output identical to the household example's hand-rolled engine on its four invariants."},{"id":"c7","text":"The invariant engine shall yield the same violations for the same graph and context."},{"id":"c8","text":"Each invariant violation shall carry the offending node ids and the names of the repair mutations."},{"id":"c9","text":"When a constraint type is unregistered, the invariant engine shall skip it or throw, according to configuration."},{"id":"c10","text":"The operation log shall record author, batch, intent, inverse, reads and writes for every mutation."},{"id":"c11","text":"The graph shall be reconstructible by folding the operation log from empty."},{"id":"c12","text":"When the dependency check passes, the log shall undo interleaved human and agent operations selectively."},{"id":"c13","text":"When the dependency check fails, the framework shall name the specific blocking operation and offer it for inclusion."},{"id":"c14","text":"When an undo is applied, the log shall append inverse operations and shall not mutate or remove any existing entry."},{"id":"c15","text":"Before applying an undo, the framework shall preview it as a diff, including any invariant it re-violates."},{"id":"c16","text":"The memory adapter and the Drizzle/SQLite adapter shall both satisfy one adapter interface."},{"id":"c17","text":"The household example's real graph_nodes and graph_edges shall load into a typed graph through an adapter."},{"id":"c18","text":"When invariants run against the loaded graph, they shall match the violations the household example currently reports."},{"id":"c19","text":"Writes shall round-trip through the adapter and survive a reload."},{"id":"c20","text":"The whole package shall run headlessly in CI with no DOM, no GPU and no browser flag."}]
tags:
  - "core"
  - "headless"
  - "schema"
  - "invariants"
source: "Session planning — build sequence step 2"
priority: "critical"
---

The headless heart of the framework: schema registry, invariant engine, operation log, and diff stream. Plain TypeScript with no React, no DOM and no GPU dependency, so it runs in CI without a browser flag.

Deliberately PARALLEL to platform validation, not blocked by it. If the platform questions go badly, everything here survives intact — that is the point of the tier split.

Design constraints agreed:
- Declaration-driven. One `defineNode()` is the source of truth; AI tool schemas, drag legality, aggregate view contents and a11y labels all derive from it. Every derived value stays inspectable and overridable — nothing sealed.
- Agent-first DX. Mistakes surface at BUILD time: a view registered for an undeclared node kind, an edge pointing at an undeclared kind, or an invariant referencing a renamed field must all fail `tsc`. Ship a `check` CLI and generated llms.txt/agents.md, following vgpu's playbook.
- Schema system underneath (Zod / Standard Schema) so runtime validation, TS inference and JSON Schema for tool definitions come from one source.
- Invariants carry `repairs` — naming the mutations that would fix a violation. This is the seam that feeds derived affordances.
- Reads-tracking in the op log from the very first op. It cannot be retrofitted onto an existing log.
- Framework owns the reactive in-memory graph; persistence is a pluggable adapter.
