---
id: "6dddd03f-e2d0-4a37-800d-73807e3984e6"
level: "task"
title: "The gauntlet has two kinds sharing a field name, and a rule that names both"
status: "completed"
priority: "medium"
tags:
  - "walkthrough"
  - "carried"
source: "ndx-capture"
startedAt: "2026-10-20T08:21:54.000Z"
completedAt: "2026-10-20T08:21:54.000Z"
endedAt: "2026-10-20T08:21:54.000Z"
resolutionType: "code-change"
resolutionDetail: "apps/gauntlet gains a-leader-is-free-on-their-workshops-day: a workshop whose leader presents both 2027 keynotes that day, naming the workshop and the two talks (each kind with a status in words of its own) together; the seed generator writes it. The new shape found a bug: the structure provider brought the workshop 'in line with the others' through a relation only the talks hold (Add a leader, Unlink a speaker); fixed in packages/tools/src/providers/structure.ts. Criteria: the-awkward-shapes.test.ts 'two kinds sharing a field name...' and packages/tools/tests/unit/a-neighbor-shared-through-another-relation-is-not-a-near-miss.test.ts (both verified failing without the fix); verify-gauntlet's new claim twoKindsSharingAFieldAreChosenThroughTheirRule holds --quick in chromium, firefox and webkit (107 of 107 states each)."
acceptanceCriteria:
  - "the gauntlet fixture gains it and its claims hold in all three engines"
description: "no gauntlet fixture has two kinds sharing a field (status) with one rule naming both, so a shared field chosen through a problem is never walked (carried from walks XI and XII)"
lastModified: "2026-10-20T08:21:54.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
