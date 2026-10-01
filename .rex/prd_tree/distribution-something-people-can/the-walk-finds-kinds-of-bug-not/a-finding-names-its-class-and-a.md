---
id: "4f82f64f-fd6f-4a54-855f-aa1078723b33"
level: "task"
title: "A finding names its class, and a class already known is a miss of the shared check"
status: "completed"
priority: "critical"
completedAt: "2026-10-01T06:23:18.000Z"
endedAt: "2026-10-01T06:23:18.000Z"
resolutionType: "code-change"
resolutionDetail: "All 152 findings carry one of 14 classes (every class was in the first walk); docs/walkthrough.md: a known class is a miss of the shared check; findings carry impact (blocks a job / costs a job / cosmetic), which decides the order; a walk starts from the journeys' friction list and is done when no job is blocked and no new class appears."
tags:
  - "walkthrough"
  - "quality"
  - "harness"
acceptanceCriteria:
  - "every finding W-001 to W-152 carries a class from one short list"
  - "docs/walkthrough.md: a finding of a known class is fixed in the shared check (the watch or the awkward example), not with a criterion local to one component"
  - "the walk's done criterion is no new CLASS; a re-walk of an earlier domain is the regression run, where nothing is the expected answer"
lastModified: "2026-10-01T06:23:18.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
