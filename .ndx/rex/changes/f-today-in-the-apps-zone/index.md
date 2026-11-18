---
id: "20d5359e-e1ef-4340-a90f-8d9f6cf8d5c1"
type: "change"
title: "A rule's today() and date() read the day in the app's own time zone"
slug: "f-today-in-the-apps-zone"
intent: "Left open by PR #629 (f-composer-covers-cloud-first-design), 2026-11-16: a composed dated list says `where not (<date> < today())`, and the rule language's today() and date() are UTC, so near midnight a datetime shows as ahead for a reader west of UTC who is past it, and a reader east of UTC loses one that is still today. Ask: today() and date() (and the clock rules re-judged when the day turns) read the day in the app's declared time zone (the brand's locale and zone, see graview-locale), falling back to UTC only where none is declared."
acceptanceCriteria:
  - "today() in an app whose brand declares America/New_York returns the New York day at 23:30 local, a UTC instant on the next day (test on both sides of midnight)"
  - "date() of a datetime reads its day in the declared zone (test)"
  - "An app with no zone keeps UTC (test)"
  - "A clock rule is re-judged when the declared zone's day turns, not UTC's (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-today-in-the-apps-zone"
source: "Graview HQ feature:f-today-in-the-apps-zone"
---
