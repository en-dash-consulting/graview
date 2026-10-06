---
id: "21c43258-0f2d-416d-bf29-0373062dcc31"
level: "task"
title: "The hosted-store contract is written down and frozen: the wire, the seat headers, seed at first install, the catalog and the app checklist"
status: "completed"
priority: "high"
blockedBy:
  - "68f1edc5-76f7-4a99-b3b8-ca80400527a7"
startedAt: "2026-09-28T20:12:35.677Z"
completedAt: "2026-09-28T20:12:35.677Z"
endedAt: "2026-09-28T20:12:35.677Z"
resolutionType: "code-change"
resolutionDetail: "serve.ts exports WIRE and SEAT_HEADERS (test the-wire-is-a-contract.test.ts walks every route); CORS allows authorization. openRemote takes headers and exposes settled(); store.receive(ops, {applied}) records a server op already in effect (fixed a duplicate-node throw on optimistic adds). Ship README: the seed read once, the wire table, the hosted-store concern table. llms.txt 'Attaching an agent'; agents.md 'Evolving a live store' checklist. Skills agent-seat/ship/node-kind/permissions updated, copies reinstalled, site regenerated. Scaffold gets serve + mcp scripts and ignores data/. Commit a5232a6."
acceptanceCriteria:
  - "serve.ts exports WIRE: every route with method, path and one sentence; a test walks WIRE against a served store and every route answers something other than 404"
  - "openRemote takes headers (sent with every request; the server's CORS allows authorization) and exposes settled(), which resolves once every post so far has been answered"
  - "ship's README carries the concern table: in the framework vs in a host; and the wire, the seat headers, seed at first install"
  - "llms.txt gains 'Attaching an agent' naming graview mcp, graview apply, graview serve, the id argument and remove-<kind>; agents.md gains the app checklist"
  - "graview-agent-seat and graview-ship skills carry the host section; pnpm skills and pnpm site:build:all re-run so the copies and the site match"
description: "A third party stands up their own host with SQLite or a file store + graview serve + graview mcp without forking core; Graview Cloud is the polished multi-tenant host of the same API. The framework side: the routes serveStore answers are one exported WIRE constant a test pins; openRemote carries extra headers (a gateway key) and exposes settled() so a host can await the server's verdict; the concern table (op log + snapshot + migrate on open, the wire, principal on apply, seed = first install, MCP/CLI against a remote URL — in the framework; auth, tenancy, quotas — in the host) is in ship's README. llms.txt gains 'Attaching an agent'; agents.md gains the app checklist (declare version + migrations when the schema moves; seed is a bootstrap snapshot; wire serve + mcp in scripts; roles over hardcoded ids; intelligence may-lists cover redesign). Skills graview-agent-seat and graview-ship say the same."
lastModified: "2026-09-28T20:12:35.744Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
