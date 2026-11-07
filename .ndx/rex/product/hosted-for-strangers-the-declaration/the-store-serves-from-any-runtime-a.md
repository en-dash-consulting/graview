---
id: "bb2e392d-cb82-4f32-9d4a-d31b571f1dce"
type: "capability"
title: "The store serves from any runtime: a fetch handler, an adapter over plain SQL, and core proven in workerd"
slug: "the-store-serves-from-any-runtime-a"
statement: "The served store's routes answer from any runtime through a fetch handler, its persistence runs over a synchronous SQL exec interface, and the core, tools and ship runtime entries are exercised in workerd."
criteria: [{"id":"c1","text":"The WIRE routes shall answer through a fetch handler that takes a Request and a seat and returns a Response, with no node: import."},{"id":"c2","text":"When graview serve runs, the node:http server shall behave as a thin wrapper over the fetch handler, with the same behaviour as before."},{"id":"c3","text":"The exec-based persistence adapter shall pass the sqlite adapter's tests against better-sqlite3."},{"id":"c4","text":"The exec-based persistence adapter shall pass the sqlite adapter's tests against Durable Object storage in Miniflare."},{"id":"c5","text":"The CI job shall import @graview/core, @graview/tools and the ship runtime entry in workerd and apply a call."}]
tags:
  - "graview-cloud"
  - "FR-09"
source: "Graview Cloud FR-09, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: serveStore is a node:http server for one app; the sqlite adapter is structural over better-sqlite3; core's main entry has no Node built-ins but nothing proves it runs outside Node. MISSING: a self-hoster on Workers, Deno or Bun, and Cloud's one-Durable-Object-per-app room, cannot reuse the served store. POSITION: serveStore's routes as handle(request: Request, seat) → Response with node:http as a thin wrapper; a PersistenceAdapter over a synchronous exec(sql, ...params) interface that fits Durable Object SQLite and better-sqlite3 alike; CI runs core, tools and ship's runtime entries in workerd (Miniflare) and Deno.
