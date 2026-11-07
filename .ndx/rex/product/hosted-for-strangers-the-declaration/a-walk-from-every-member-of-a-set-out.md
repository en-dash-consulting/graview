---
id: "978816b6-ee75-48d4-b286-257682d24cc9"
type: "capability"
title: "A walk from every member of a set: out()/in() over a set return the distinct union, costed (FR-101)"
slug: "a-walk-from-every-member-of-a-set-out"
statement: "out() and in() applied to a set walk one step from every member of that set and return the distinct union, costed, so a multi-step walk is one expression."
criteria: [{"id":"c1","text":"When out() or in() (or walk(S, 'edge')) is applied to a set, the query evaluator shall return the distinct union of the records reached from every member of the set."},{"id":"c2","text":"The query evaluator shall charge the cost of a walk over a set the same way it charges a walk from a single subject."},{"id":"c3","text":"The expression language shall accept count(walk(out('includes'), 'answers') & in('needs')) as one expression."},{"id":"c4","text":"The app shall declare a coverage meter such as 'answers 5 of the 7 things they need' as one declared figure."},{"id":"c5","text":"While a walk over a set runs, the query evaluator shall apply sight at each step."},{"id":"c6","text":"If a walk over a set is unbounded, the cost check shall refuse it."}]
tags:
  - "graview-cloud"
  - "FR-101"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "high"
---

out() walks one step from the subject only; the coverage meter and Cloud's templates (a category's vendors' bookings, a project's tasks' blockers) stay code.
