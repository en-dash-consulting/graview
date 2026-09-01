---
id: "aecee39a-a57e-4da4-a510-17eeff9d978c"
level: "task"
title: "Selected actions stay near, current, and ranked"
status: "pending"
priority: "high"
tags:
  - "ux"
  - "workbench"
  - "inspector"
source: "UX pass over docs/survey 2026-08-31; user: the contextual menu is confusing"
acceptanceCriteria:
  - "Travelling or changing focus clears the previous selection's inspector — the strip never shows a stale item's actions after the scene has moved on (today the household example/todo travelled states still show the previously selected block's strip)"
  - "Destructive actions (Remove, Drop) are listed last and visually marked as destructive in both the strip and the pointer menu, never first"
  - "When a selection carries more than ~6 actions, repairs and mutations that answer a current violation rank first, plain mutations next, destructive last — the flood of 15 unranked buttons on a rule selection becomes a ranked shelf"
  - "The pointer menu loses its x close button (Escape, click-away and action-choice already close it) and gains the same ranking"
  - "The strip and the pointer menu present the same actions in the same order, so neither surface contradicts the other"
  - "pnpm survey, pnpm audit, pnpm direct and the a11y harness stay green"
description: "Three faults make the context actions confusing even after right-click-at-pointer landed.\n\nSTALE: the strip is keyed to the selection, and travel does not clear it — docs/survey/the household example-travelled and todo-travelled both show the strip still offering the previous selection's actions under a scene that has already moved to a different node. An action bar that answers a question you asked two stops ago teaches people to ignore it.\n\nUNRANKED: Remove is the first button on a block selection; a rule selection floods six-plus wrapping buttons plus Show 9 more with no ordering. Ranking exists in the data (violation repairs carry the violation; destructive ops are marked in the schema) but the strip renders declaration order.\n\nDUPLICATED SHAPE, DIFFERENT DRESS: the pointer menu is the same component as the strip but adds an x close button no context menu needs, and its column order can differ from the strip's measured-budget row order. Same actions, same order, both surfaces."
---
