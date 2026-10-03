---
id: "3b647ea3-7070-40ee-b351-5115f42c5d3f"
level: "feature"
title: "A rule language the framework interprets: total, budgeted, and read like a sentence"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-07"
source: "Graview Cloud FR-07, 2026-10-02"
startedAt: "2026-10-03T04:56:58.470Z"
completedAt: "2026-10-03T04:56:58.470Z"
endedAt: "2026-10-03T04:56:58.470Z"
acceptanceCriteria:
  - "Every production and function has unit tests including null propagation"
  - "A fuzz test of 10,000 random expressions terminates within the budget; exceeding it yields a rule-too-costly violation naming the rule, never a hang"
  - "graview check warns on a per-subject rule that iterates all('kind')"
  - "A studio rule with a judgement in the language evaluates after apply, and the walk's seedbed rehearsal proves one end to end"
description: "WHAT IS THERE NOW: an invariant's judgement is a function; a studio-declared rule gets evaluate: () => [] and 'the checkout gives it a judgement'. MISSING: a way to say what must hold without writing code. POSITION: a small expression language (grammar at ../graview-cloud/docs/declaration-document.md#expression-language): literals, field access, one-edge hops, out/in/all sets with where, a closed function set (count, exists, every, some, sum, min, max, present, len, contains, startsWith, lower, today, now, days, hours, date, if), null propagation, no regex, no loops, no user functions; a step and node-visit budget per evaluation. Used for invariant require/when, act allowedWhen, computed values, and FR-03 view conditions. The studio gains a rule's judgement as a field it can edit, so an agent in the studio can propose one."
lastModified: "2026-10-03T04:56:58.561Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
