---
id: "2a3989a1-e869-4459-8d39-a319da585093"
level: "feature"
title: "Rules that read the clock are re-judged when the day turns (FR-176)"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "f-rules-keep-time"
  - "FR-176"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
startedAt: "2026-10-13T05:00:00.000Z"
completedAt: "2026-10-13T07:30:00.000Z"
endedAt: "2026-10-13T07:30:00.000Z"
acceptanceCriteria:
  - "The store knows which rules and computed fields read the clock"
  - "store.tick(now) re-judges them and answers the problems that appeared and cleared"
  - "The bar, the problems page and counts are true to the day after a tick"
  - "graview check flags a clock-reading rule in a declaration whose host never ticks (or says how a host ticks)"
  - "A changeset with a Compatibility line names FR-176"
description: "today() and now() exist, but rules are judged only on change and load; a hosted room stays awake for weeks. Roadmap f-rules-keep-time; Cloud's f-nudges waits on it."
lastModified: "2026-10-13T07:30:00.000Z"
resolution: "Shipped on feat/fr-176-tick-and-fr-55-hidden-ids: `store.tick(now)` judges the rules on now's day and answers `{ day, was?, appeared, cleared }`, telling every subscriber; `openStore`/`openRemote` tick at each UTC midnight, `clockReaders` on `@graview/core/check` says which rules and computed fields read the clock, and `graview check` notes them (`rules-read-the-clock`). The store judges every rule at a tick rather than holding the list, so the hosted page keeps to its budget."
---
