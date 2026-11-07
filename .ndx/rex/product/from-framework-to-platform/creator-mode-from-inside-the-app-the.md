---
id: "d1e36350-e5ba-4c82-843d-87b32aac15b2"
type: "capability"
title: "Creator mode from inside the app: the studio is a place on the bar, in every app the scaffold writes"
slug: "creator-mode-from-inside-the-app-the"
statement: "Every Graview app offers a Studio place on its shell bar and embed strip that opens the running app's own declaration as an editable graph, checked by graview check before it is applied."
criteria: [{"id":"c1","text":"The shell bar and the embed strip shall offer \"Studio\" to the seat that may administer the installation and to no other seat."},{"id":"c2","text":"When the person presses \"Studio\", the app shall open its running declaration in the studio without leaving the app."},{"id":"c3","text":"The studio over the running app shall show the kinds, fields, edges, acts, rules, roles and grants as districts, the same districts that seedbed chapter fifteen shows."},{"id":"c4","text":"The studio shall offer \"What the checker says\" as a place on its bar."},{"id":"c5","text":"The studio shall make every change to the declaration an ordinary act that can be undone."},{"id":"c6","text":"When the person applies a change, the studio shall run graview check first."},{"id":"c7","text":"If graview check reports errors, the studio shall refuse to apply the change and name those errors."},{"id":"c8","text":"When graview check reports no errors, the studio shall offer the written files (src/domain/schema.ts, mutations.ts, invariants.ts, policy.ts) and the migration a stored graph needs, which the person can save by download or copy."},{"id":"c9","text":"The scaffold shall write the Studio entrypoint into every project that graview create makes."},{"id":"c10","text":"The todo app and the seedbed shall carry the Studio entrypoint."},{"id":"c11","text":"When an agent seat in the studio proposes a change, the person shall be able to keep or decline it from the trail."}]
tags:
  - "studio"
  - "creator"
  - "shell"
  - "scaffold"
  - "platform"
source: "Nick, 2026-09-13: \"where the app builder construct? you worked that task, no?\" and \"/ndx-capture that instead\""
priority: "high"
---

@graview/studio shipped as a package and as seedbed chapter 15, but there is no way into it from the app you are looking at: the todo app and a scaffolded project have no Studio on their bars, so the only way to open one is to mount it by hand. This feature puts the studio one press away in every app. The shell bar (and the embed strip) gains a "Studio" place, gated the way "Show the installation" is — offered to the seat that may administer, never to anyone else — that opens the running app's own declaration as a graph in the studio: kinds, fields, edges, acts, rules, roles and grants as districts, "What the checker says" as a place beside it, the ordinary acts to change it, undo on every change. Applying runs graview check first, refuses on errors, and hands the person the files the studio would write (src/domain/schema.ts, mutations.ts, invariants.ts, policy.ts) and the migration a stored graph needs, with a way to save them where a browser can (download or copy) since a browser cannot write the checkout. The scaffold writes the entrypoint into every new project, the todo app and the seedbed carry it, and an agent seat in the studio proposes for the person to keep or decline. Source: Nick, 2026-09-13: "where the app builder construct?" — the studio must be reachable from inside the app, not only from the page and the package.
