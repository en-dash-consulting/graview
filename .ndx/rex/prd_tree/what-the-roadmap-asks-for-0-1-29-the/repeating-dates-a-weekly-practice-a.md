---
id: "1a92a870-098c-430d-ae0d-ba38b748baee"
level: "feature"
title: "Repeating dates: a weekly practice, a monthly bill"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-recurring-dates"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
acceptanceCriteria:
  - "A repeat on a date field (weekly, monthly, weekday list, until)"
  - "The calendar lens draws occurrences; today(), the timeline and the kind stop read the next one"
  - "An act can skip one occurrence or change from here without rewriting the rule"
description: "A date field is one moment; a practice, rota or bill is one record per occurrence made by hand."
startedAt: "2026-10-13T21:40:00.000Z"
completedAt: "2026-10-14T02:30:00.000Z"
endedAt: "2026-10-14T02:30:00.000Z"
lastModified: "2026-10-14T02:30:00.000Z"
resolution: "Shipped on feat/repeating-dates: a date or datetime field with repeats: true (repeatField() in TypeScript) keeps its first occurrence and, beside it as <date>Repeat, every/interval/on/until/count/except; rules, today(), sorting, the kind stop and words read the next occurrence, the calendar draws each one marked, and skip-, detach- and split-<kind> act on one occurrence with one undo each."
---
