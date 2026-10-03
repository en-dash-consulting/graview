---
id: "4ffdcf3d-6dcd-4144-87f9-9d6a1dd3ecad"
level: "task"
title: "The store a host drives: a real clock, its own sentences kept, previews of several calls, host ops appended, typed undo refusals"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
source: "Graview Cloud build, 2026-10-02"
acceptanceCriteria:
  - "An op made without a now option is stamped with the current time"
  - "applyAll with intent keeps each op's describe sentence"
  - "previewAll previews several calls without writing"
  - "store.append lands host-made ops as ordinary, undoable history"
  - "A blocked undo throws UndoBlockedError with the blocking op"
description: "Found driving Store from a Durable Object: (a) the default clock is the epoch, so every op is stamped 1970 unless the host passes now; (b) passing intent to applyAll overwrites each op's describe() sentence, so a host that wants both must call describe itself; (c) preview takes one call and there is no rollback, so a host previews a batch on a copy; (d) there is no public way to append ops the host built (migrations, seeded examples) other than receive, and a log naming a kind the new schema dropped cannot be re-folded, so reopening after a declaration change must start from a snapshot; (e) a blocked undo throws a plain GraphError rather than a typed refusal naming the blocker. POSITION: default now to Date; keep describe() and put intent beside it; previewAll(calls); store.append(ops) for host-made ops with the snapshot-reopen rule written down; UndoBlockedError carrying the UndoCheck."
lastModified: "2026-10-02T21:32:21.913Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
