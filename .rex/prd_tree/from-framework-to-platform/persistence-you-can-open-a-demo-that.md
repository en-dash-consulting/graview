---
id: "78e28762-ba91-4a45-abdd-0ff9aa43d2d2"
level: "feature"
title: "Persistence you can open: a demo that keeps its graph in JSON files or SQLite behind a small server, and the launcher shows it"
status: "pending"
priority: "high"
tags:
  - "persistence"
  - "sqlite"
  - "file-adapter"
  - "ship"
  - "server"
  - "sync"
  - "rota"
  - "launcher"
blockedBy:
  - "a4b680fd-970c-4590-acba-ab085b5d0717"
source: "Nick, 2026-09-13: \"/ndx-capture one demo app should show data persistence with sqlite or even json files. not sure how well-baked that is, but it should've also been revealed because that'd be a strong talking point/capability that the launcher would show. so at least one demo app should be illustrating how that works\""
acceptanceCriteria:
  - "graview serve (or the demo's own small server built on @graview/ship) hosts an app's store behind HTTP with the op log as the wire, applying every op through the store under the seat's principal so the policy judges it the same as in the browser"
  - "the file adapter is the default: the demo's data is a readable directory of snapshot.json, log.jsonl and meta.json; --sqlite swaps to core's sqlite adapter with no other change, and both pass the same test"
  - "a remote adapter in ship opens the store from the server, sends every op and receives the others'; two browsers on the demo see each other's changes within a second, and undo of your own op works through it"
  - "stop the server, start it again, reload: the graph, the history and the version are there; a version bump migrates the stored graph on the server once, in the log"
  - "Rota runs this way out of the box, and the launcher's capability list names server-side persistence with a stop that shows the data folder beside the picture"
  - "a harness criterion starts the server, applies an op from one page, reads it from another, restarts the server and reads it again; smoke:create still passes with the browser adapter as the scaffold's default"
description: "Two server-side adapters already exist and nothing shows them: @graview/core's sqlite adapter (better-sqlite3, graph_nodes and graph_edges and the op log) and @graview/ship's file adapter (a directory per scope with snapshot.json, log.jsonl — one operation per line a person can grep — and meta.json carrying the stored version). Every demo remembers only in the browser, so the strongest talking point the platform has for a self-hoster — \"where is my data\" answered with a folder you can open, or a database you can query — is invisible, and the launcher's \"persistence adapter\" capability is true by assertion. This feature makes one demo keep its graph on a server: `graview serve` (in @graview/ship, or a tiny server the demo carries) hosts an app's store behind HTTP — the op log as the wire, ops applied through the same store the browser has, the same policy judging every op with the seat's principal — persisting through the file adapter by default (readable JSON in a directory the demo names) and SQLite behind a flag; the browser side is a remote adapter in ship that opens the store from the server, sends every op, and receives the others' (two browsers open on the demo see each other's changes). Migrations run against the stored graph on the server on version bump, once, in the log. Rota is the demo: its data lives in apps/rota/data as JSON out of the box, `--sqlite` swaps the adapter with nothing else changing, and the launcher's capability list names it with a stop that shows the folder's contents beside the picture. Export and health (ship's exportBundle, assertBundle, health) are surfaced on the server so the talking point has a proof: restart the server, reload, the graph is there. Source: Nick, 2026-09-13: \"one demo app should show data persistence with sqlite or even json files … that'd be a strong talking point/capability that the launcher would show\"."
lastModified: "2026-09-13T04:59:32.421Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
