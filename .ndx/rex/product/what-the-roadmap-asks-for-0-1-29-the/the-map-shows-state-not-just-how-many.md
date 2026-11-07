---
id: "ef7b619c-fd07-4eed-b9f4-d0bb81258124"
type: "capability"
title: "The map shows state, not just how many"
slug: "the-map-shows-state-not-just-how-many"
statement: "The map shows each district's state, not just its record count, by arranging blocks by status, lighting problems and recent change, and summarizing a district from altitude."
criteria: [{"id":"c1","text":"The map shall arrange the blocks in a district by the kind's main choice field, one row per value in declared order, drawing done blocks flat and muted and active blocks raised."},{"id":"c2","text":"When a record has a problem, the map shall light its block."},{"id":"c3","text":"When a record has changed since the viewer's last visit, the map shall make its block glow faintly."},{"id":"c4","text":"The map shall mark the records that are the viewer's own."},{"id":"c5","text":"The map shall carry state in color rather than kind, tinting kinds neutrally and keeping strong color for problems, overdue records and recent change."},{"id":"c6","text":"While the view is at altitude, the map shall show each district as its name, its count, a stacked status bar and a problem count."},{"id":"c7","text":"When the view comes down from altitude, the map shall show named blocks."},{"id":"c8","text":"From LifeLogics Recon's opening view, the map shall let a viewer read how many actions are open, doing and done, and which are overdue."}]
tags:
  - "roadmap"
  - "f-map-shows-state"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "medium"
resolution: "Shipped on feat/a-map-you-can-read: blocks stand in rows by the kind's main choice field in declared order (done flat and pale, active darker and taller), problems and overdue records lit, changes since the last visit aglow and your own rimmed, kinds tinted neutrally, a stacked status bar under each district's name from altitude, and block names coming down."
---

Every block in a district is the same cube, so 31 cubes say only '31'. Roadmap f-map-shows-state; depends on f-map-readable.
