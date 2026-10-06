---
id: "15c3bdba-9c63-4139-b76a-3f955ca463c7"
level: "task"
title: "A log a seat may not fully see is redacted, not gapped: OperationLog and openRemote take withheld ops"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-02"
source: "Graview Cloud build, 2026-10-02"
startedAt: "2026-10-03T04:44:26.245Z"
completedAt: "2026-10-03T04:44:26.245Z"
endedAt: "2026-10-03T04:44:26.245Z"
acceptanceCriteria:
  - "A log with withheld ops loads, folds and undoes around them"
  - "The rail shows a withheld op without revealing what it touched"
  - "checkUndo never names a withheld op's contents in its sentence"
description: "OperationLog.from throws on any gap in seq, so a served store that withholds ops touching unseen nodes cannot drop them — openRemote would refuse the log. Cloud's room sends placeholders {id, seq, batch:'withheld', author: cloud:withheld, primitives: []}. POSITION: name the redacted op in core (Operation.withheld or a WITHHELD author), have the log, undo checks and the activity rail treat it as 'something you cannot see happened', and have FR-02's serve path produce it."
lastModified: "2026-10-03T04:44:26.333Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
