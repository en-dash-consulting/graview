---
id: "11da2db5-f5ab-482e-af04-4ca6de622720"
type: "capability"
title: "A long-lived log compacts behind an undo horizon"
slug: "a-long-lived-log-compacts-behind-an"
statement: "A long-lived log compacts ops older than an undo horizon into a checkpoint, so opening a compacted store loads only the checkpoint and the tail, while undo stops at the horizon and export can still carry the full history."
criteria: [{"id":"c1","text":"When a compacted store is opened, the store shall load only the checkpoint and the tail of the log."},{"id":"c2","text":"If an undo reaches past the undo horizon, the store shall refuse it with a sentence naming the horizon."},{"id":"c3","text":"When exportBundle is called with { full: true }, the export shall include archived ops."},{"id":"c4","text":"The store shall fold ops older than the declared undo horizon (default 90 days or N ops) into a checkpoint and move them to cold storage through an adapter method."},{"id":"c5","text":"The activity rail shall stop at the undo horizon and say so."}]
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud docs/operations.md §7, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: the whole log is loaded to fold and to undo; an app used daily for a year carries every op. MISSING: hosts bound memory and wake time. POSITION: a checkpoint + tail model: ops older than an undo horizon (declared, default 90 days or N ops) fold into a checkpoint and move to cold storage (an adapter method), still exportable; undo and the activity rail stop at the horizon and say so; export still carries the full history when asked.
