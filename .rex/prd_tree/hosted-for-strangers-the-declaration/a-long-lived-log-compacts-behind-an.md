---
id: "11da2db5-f5ab-482e-af04-4ca6de622720"
level: "feature"
title: "A long-lived log compacts behind an undo horizon"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud docs/operations.md §7, 2026-10-02"
acceptanceCriteria:
  - "Opening a compacted store loads only the checkpoint and the tail"
  - "Undo past the horizon is refused with a sentence naming the horizon"
  - "exportBundle({ full: true }) includes archived ops"
description: "WHAT IS THERE NOW: the whole log is loaded to fold and to undo; an app used daily for a year carries every op. MISSING: hosts bound memory and wake time. POSITION: a checkpoint + tail model: ops older than an undo horizon (declared, default 90 days or N ops) fold into a checkpoint and move to cold storage (an adapter method), still exportable; undo and the activity rail stop at the horizon and say so; export still carries the full history when asked."
lastModified: "2026-10-02T22:46:25.836Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
