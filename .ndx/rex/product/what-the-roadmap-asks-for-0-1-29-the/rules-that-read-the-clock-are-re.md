---
id: "2a3989a1-e869-4459-8d39-a319da585093"
type: "capability"
title: "Rules that read the clock are re-judged when the day turns (FR-176)"
slug: "rules-that-read-the-clock-are-re"
statement: "The product re-judges the rules and computed fields that read the clock when the day turns, so the bar, the problems page and the counts stay true for a long-running hosted room, and the day it turns on is the app's own."
criteria: [{"id":"c1","text":"The store shall know which rules and computed fields read the clock."},{"id":"c2","text":"When store.tick(now) is called, the store shall re-judge the rules and computed fields that read the clock and answer the problems that appeared and the problems that cleared."},{"id":"c3","text":"After a tick, the bar, the problems page and the counts shall be true to the day."},{"id":"c4","text":"When a declaration has a rule that reads the clock and its host never ticks, graview check shall flag the rule or say how a host ticks."},{"id":"c5","text":"While brand.timeZone is declared, today() in rules, computed fields and templates shall be the date in that zone; while it is not declared, today() shall be the UTC date."},{"id":"c6","text":"A server and a page shall agree on the day for the same app, and the day shall turn at the app's midnight."}]
tags:
  - "roadmap"
  - "f-rules-keep-time"
  - "FR-176"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "medium"
resolution: "Shipped on feat/fr-176-tick-and-fr-55-hidden-ids: `store.tick(now)` judges the rules on now's day and answers `{ day, was?, appeared, cleared }`, telling every subscriber; `openStore`/`openRemote` tick at each UTC midnight, `clockReaders` on `@graview/core/check` says which rules and computed fields read the clock, and `graview check` notes them (`rules-read-the-clock`). The store judges every rule at a tick rather than holding the list, so the hosted page keeps to its budget."
---

today() and now() exist, but rules are judged only on change and load; a hosted room stays awake for weeks. Roadmap f-rules-keep-time; Cloud's f-nudges waits on it.
