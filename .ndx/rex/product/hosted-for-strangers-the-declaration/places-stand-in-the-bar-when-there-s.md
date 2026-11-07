---
id: "25e05754-3481-4d97-b102-141a89f0de6f"
type: "capability"
title: "Places stand in the bar when there's room (FR-145)"
slug: "places-stand-in-the-bar-when-there-s"
statement: "On both the pages face and the scene face, the bar shows as many places as fit in plain text beside the name, the switch and the tools, and folds the rest into a More menu."
criteria: [{"id":"c1","text":"When the bar has room after the name, the switch and the tools, the bar shall show the first places in declared order as plain text items on both the pages face and the scene face."},{"id":"c2","text":"The bar shall always include the current place among the places it shows as plain text items."},{"id":"c3","text":"The bar shall fold the places that do not fit into a More ▾ dropdown."},{"id":"c4","text":"The bar shall measure how many places fit from its real width and recompute the count when it is resized."},{"id":"c5","text":"The bar shall stay one row of 48 px and shall not wrap."},{"id":"c6","text":"On a phone, the bar shall keep the single control for places."},{"id":"c7","text":"At a 1920 px width the reproduction's app shall show four or more places in the bar, at 1280 px it shall show fewer, and at 390 px it shall show the single control."}]
tags:
  - "graview-cloud"
  - "FR-145"
  - "design"
source: "Graview Cloud, 2026-10-08 (handoff: a record drawn twice, and the scene's own place control — Nick on 0.1.17)"
priority: "high"
resolution: "Shipped in #156, merged through #162 (0.1.18): places stand on the bar's row as words where there is room, the rest under More, the one control where there is not; pnpm verify quiet measures it on both faces, three engines."
---

Nick: 'Might also be nice to have some of them available with a More dropdown when screen real estate allows (for pages nav and scene nav)'. An extension of FR-138, not a reversal.
