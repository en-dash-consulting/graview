---
id: "41ee5315-89e8-41b8-b064-7cdbce646013"
type: "capability"
title: "One place says how many problems there are (FR-122)"
slug: "one-place-says-how-many-problems-there"
statement: "The Pages home shows how many problems an app has in one place, the top bar, and the tab and the hero point to that count instead of repeating it, on a phone and on the desk."
criteria: [{"id":"c1","text":"When the Pages home is shown on a phone, the top bar shall state the problem count once, and the tab and the hero shall point to that count rather than repeat it."},{"id":"c2","text":"When the Pages home is shown on the desk, the top bar shall state the problem count once, and the tab and the hero shall point to that count rather than repeat it."},{"id":"c3","text":"When a fresh vendor app with three problems is shown on a phone, the Pages home shall say \"3 problems\" once above the fold."}]
tags:
  - "graview-cloud"
  - "FR-122"
  - "design"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
priority: "medium"
resolution: "Shipped in #124 (0.1.15): the embed sets PageContext.standingAbove while its strip is drawn, the shell's Problems tab then carries no count, and the home links to /problems without the number; pnpm verify quiet counts it once on 24 screens."
---

A fresh vendor app on a phone said '3 problems' three times: top bar, tab, hero.
