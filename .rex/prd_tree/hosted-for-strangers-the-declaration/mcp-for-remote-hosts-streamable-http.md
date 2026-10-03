---
id: "f674e961-08ad-4ad5-834e-ca32f915478a"
level: "feature"
title: "MCP for remote hosts: Streamable HTTP, honest tool hints, and other people's words marked as data"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-10"
  - "security"
blockedBy:
  - "d6f8b50f-d58d-4a1d-98bc-689d7d1962ca"
  - "a5dbf8e4-9f15-47e2-bb0c-defc68cd2fac"
source: "Graview Cloud FR-10, 2026-10-02"
startedAt: "2026-10-03T04:44:23.801Z"
completedAt: "2026-10-03T04:44:23.801Z"
endedAt: "2026-10-03T04:44:23.801Z"
acceptanceCriteria:
  - "The MCP TypeScript SDK client completes initialize, tools/list and tools/call against createMcpHttpHandler"
  - "Every derived tool carries title and all four hints, and remove-<kind> is destructive"
  - "A node written by another principal comes back marked untrusted in get_node and search_graph"
  - "The handler refuses every call when the auth hook returns no principal"
description: "WHAT IS THERE NOW: serveMcpStdio, hand-rolled JSON-RPC on protocol 2025-06-18, tools capability only; tools carry no annotations; get_graph and get_node read store.graph directly. MISSING: ChatGPT and Claude reach servers over HTTP, their directories require readOnlyHint/destructiveHint on every tool, and node text written by one collaborator reaches another collaborator's agent as if it were instructions. POSITION: createMcpHttpHandler (Streamable HTTP, stateless per the 2026-07-28 spec, compatible with 2025-11-25 clients) with an auth hook that supplies the principal; tool annotations derived from the declaration (title; readOnlyHint for reads; destructiveHint for acts that remove or sever; idempotentHint where derivable; openWorldHint false); read results wrap text authored by someone other than the caller as { untrusted: true, authoredBy, text }; reads go through seenBy (with d6f8b50f)."
lastModified: "2026-10-03T04:44:23.897Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
