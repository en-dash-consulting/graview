---
id: "2da4a00d-0a4b-4a8b-a2c7-d0918dacfd6f"
level: "feature"
title: "An empty last step says the floor's reading (FR-168)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-168"
source: "Graview Cloud, 2026-10-12 (the framework brief after 0.1.26, the turn of 13:50 on staging)"
startedAt: "2026-10-12T15:00:00.000Z"
completedAt: "2026-10-12T16:30:00.000Z"
endedAt: "2026-10-12T16:30:00.000Z"
acceptanceCriteria:
  - "A last answer that is empty, whitespace, JSON that does not parse, or JSON that says nothing and proposes nothing says the floor's reading and proposals with the failed turn's aside"
  - "It never says \"The answer came back in a shape I could not read\" where the floor had a reading"
  - "A model's prose is still its answer"
description: "A turn whose last step answered one output token was shown \"The answer came back in a shape I could not read. Ask again in other words.\" although the floor had a grounded reading and a proposal."
lastModified: "2026-10-12T16:30:00.000Z"
resolution: "Shipped in #238: answerWithModel marks an unreadable answer unsure, and seatResponder says the floor's reading with \"(AI didn't answer just now, so this is from the app alone.)\" (packages/tools/src/local.ts)."
---
