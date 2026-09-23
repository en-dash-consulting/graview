---
id: "48aa05ff-aacf-4afc-9c89-156a4eee17c5"
level: "task"
title: "The studio applies a declaration change all the way: files written, bodies authored, the stored graph migrated — without leaving the studio"
status: "in_progress"
priority: "high"
blockedBy:
  - "4f5233f8-6cde-4da5-9d09-6f44541d5e67"
startedAt: "2026-09-23T04:04:31.537Z"
acceptanceCriteria: []
description: "Apply in the studio (packages/studio/src/place.tsx, Written) stops at downloads: 'The checker is happy. 3 files to write, and a migration: plot tended-by edges go' with src/domain/*.ts ↓ pills to copy by hand. Worse, for acts and rules the checkout already has, source.ts writes a stub that throws naming the body to supply — so a change like 'people should be assigned to plants not plots' (tended-by moved from plot->gardener to planting->gardener) leaves seedbed's tend body (still takes plotId, still adds plot->gardener) and the 'every plot has a caretaker' rule broken, to be fixed in an editor. The migration is described but never run against the stored graph, and it drops the old edges rather than moving them. This should be doable within the studio.\n\nAcceptance:\n- A dev-only write door beside the decision door (packages/ship/src/dev.ts, same configureServer pattern as DECISION_BRIDGE_PATH): Apply writes the files graview create writes into the checkout's src/domain/, refuses paths outside it, and the app hot-reloads onto the new declaration. Without the door (a deployed app), the downloads remain and say why.\n- Nothing Apply writes throws at runtime: an act body or rule judgement the change invalidates is authored IN the studio before Apply is allowed — edited as code in the studio, or proposed by the studio seat (the same seat as the app chat, task 4f5233f8) and checked by graview check plus a compile of the written file. A body the change does not touch is kept verbatim from the checkout, never stubbed.\n- The migration runs against the stored graph through the op log (undoable), and a change that moves an edge between kinds offers to MOVE the data (plot tended-by gardener -> each planting in that plot tended-by gardener) rather than only dropping it; what it will do is said before Apply.\n- Rehearsed end to end on seedbed: 'people should be assigned to plants not plots' in the studio seat -> Apply -> the app reloads, tend takes a planting, the caretaker rule reads plantings, existing caretakers moved; pnpm typecheck and graview check pass on the written checkout; scripts/verify-studio.mjs covers it."
lastModified: "2026-09-23T04:04:31.601Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A dev door writes the studio's change into the checkout, editing the source rather than regenerating it](./a-dev-door-writes-the-studio-s-change.md) | completed |
| [An act body or rule judgement the change invalidates is authored in the studio before Apply](./an-act-body-or-rule-judgement-the.md) | completed |
| [Rehearsed on seedbed: 'people should be assigned to plants not plots', end to end in the studio](./rehearsed-on-seedbed-people-should-be.md) | pending |
| [The migration carries the stored graph across the change, moving data rather than only dropping it](./the-migration-carries-the-stored-graph.md) | pending |
