---
"@graview/core": patch
"@graview/layout": patch
"@graview/tools": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
---

Small truths after the cleanup. A record described by `describePlace` is at the address the routed face gives it. It was `/deliverable/a b`, an address no page answers; it is now `/deliverables/a%20b`. A seat handed a face's store and views lists the places the declaration does. It now orders the pictures as the arrangement does and calls the scene what the bar calls it, where before it said "Scene" whatever the app named it. `placesOf` and `placesFromViews` are one builder now, and a test holds them equal on every example app. A model's tool for an act is titled what the actions strip and the seat call it: "Mark done", not "MarkDone". A kind that declares no plural is called by one rule everywhere: its name and an "s", as the routed face titles and addresses its list. The relation key, seeding, the trail, the road map, the module switch, the band's groups, edge signs, the columns lens and Find had each said the bare kind or a humanized one. Keeping a lens, `graview describe` and Find give a place's address with one rule, adding `?of=` where two kinds share a name.

Compatibility: ops, stored formats, the wire, the document format, check's finding codes and tool names are unchanged. New in `@graview/core`: `pluralOf`, `actTitle`, `kindPath`, `recordPath`, `placePath`, `sharesItsName` and `placesFrom`. `@graview/layout`'s internal `pluralOf` and `@graview/pages`' `pluralSlug`, `recordPath` and `placePath` now call them, with the same results. Changed:
- `describePlace(…).place.address` for a record is `/<plural slug>/<encoded id>`, not `/<kind>/<id>`.
- `placesFromViews` returns places in `placesOf`'s order, and takes `pages` (the arrangement), from which it names the scene with `sceneTitle`.
- A tool's `title` and `annotations.title` for an untitled act is `humanizeField(name)` ("Mark done"), where it was the name with only `-` and `_` spaced ("MarkDone").
- For a kind with no declared plural:
  - a Find kind hit's `label` is "tasks", not "Tasks";
  - a band group's words say "tasks", not "Tasks";
  - the module switch's sentence says "Turn off tasks", not "Turn off task";
  - `kindMap(…).kinds[].plural`, the relation key, seeding's plan, the context menu's subject, the way back up, the columns lens's label, edge signs, a scene district's `label` and the "add a lens" act's options use "tasks" where they said "task" or "Tasks".
