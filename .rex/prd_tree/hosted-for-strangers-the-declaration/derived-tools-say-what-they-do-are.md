---
id: "32381ec8-f822-4e18-99d4-c6ca17dc65a3"
level: "task"
title: "Derived tools say what they do, are safe to name, and an act named like a read tool can still be run"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-10"
source: "Graview Cloud per-app connectors, 2026-10-02"
startedAt: "2026-10-03T04:44:24.651Z"
completedAt: "2026-10-03T04:44:24.651Z"
endedAt: "2026-10-03T04:44:24.651Z"
acceptanceCriteria:
  - "Every ToolDefinition carries readOnly/destructive/idempotent hints"
  - "An act named get_node runs as the act"
  - "toolDefinitions(app, principal) needs no store and returns a surface hash"
  - "Tool names are MCP-safe with deterministic collision handling"
description: "createToolRuntime's ToolDefinition carries no annotations (read-only, destructive, idempotent) and Cloud looks each mutation up again by name; compiled mutations never say whether an act is idempotent; tool names are raw act names (add-vendor) with no MCP-safe form or collision handling; BUG: an act named like a runtime read tool (get_node, get_graph, search_graph) cannot be run — run() finds the read tool first; listing tools needs a whole Store (a pure toolDefinitions(app, principal) would be cheap); there is no surface hash to tell a stateless host the list changed."
lastModified: "2026-10-03T04:44:24.727Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
