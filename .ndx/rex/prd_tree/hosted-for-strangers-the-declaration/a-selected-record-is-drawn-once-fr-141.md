---
id: "8904bbed-29e4-486f-ab7b-71f674438056"
level: "feature"
title: "A selected record is drawn once (FR-141)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-141"
  - "bug"
  - "design"
source: "Graview Cloud, 2026-10-08 (handoff: a record drawn twice, and the scene's own place control — Nick on 0.1.17)"
completedAt: "2026-10-08T21:18:53.000Z"
endedAt: "2026-10-08T21:18:53.000Z"
acceptanceCriteria:
  - "Selected Down in its district, a record is drawn by one thing: the kind's declared card (or page) as written, framed, whole, title first, scrolled into view under the bar, with the scene adding only what it lacks; or the built-in card with no declared card behind it; never both"
  - "A tie the card already lists isn't listed again under the same heading; a heading with nothing under it isn't drawn"
  - "The selected card never covers its neighbors"
  - "In the workshop reproduction: the goal once, the four topics once in the card, no empty COVERS, nothing cut off under the bar, nothing overlapping at 1280, 1440 and 1920"
description: "Nick: 'how it's rendered twice'. Down in a district with a record selected, the declared card is zoomed behind the scene's built-in card, which repeats the fields and ties, adds an empty COVERS, and covers the tied records' cards."
lastModified: "2026-10-08T21:18:53.000Z"
resolution: "Shipped in #155 (0.1.18): a declared page is drawn inside the record's one frame as its head, the record adds only what the page did not say, and the record in focus is held to its box; pnpm verify drawn-once holds it on a fixture modeled on Cloud's workshop."
---
