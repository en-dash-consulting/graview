---
id: "ca771654-b925-455a-8113-4224cf8313bb"
type: "change"
title: "Moving a person to the right record covers an ended binding, what their acts made, and only the host"
slug: "f-rebind-follow-ups"
intent: "Left open by PR #644 (f-rebind-after-acting), 2026-11-18. (1) A binding that already ended cannot be moved. (2) Records the person's acts created or linked through $me keep pointing at the old record; only who did the act moves. (3) The binding acts accept any non-automated system seat, not a check that it is the host; narrow them to the host's own seat. Private until built; public text neutral."
acceptanceCriteria:
  - "A binding that already ended can be moved to the right record (test)"
  - "Links made through $me by the person's acts move to the new record with the attribution, in the same undoable change (test)"
  - "Only the host's own seat may run the binding acts; every other system seat is refused (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-rebind-follow-ups"
source: "Graview HQ feature:f-rebind-follow-ups"
---
