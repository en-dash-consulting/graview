---
id: "1579a75f-16af-4578-ab80-f659c2dd8684"
level: "task"
title: "Roads run on the ground between plots: one road per relation kind, lattice-aligned, ending at the kerb, with member lines only for what is selected"
status: "pending"
priority: "high"
tags:
  - "city"
  - "altitude"
  - "roads"
acceptanceCriteria:
  - "Every pair in roadsOf draws exactly one road at altitude, lattice-aligned, kerb to kerb, on the ground layer under buildings"
  - "Member-level lines draw at altitude only for a selection or a hover, and a focused screen's members are not wired to the city otherwise"
  - "A junction of three or more roads at one plot fans to distinct kerb points"
  - "Survey, audit, lines and navigation harnesses pass; a unit test covers kerb-to-kerb endpoints"
description: "roadsOf (core/city.ts) already lists which district pairs are joined by which edge kinds, and latticePoints (react/routes.ts) bends a line along the lattice diagonals. But at altitude the picture is still the stack's connectors: thin curves from member chips inside a screen to a nameplate corner. Nick's Squad screenshot (2026-09-19) is the worst case: some twenty curves from every position on the screen fan across the whole city and are drawn OVER the DRILLS and SKILLS blocks. Draw roads as ROADS: for every pair in roadsOf, one path on the ground layer (under tiles' kerbs and buildings, over the fields) along the lattice from the kerb of one plot to the kerb of the other — a double line (two 1px edges in the ground's ink at ~35%, a lighter fill between) 6px wide, with a small gap where two roads cross; the relation's name once along the road in the small caps the legend uses, only when there is room. A screen's members are NOT wired into the city: member-level connectors from altitude draw only for a selected member or a hovered chip (the existing hover/selection paths), and then as today, and never across a building — routed on the ground layer with the plot boxes as obstacles. The legend's counts stay. Junctions where three or more roads meet at one plot fan to distinct kerb points rather than a knot. Roads tween with the plots."
lastModified: "2026-09-20T03:46:12.329Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
