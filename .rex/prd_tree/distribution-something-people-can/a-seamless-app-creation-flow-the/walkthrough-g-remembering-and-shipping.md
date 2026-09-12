---
id: "bd10dda2-c4ea-48e3-8475-7e8903fbaeea"
level: "task"
title: "Walkthrough G · Remembering and shipping"
status: "completed"
priority: "high"
tags:
  - "walkthrough"
  - "ship"
startedAt: "2026-09-11T18:03:25.931Z"
completedAt: "2026-09-12T13:16:48.501Z"
endedAt: "2026-09-12T13:16:48.501Z"
resolutionType: "code-change"
resolutionDetail: "Third walk, stage G: the browser adapter driven through its whole lifecycle in walk3 — edits surviving a reload, start fresh emptying them with the rail saying so and the flag not sticking to the address — then version 2 with a migration filling an optional `urgency` from the graph, opened against a stored version-1 graph. It runs once (a second open adds no turn), is in the log authored `ship:migration` with its intent, and comes back off. A ship rehearsal in walk3's own tests covers the round trip, the migration, the export/assertBundle round trip through JSON and health. Two findings, each fixed with a criterion verified failing first: W-063, UndoTurn calling store.undo with no author so nobody could take back their own edit in any app with a policy (packages/primitives, undo-turn.test + verify-seat driving seedbed chapter 7); W-064, seedbed's scene never receiving the chapter's principal so chapters 7-12 of the published progression showed a reader refused everything, some refusals naming the seat's own role (apps/seedbed, progression theSeatIsNeverRefusedByItsOwnRole). Stage re-run clean: axe 0 across 68 screens, audit 20 of 20, and the whole harness list passes."
acceptanceCriteria:
  - "edits survive a reload; start fresh empties them; the rail says so"
  - "the migration runs once, is in the log with author and intent, and is undoable"
description: "Stage G of docs/walkthrough.md: following graview-ship, turn on the browser adapter, reload, then bump the version with a migration and reload against the old store."
lastModified: "2026-09-12T13:16:48.510Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
