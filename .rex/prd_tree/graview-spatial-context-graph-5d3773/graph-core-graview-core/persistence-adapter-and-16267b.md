---
id: "16267bfa-7850-4eb8-ad67-d5b6dd5fb27e"
level: "task"
title: "Persistence adapter and the household example graph load"
status: "pending"
priority: "high"
tags:
  - "core"
  - "persistence"
  - "adapter"
  - "acceptance"
blockedBy:
  - "aa5d62c9-4d32-4157-aa3d-61aa93642dde"
  - "2f983070-fccb-4b73-9ea0-0f2afb4cfe37"
acceptanceCriteria:
  - "Memory and Drizzle/SQLite adapters both satisfy one adapter interface"
  - "The household example's real graph_nodes and graph_edges load into a typed graph"
  - "Invariants run against the loaded graph and match the household example's current reported violations"
  - "The whole tier runs headlessly in CI — no DOM, no GPU, no browser flag"
  - "Writes round-trip through the adapter and survive a reload"
description: "The framework owns the reactive in-memory graph, invariants, diff and undo; persistence goes through a pluggable adapter. Ship a memory adapter and a Drizzle/SQLite adapter so the household example's existing store plugs straight in.\n\nOwning the graph is what makes invariants enforceable and agent attribution free — it is the reason for this choice rather than the view-only alternative.\n\nThis task closes the loop on the whole headless tier: load the household example's actual `graph_nodes` and `graph_edges` tables through the adapter, build the typed graph, run the invariants, and confirm the framework reproduces what the household example's own engine reports today. Real data with real mess — recurrence, effectivity windows, exception nodes — not a synthetic fixture."
---
