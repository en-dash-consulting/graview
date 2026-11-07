---
id: "2da4a00d-0a4b-4a8b-a2c7-d0918dacfd6f"
type: "capability"
title: "An empty last step says the floor's reading (FR-168)"
slug: "an-empty-last-step-says-the-floor-s"
statement: "When a turn's last model answer is empty, whitespace, unparseable JSON, or JSON that says nothing and proposes nothing, the product says the floor's grounded reading and proposals with the failed turn's aside instead of an unreadable-answer message."
criteria: [{"id":"c1","text":"When a turn's last answer is empty, whitespace, JSON that does not parse, or JSON that says nothing and proposes nothing, the product shall say the floor's reading and proposals together with the failed turn's aside."},{"id":"c2","text":"Where the floor had a reading, the product shall not say \"The answer came back in a shape I could not read\"."},{"id":"c3","text":"When the model's last answer is prose, the product shall use that prose as its answer."}]
tags:
  - "graview-cloud"
  - "FR-168"
source: "Graview Cloud, 2026-10-12 (the framework brief after 0.1.26, the turn of 13:50 on staging)"
priority: "high"
resolution: "Shipped in #238: answerWithModel marks an unreadable answer unsure, and seatResponder says the floor's reading with \"(AI didn't answer just now, so this is from the app alone.)\" (packages/tools/src/local.ts)."
---

A turn whose last step answered one output token was shown "The answer came back in a shape I could not read. Ask again in other words." although the floor had a grounded reading and a proposal.
