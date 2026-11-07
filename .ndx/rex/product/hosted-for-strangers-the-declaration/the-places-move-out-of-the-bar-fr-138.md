---
id: "29fb5eb6-6093-4256-8519-f4d01a3700e0"
type: "capability"
title: "The places move out of the bar (FR-138)"
slug: "the-places-move-out-of-the-bar-fr-138"
statement: "On Pages, the places of an app sit in one control after the switch rather than as a row of tabs, so the bar stays one fixed-height row however many places the app has."
criteria: [{"id":"c1","text":"On Pages, the current place shall show as one control after the switch, with its name and ▾, that opens a list grouped as Lists (one per kind) and Pictures (the lenses), with the home first."},{"id":"c2","text":"Each entry in the places list shall show its icon or hue, and a long name shall wrap inside the list."},{"id":"c3","text":"On a desk wider than 1200 px, the places list shall be able to stay open as a narrow left rail, as the declaration or the host chooses."},{"id":"c4","text":"The page shall keep only its own links under its title and shall not repeat the places there as links."},{"id":"c5","text":"With 3 or 30 places, the desk bar shall be one row of fixed height of at most 48 px, with every control centered on one line and none touching the top edge."},{"id":"c6","text":"On a phone, the bar shall be one row."},{"id":"c7","text":"A person shall be able to reach every place in two presses."}]
tags:
  - "graview-cloud"
  - "FR-138"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (handoff: scene or pages, in one glance — from Nick on 0.1.16; replaces FR-135)"
priority: "critical"
resolution: "Shipped in #143 (0.1.17): the place you are on is one control (app-places-open) that opens every place grouped as Home, Lists and Pictures; the bar is one 48 px row at every width, measured by pnpm verify quiet on a document shaped like Cloud's and on one with thirty places."
---

Lenses with sentence-long names and kind lists side by side as tabs wrap; the bar grows with the app; the page repeats the bar's places.
