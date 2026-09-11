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
completedAt: "2026-09-11T18:23:08.773Z"
endedAt: "2026-09-11T18:23:08.773Z"
resolutionType: "code-change"
resolutionDetail: "Stage G walked per graview-ship: the browser adapter is on, and the declaration went to version 3 with two migration steps — 1→2 adding a required `urgency`, 2→3 lower-casing addresses — both run against a planted old store. Four findings fixed with criteria: W-024 \"remove this field\" did not survive being written down, so every persisted patch that cleared a field lost its inverse and a migration could be \"undone\" after a reload leaving the field in place (core + ship, UNSET); W-025 an undo the declaration refuses threw into the console (primitives); W-026 a regression from this session's own W-005 — the card swallowed Enter inside the in-place editor, so renaming stopped committing, caught by pnpm remember and now guarded by a jsdom test in pnpm test; W-027 the scaffolder shipped a project that did not parse, now caught by TypeScript's own parser over every generated file. Verified: edits survive a reload with their history attributed and undoable, \"start fresh\" empties them and the rail says so; the 2→3 migration runs once, is in the log as \"ship:migration · migration 2→3: addresses are written in lower case\", does not re-run on a second load, and is undoable (the address comes back and the undo is logged). Recorded as a note rather than a defect: a step that adds a required field is not undoable while the app is at the new version, and the interface now names the node and the field instead of throwing. pnpm remember 12/12, pnpm smoke:create 28/28."
acceptanceCriteria:
  - "edits survive a reload; start fresh empties them; the rail says so"
  - "the migration runs once, is in the log with author and intent, and is undoable"
description: "Stage G of docs/walkthrough.md: following graview-ship, turn on the browser adapter, reload, then bump the version with a migration and reload against the old store."
lastModified: "2026-09-11T18:23:08.783Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
