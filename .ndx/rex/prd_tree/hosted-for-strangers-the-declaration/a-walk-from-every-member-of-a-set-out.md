---
id: "978816b6-ee75-48d4-b286-257682d24cc9"
level: "feature"
title: "A walk from every member of a set: out()/in() over a set return the distinct union, costed (FR-101)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-101"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
startedAt: "2026-10-06T19:09:04.000Z"
completedAt: "2026-10-06T19:09:04.000Z"
endedAt: "2026-10-06T19:09:04.000Z"
acceptanceCriteria:
  - "out() and in() (or walk(S, 'edge')) apply to a set and return the distinct union, still costed"
  - "count(walk(out('includes'), 'answers') & in('needs')) is one expression"
  - "LifeLogics' coverage meter ('answers 5 of the 7 things they need') is one declared figure; sight applied at each step; the cost check still refuses unbounded walks"
description: "out() walks one step from the subject only; the coverage meter and Cloud's templates (a category's vendors' bookings, a project's tasks' blockers) stay code."
lastModified: "2026-10-06T19:09:04.000Z"
---
