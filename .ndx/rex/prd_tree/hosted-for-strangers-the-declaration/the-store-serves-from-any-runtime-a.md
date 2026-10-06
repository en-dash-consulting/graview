---
id: "bb2e392d-cb82-4f32-9d4a-d31b571f1dce"
level: "feature"
title: "The store serves from any runtime: a fetch handler, an adapter over plain SQL, and core proven in workerd"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-09"
source: "Graview Cloud FR-09, 2026-10-02"
startedAt: "2026-10-03T04:44:21.265Z"
completedAt: "2026-10-03T04:44:21.265Z"
endedAt: "2026-10-03T04:44:21.265Z"
acceptanceCriteria:
  - "The WIRE routes answer through a fetch handler with no node: import, and graview serve behaves exactly as before"
  - "The exec-based adapter passes the sqlite adapter's tests against better-sqlite3 and against Durable Object storage in Miniflare"
  - "A CI job imports @graview/core, @graview/tools and the ship runtime entry in workerd and applies a call"
description: "WHAT IS THERE NOW: serveStore is a node:http server for one app; the sqlite adapter is structural over better-sqlite3; core's main entry has no Node built-ins but nothing proves it runs outside Node. MISSING: a self-hoster on Workers, Deno or Bun, and Cloud's one-Durable-Object-per-app room, cannot reuse the served store. POSITION: serveStore's routes as handle(request: Request, seat) → Response with node:http as a thin wrapper; a PersistenceAdapter over a synchronous exec(sql, ...params) interface that fits Durable Object SQLite and better-sqlite3 alike; CI runs core, tools and ship's runtime entries in workerd (Miniflare) and Deno."
lastModified: "2026-10-03T04:44:21.349Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
