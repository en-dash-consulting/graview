---
id: "92cf1711-1b84-4cb9-865f-a5547a25a96d"
level: "feature"
title: "Systems of record: two-way sync with the world"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "An adapter declares a mapping from node kinds and fields to an external resource; no per-field imperative sync code in an app"
  - "An inbound change lands as an op with a system author, visible in the activity rail and undoable"
  - "An echo of our own write is recognised and not re-applied"
  - "A genuine conflict is surfaced as a violation with repairs, not resolved silently"
  - "Google Calendar works end to end against the household example"
  - "Working offline degrades to local-only and reconciles on reconnect"
description: "There are persistence adapters (memory, sqlite) but no SYNC: nothing here has ever had to reconcile with a system that changes underneath it. The household example's blocks and duties are literally calendar events, so Google Calendar is the honest first test rather than a hypothetical one.\n\nThe op log gives this a foundation most sync layers lack. Every op already carries who did it, what it read and what it wrote — so an inbound change can arrive as an ordinary op authored `{ kind: \"system\", id: \"google-calendar\" }`, appear in the activity rail beside a person's edits, and be undone like anything else. And because reads are recorded, an echo of your own write is distinguishable from someone else's change, which is the loop that breaks naive two-way sync.\n\nThe adapter should map KINDS to an external resource declaratively, the way a lens maps roles to fields — an app says \"a block is an event, its start is dtstart\" and the framework does the rest."
---
