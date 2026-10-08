---
id: "29fb5eb6-6093-4256-8519-f4d01a3700e0"
level: "feature"
title: "The places move out of the bar (FR-138)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-138"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (handoff: scene or pages, in one glance — from Nick on 0.1.16; replaces FR-135)"
completedAt: "2026-10-08T14:10:55.000Z"
endedAt: "2026-10-08T14:10:55.000Z"
acceptanceCriteria:
  - "On Pages, the current place shows as one control after the switch: its name and ▾, opening a list grouped as Lists (one per kind) and Pictures (the lenses), the home first; each entry with its icon or hue; long names wrap inside the list"
  - "On a desk wider than 1200 px the list may stay open as a narrow left rail (the declaration or the host chooses)"
  - "The page stops repeating the places as links under its title, keeping only its own links"
  - "With 3 or 30 places the desk bar is one row of fixed height (≤ 48 px), every control centered on one line, none touching the top edge; a phone bar is one row; every place in two presses"
description: "Lenses with sentence-long names and kind lists side by side as tabs wrap; the bar grows with the app; the page repeats the bar's places."
lastModified: "2026-10-08T15:30:00.000Z"
resolution: "Shipped in #143 (0.1.17): the place you are on is one control (app-places-open) that opens every place grouped as Home, Lists and Pictures; the bar is one 48 px row at every width, measured by pnpm verify quiet on a document shaped like Cloud's and on one with thirty places."
---
