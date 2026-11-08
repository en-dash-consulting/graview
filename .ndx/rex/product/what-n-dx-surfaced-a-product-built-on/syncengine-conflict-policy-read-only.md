---
id: "862afd06-4b6a-4ed1-80b0-9156a2ef5211"
type: "constraint"
title: "SyncEngine: conflict policy, read-only resources, seeded links, an MCP remote, a seat and deletes"
slug: "syncengine-conflict-policy-read-only"
statement: "SyncEngine.run() pushes our value in the same pass it reports the conflict; read-only kinds, link seeding from a version field, an MCP remote with an allowlist and a seat are all hand-built in n-dx's face (src/sync/engine.ts, mapping.ts, dev/ndx-door.ts); a local delete of a synced node is refused forever."
tags:
  - "n-dx"
  - "sync"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
acceptanceCriteria:
  - "conflicts: 'theirs' | 'ours' | 'report' on the engine; 'report' never pushes a conflicting field"
  - "A mapping resource may be readonly with a because sentence a refusal says"
  - "The engine seeds links from a named version field"
  - "An MCP RemoteSystem with a tool allowlist"
  - "The memory store / browser adapter take a principal"
  - "A local delete of a synced node is pushed or refused once with a reason"
priority: "high"
resolution: "Done in #198: SyncEngine takes conflicts report|theirs|ours (report holds a field and sends neither side), a readonly resource with a because sentence that guard() refuses a local act with, links seeded from a version field, mcpClient/mcpDoor/doorClient/mcpRemote with a tool allowlist, StoreOptions.principal with rememberedPrincipal, and a delete pushed or refused once; the engine is @graview/core/sync."
---
